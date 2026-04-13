"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Sparkles,
  Clock,
  CheckCircle,
  Eye,
  MoreVertical,
  FileUp,
  Mic,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCourseSchedules,
  getPreviewGuide,
  getReviewSummary,
  getCourseScripts,
  uploadScript,
  uploadAudio,
  getAudioConvertTask,
  generatePreviewGuide,
  generateReviewSummary,
  getPostAnalyses,
  triggerStructureAnalysis,
  triggerConceptsAnalysis,
  type CourseScriptListItem,
  type PreviewGuide,
  type ReviewSummary,
  type PostAnalysisItem,
} from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useCourse } from "@/contexts/course-context";
import { CourseInfoBanner } from "@/components/layout/course-info-banner";

type SchedulePreview = {
  scheduleId: string;
  weekNumber: number;
  topic: string;
  preview: PreviewGuide | null;
  review: ReviewSummary | null;
};

export function TeacherMaterials() {
  const { selectedCourse } = useCourse();
  const courseId = selectedCourse?.courseId;

  const [schedules, setSchedules] = useState<SchedulePreview[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [simulatedProgress, setSimulatedProgress] = useState<
    Record<string, { progress: number; remaining: number }>
  >({});

  const [activeTab, setActiveTab] = useState("preview");
  const [audioTask, setAudioTask] = useState<any | null>(null);
  
  const [isStartingConvert, setIsStartingConvert] = useState(false);
  const [isUploadingScript, setIsUploadingScript] = useState(false);

  // 수업 후 분석 상태
  const [postAnalysisSheet, setPostAnalysisSheet] = useState<{
    open: boolean;
    scriptId: string | null;
    scriptTitle: string;
    analyses: PostAnalysisItem[];
    loading: boolean;
    triggering: string | null; // "structure" | "concepts" | null
  }>({ open: false, scriptId: null, scriptTitle: "", analyses: [], loading: false, triggering: null });
  
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Load schedules + per-schedule preview/review guides + scripts
  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      try {
        const [schedulesRes, scriptsRes] = await Promise.all([
          getCourseSchedules(courseId),
          getCourseScripts(courseId),
        ]);

        // Fetch preview/review for each schedule in parallel (null = not generated yet)
        const scheduleData = await Promise.all(
          schedulesRes.schedules.map(async (s) => {
            const [preview, review] = await Promise.all([
              getPreviewGuide(courseId, s.scheduleId).catch(() => null),
              getReviewSummary(courseId, s.scheduleId).catch(() => null),
            ]);
            return { 
              scheduleId: s.scheduleId, 
              weekNumber: s.weekNumber, 
              topic: s.topic, 
              preview, 
              review 
            };
          }),
        );

        setSchedules(scheduleData);
        
        const list = scriptsRes.scripts;
        if (Array.isArray(list)) {
          setScripts(
            list.map((s: CourseScriptListItem) => ({
              id: s.scriptId,
              scheduleId: s.scheduleId,
              title: s.title || s.fileName || "업로드된 자료",
              format: (s.fileName.split(".").pop() || "문서").toUpperCase(),
              uploadDate: new Date(s.uploadedAt).toLocaleDateString(),
              status: s.status === "completed" ? "completed" : "analyzing",
              progress: 0,
              issues: 0, // Backend doesn't provide issue count in list yet
            })),
          );
        }
      } catch (err) {
        console.error("강의 자료 데이터 로드 실패:", err);
      }
    };

    void loadData();
  }, [courseId]);

  // Poll audio transcription status
  useEffect(() => {
    if (!courseId || !audioTask || audioTask.status === "COMPLETED" || audioTask.status === "FAILED") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const task = await getAudioConvertTask(
          courseId,
          audioTask.audioId
        );
        setAudioTask(task);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [audioTask, courseId]);

  // ── 스크립트 상태 폴링 ──
  useEffect(() => {
    const hasAnalyzing = scripts.some((s) => s.status === "analyzing");
    if (!hasAnalyzing || !courseId) return;

    const interval = setInterval(async () => {
      try {
        const scriptData = await getCourseScripts(courseId);
        const list = scriptData.scripts;
        if (Array.isArray(list)) {
          setScripts(
            list.map((s: CourseScriptListItem) => ({
              id: s.scriptId,
              scheduleId: s.scheduleId,
              title: s.title || s.fileName || "업로드된 자료",
              format: (s.fileName.split(".").pop() || "문서").toUpperCase(),
              uploadDate: new Date(s.uploadedAt).toLocaleDateString(),
              status: s.status === "completed" ? "completed" : "analyzing",
              progress: 0,
              issues: 0,
            })),
          );
        }
      } catch (e) {
        console.error("스크립트 폴링 실패:", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [scripts, courseId]);

  // ── 남은 시간 시뮬레이션 ──
  useEffect(() => {
    const hasAnalyzing = scripts.some((s) => s.status === "analyzing");
    if (!hasAnalyzing) return;

    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        const next = { ...prev };
        scripts
          .filter((s) => s.status === "analyzing")
          .forEach((s) => {
            const current = next[s.id] || { progress: 0, remaining: 45 };
            next[s.id] = {
              progress: Math.min(
                99,
                current.progress + Math.floor(Math.random() * 3) + 1,
              ),
              remaining: Math.max(1, current.remaining - 1),
            };
          });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scripts]);

  const handleGeneratePreview = async (scheduleId: string) => {
    if (!courseId) return;
    try {
      await generatePreviewGuide(courseId, scheduleId);
      alert("예습 자료 생성 요청이 성공적으로 전송되었습니다.");
      // Refresh
      const preview = await getPreviewGuide(courseId, scheduleId).catch(() => null);
      setSchedules(prev => prev.map(s => s.scheduleId === scheduleId ? { ...s, preview } : s));
    } catch (e) {
      alert("예습 자료 생성 중 오류가 발생했습니다.");
    }
  };

  const handleGenerateReview = async (scheduleId: string) => {
    if (!courseId) return;
    try {
      await generateReviewSummary(courseId, scheduleId);
      alert("복습 자료 생성 요청이 성공적으로 전송되었습니다.");
      // Refresh
      const review = await getReviewSummary(courseId, scheduleId).catch(() => null);
      setSchedules(prev => prev.map(s => s.scheduleId === scheduleId ? { ...s, review } : s));
    } catch (e) {
      alert("복습 자료 생성 중 오류가 발생했습니다.");
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !courseId) return;

    setIsStartingConvert(true);
    try {
      const data = await uploadAudio(courseId, file);
      setAudioTask({
        audioId: data.audioId,
        fileName: data.fileName,
        status: data.status,
        transcriptPreview: null,
        createdAt: new Date().toISOString(),
      });
      setActiveTab("scripts");
    } catch (error) {
      console.error(error);
      alert("음성 변환 요청 중 오류가 발생했습니다.");
    } finally {
      setIsStartingConvert(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !courseId) return;

    setIsUploadingScript(true);
    try {
      const res = await uploadScript(courseId, { 
        file, 
        title: file.name 
      });

      const newScript = {
        id: res.scriptId,
        scheduleId: null,
        title: file.name,
        format: (file.name.split(".").pop() || "문서").toUpperCase(),
        uploadDate: new Date().toLocaleDateString(),
        status: "analyzing",
        progress: 0,
        issues: 0,
      };
      setScripts((prev) => [newScript, ...prev]);

      alert("강의 자료가 성공적으로 업로드되어 AI 분석이 시작되었습니다!");
      setActiveTab("scripts");
    } catch (error) {
      console.error(error);
      alert("강의 자료 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingScript(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleOpenPostAnalysis = async (scriptId: string, scriptTitle: string) => {
    if (!courseId) return;
    setPostAnalysisSheet({ open: true, scriptId, scriptTitle, analyses: [], loading: true, triggering: null });
    try {
      const data = await getPostAnalyses(courseId, scriptId);
      setPostAnalysisSheet((prev) => ({ ...prev, analyses: data.postAnalyses, loading: false }));
    } catch {
      setPostAnalysisSheet((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleTriggerAnalysis = async (type: "structure" | "concepts") => {
    const { scriptId } = postAnalysisSheet;
    if (!courseId || !scriptId) return;
    setPostAnalysisSheet((prev) => ({ ...prev, triggering: type }));
    try {
      if (type === "structure") {
        await triggerStructureAnalysis(courseId, scriptId);
      } else {
        await triggerConceptsAnalysis(courseId, scriptId);
      }
      // 잠시 후 결과 폴링
      await new Promise((r) => setTimeout(r, 1500));
      const data = await getPostAnalyses(courseId, scriptId);
      setPostAnalysisSheet((prev) => ({ ...prev, analyses: data.postAnalyses, triggering: null }));
    } catch {
      setPostAnalysisSheet((prev) => ({ ...prev, triggering: null }));
    }
  };

  const previewMaterials = schedules
    .filter((s) => s.preview !== null)
    .map((s) => ({
      id: s.preview!.previewGuideId,
      week: `${s.weekNumber}주차`,
      title: s.preview!.title || `${s.weekNumber}주차 예습 가이드`,
      status: s.preview!.status === "completed" ? "published" : s.preview!.status,
      lastModified: new Date(s.preview!.createdAt).toLocaleDateString("ko-KR"),
    }));

  const reviewMaterials = schedules
    .filter((s) => s.review !== null)
    .map((s) => ({
      id: s.review!.reviewSummaryId,
      week: `${s.weekNumber}주차`,
      title: s.review!.title || `${s.weekNumber}주차 복습 요약`,
      status: s.review!.status === "completed" ? "published" : s.review!.status,
      lastModified: new Date(s.review!.createdAt).toLocaleDateString("ko-KR"),
    }));

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      <CourseInfoBanner />

      {/* AI 분석 카드 */}
      <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                {"AI 강의 자료 분석"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {
                  "강의 자료를 업로드하면 AI가 구조적 허점을 분석하고 보완점을 제안합니다."
                }
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              type="file"
              ref={scriptInputRef}
              className="hidden"
              accept=".pdf,.pptx,.docx,.txt"
              onChange={handleScriptUpload}
            />
            <input
              type="file"
              ref={audioInputRef}
              className="hidden"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/ogg"
              onChange={handleAudioUpload}
            />

            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-2"
              onClick={() => scriptInputRef.current?.click()}
              disabled={isUploadingScript || !courseId}
            >
              <FileUp className="size-4" />
              {isUploadingScript ? "업로드 중..." : "강의 자료 업로드"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-2"
              onClick={() => audioInputRef.current?.click()}
              disabled={isStartingConvert || !courseId}
            >
              <Mic className="size-4" />
              {isStartingConvert ? "요청 중..." : "음성 변환"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {audioTask && (
        <Card className="border-border/40">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm text-muted-foreground">
              {"음성 변환: "}
              {audioTask.fileName}
              {" · "}
              {audioTask.status === "COMPLETED" ? "완료" : "처리 중"}
            </p>
            {audioTask.transcriptPreview && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {audioTask.transcriptPreview}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preview">{"예습 자료"}</TabsTrigger>
          <TabsTrigger value="review">{"복습 자료"}</TabsTrigger>
          <TabsTrigger value="scripts">{"강의 자료"}</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="flex flex-col gap-3">
            {previewMaterials.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {"생성된 예습 자료가 없습니다."}
              </p>
            )}
            {previewMaterials.map((material) => (
              <Card key={material.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          material.status === "published"
                            ? "bg-emerald-500/10"
                            : material.status === "generating"
                              ? "bg-primary/10"
                              : "bg-amber-500/10"
                        }`}
                      >
                        {material.status === "published" ? (
                          <CheckCircle className="size-5 text-emerald-500" />
                        ) : material.status === "generating" ? (
                          <Clock className="size-5 text-primary" />
                        ) : (
                          <AlertTriangle className="size-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.week}
                          </Badge>
                          <Badge
                            variant={material.status === "published" ? "default" : "secondary"}
                            className={`text-xs ${material.status === "published" ? "bg-emerald-500" : ""}`}
                          >
                            {material.status === "published"
                              ? "완료"
                              : material.status === "generating"
                                ? "생성 중"
                                : "실패"}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {material.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {material.lastModified}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 size-4" />
                          {"미리보기"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="flex flex-col gap-3">
            {reviewMaterials.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {"생성된 복습 자료가 없습니다."}
              </p>
            )}
            {reviewMaterials.map((material) => (
              <Card key={material.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          material.status === "published"
                            ? "bg-emerald-500/10"
                            : material.status === "generating"
                              ? "bg-primary/10"
                              : "bg-amber-500/10"
                        }`}
                      >
                        {material.status === "published" ? (
                          <CheckCircle className="size-5 text-emerald-500" />
                        ) : material.status === "generating" ? (
                          <Clock className="size-5 text-primary" />
                        ) : (
                          <AlertTriangle className="size-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.week}
                          </Badge>
                          <Badge
                            variant={material.status === "published" ? "default" : "secondary"}
                            className={`text-xs ${material.status === "published" ? "bg-emerald-500" : ""}`}
                          >
                            {material.status === "published"
                              ? "완료"
                              : material.status === "generating"
                                ? "생성 중"
                                : "실패"}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {material.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {material.lastModified}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 size-4" />
                          {"미리보기"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scripts" className="mt-4">
          <div className="flex flex-col gap-3">
            {scripts.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {"업로드된 스크립트가 없습니다."}
              </p>
            )}
            {scripts.map((script) => (
              <Card key={script.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {script.format}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {script.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {script.uploadDate}
                        </p>
                        {script.status === "analyzing" && (
                          <div className="mt-2 flex items-center gap-2">
                            <Progress
                              value={
                                simulatedProgress[script.id]?.progress || 0
                              }
                              className="h-1.5 flex-1"
                            />
                            <span className="w-10 text-right text-xs font-medium text-primary">
                              {simulatedProgress[script.id]?.progress || 0}%
                            </span>
                            <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                              {simulatedProgress[script.id]?.remaining || 45}초
                              남음
                            </span>
                          </div>
                        )}
                        {script.status === "completed" &&
                          script.issues &&
                          script.issues > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <AlertTriangle className="size-3 text-amber-500" />
                              <span className="text-amber-500">
                                {script.issues}
                                {"개의 보완점 발견"}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                    {script.status === "completed" && (
                      <div className="mt-3 flex flex-col items-end gap-2 sm:mt-0 sm:flex-row sm:justify-end">
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            onClick={() =>
                              handleGeneratePreview(script.scheduleId)
                            }
                            disabled={!script.scheduleId}
                          >
                            {"예습 자료 생성"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            onClick={() =>
                              handleGenerateReview(script.scheduleId)
                            }
                            disabled={!script.scheduleId}
                          >
                            {"복습 자료 생성"}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full sm:w-auto"
                          onClick={() => handleOpenPostAnalysis(script.id, script.title)}
                        >
                          {"수업 후 분석"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 수업 후 분석 시트 */}
      <Sheet
        open={postAnalysisSheet.open}
        onOpenChange={(open) => setPostAnalysisSheet((prev) => ({ ...prev, open }))}
      >
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">{"수업 후 분석"}</SheetTitle>
            <p className="text-sm text-muted-foreground line-clamp-1">{postAnalysisSheet.scriptTitle}</p>
          </SheetHeader>

          {postAnalysisSheet.loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {!postAnalysisSheet.loading && (
            <div className="flex flex-col gap-4">
              {/* 구조 분석 */}
              <PostAnalysisCard
                label="수업 흐름 구조 분석"
                type="structure"
                item={postAnalysisSheet.analyses.find((a) => a.analysisType === "structure") ?? null}
                triggering={postAnalysisSheet.triggering === "structure"}
                onTrigger={() => handleTriggerAnalysis("structure")}
              />
              {/* 개념어 체크 */}
              <PostAnalysisCard
                label="핵심 개념어 체크"
                type="concepts"
                item={postAnalysisSheet.analyses.find((a) => a.analysisType === "concepts") ?? null}
                triggering={postAnalysisSheet.triggering === "concepts"}
                onTrigger={() => handleTriggerAnalysis("concepts")}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── 수업 후 분석 카드 서브컴포넌트 ───────────────────────────────────────────

function PostAnalysisCard({
  label,
  type,
  item,
  triggering,
  onTrigger,
}: {
  label: string;
  type: "structure" | "concepts";
  item: PostAnalysisItem | null;
  triggering: boolean;
  onTrigger: () => void;
}) {
  const isPending = item?.status === "pending" || item?.status === "processing";

  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-foreground">{label}</h4>
          {!item || item.status === "failed" ? (
            <Button size="sm" onClick={onTrigger} disabled={triggering} className="gap-1.5">
              {triggering ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {triggering ? "분석 중..." : "분석 시작"}
            </Button>
          ) : isPending ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="size-3 animate-spin" />
              {"처리 중"}
            </Badge>
          ) : (
            <Badge className="bg-emerald-500 text-white">{"완료"}</Badge>
          )}
        </div>

        {item?.status === "failed" && (
          <p className="text-xs text-destructive">{item.errorMessage ?? "분석 실패"}</p>
        )}

        {isPending && (
          <p className="text-xs text-muted-foreground">{"AI가 분석 중입니다. 잠시 후 다시 확인하세요."}</p>
        )}

        {item?.status === "completed" && item.result && type === "structure" && (
          <div className="flex flex-col gap-2">
            {item.result.overall_comment && (
              <p className="text-sm text-muted-foreground">{item.result.overall_comment}</p>
            )}
            {item.result.flow_score !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{"흐름 점수"}</span>
                <Progress value={item.result.flow_score} className="h-1.5 flex-1" />
                <span className="text-xs font-medium">{item.result.flow_score}{"점"}</span>
              </div>
            )}
            {item.result.structure_map?.map((phase, i) => (
              <div key={i} className="rounded-lg bg-muted/50 p-3">
                <Badge variant="outline" className="mb-1 text-xs">{phase.phase}</Badge>
                <p className="text-xs text-foreground">{phase.description}</p>
                {phase.weakness && (
                  <p className="mt-1 text-xs text-amber-600">{"⚠ "}{phase.weakness}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {item?.status === "completed" && item.result && type === "concepts" && (
          <div className="flex flex-col gap-2">
            {item.result.overall_comment && (
              <p className="text-sm text-muted-foreground">{item.result.overall_comment}</p>
            )}
            {item.result.coverage_score !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{"개념 전달률"}</span>
                <Progress value={item.result.coverage_score} className="h-1.5 flex-1" />
                <span className="text-xs font-medium">{item.result.coverage_score}{"점"}</span>
              </div>
            )}
            {item.result.covered_concepts?.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${
                    c.coverage === "충분" ? "text-emerald-600" : c.coverage === "부족" ? "text-amber-600" : "text-destructive"
                  }`}
                >
                  {c.coverage}
                </Badge>
                <div>
                  <p className="text-xs font-medium text-foreground">{c.concept}</p>
                  <p className="text-xs text-muted-foreground">{c.note}</p>
                </div>
              </div>
            ))}
            {(item.result.missing_concepts?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-1 text-xs font-medium text-destructive">{"누락된 핵심 개념"}</p>
                <div className="flex flex-wrap gap-1">
                  {item.result.missing_concepts!.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-destructive">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!item && !triggering && (
          <p className="text-xs text-muted-foreground">{"아직 분석이 실행되지 않았습니다."}</p>
        )}
      </CardContent>
    </Card>
  );
}
