"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Sparkles,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  MoreVertical,
  FileUp,
  Mic,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getAnalysisReport,
  getAudioConvertTask,
  uploadAudio,
  uploadScript,
  getCourseScripts,
  generatePreviewGuide,
  generateReviewSummary,
  type AnalysisReport,
} from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { useCourse } from "@/contexts/course-context";
import { CourseInfoBanner } from "@/components/layout/course-info-banner";

export function TeacherMaterials() {
  const { courses, selectedCourse, setSelectedCourse } = useCourse();
  const courseId = selectedCourse?.courseId;

  // TODO: 실제 환경에서는 백엔드 API를 호출하여 데이터를 설정해야 합니다.
  const [previewMaterials, setPreviewMaterials] = useState<any[]>([]);
  const [reviewMaterials, setReviewMaterials] = useState<any[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [simulatedProgress, setSimulatedProgress] = useState<
    Record<string, { progress: number; remaining: number }>
  >({});

  const [activeTab, setActiveTab] = useState("preview");
  const [audioTask, setAudioTask] = useState<any | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(
    null,
  );
  const [isStartingConvert, setIsStartingConvert] = useState(false);
  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!courseId) return;
    const fetchMaterialsData = async () => {
      try {
        // 1. 예습 자료 (preview_guides) 조회
        const { data: previewData, error: previewError } = await supabase
          .from("preview_guides")
          .select("*")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });

        if (previewError) {
          console.error(
            "❌ [Supabase 400 에러] 예습 자료 조회 실패:",
            previewError.message,
            previewError.details,
          );
        }

        if (!previewError && previewData) {
          setPreviewMaterials(
            previewData.map((p) => ({
              id: p.id,
              week: "주차 미정", // 필요 시 schedule_id와 조인하여 표시
              title: p.title || "제목 없는 예습 가이드",
              status: p.status === "completed" ? "published" : "draft",
              lastModified: new Date(p.created_at).toLocaleDateString(),
              aiAnalysis: null,
            })),
          );
        }

        // 2. 복습 자료 (review_summaries) 조회
        const { data: reviewData, error: reviewError } = await supabase
          .from("review_summaries")
          .select("*")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });

        if (reviewError) {
          console.error(
            "❌ [Supabase 400 에러] 복습 자료 조회 실패:",
            reviewError.message,
            reviewError.details,
          );
        }

        if (!reviewError && reviewData) {
          setReviewMaterials(
            reviewData.map((r) => ({
              id: r.id,
              week: "주차 미정",
              title: r.title || "제목 없는 복습 요약",
              status: r.status === "completed" ? "published" : "draft",
              downloads: 0,
              lastModified: new Date(r.created_at).toLocaleDateString(),
            })),
          );
        }

        // 3. 스크립트/음성 목록 조회 (백엔드 API 호출)
        try {
          const scriptData = await getCourseScripts(courseId);
          const list = scriptData.scripts;
          if (Array.isArray(list)) {
            setScripts(
              list.map((s: any) => ({
                id: s.scriptId || s.id,
                scheduleId: s.scheduleId || s.schedule_id,
                title: s.title || s.fileName || s.file_name || "업로드된 자료",
                format: (
                  (s.fileName || s.file_name || "").split(".").pop() || "문서"
                ).toUpperCase(),
                uploadDate: new Date(
                  s.uploadedAt || s.created_at || Date.now(),
                ).toLocaleDateString(),
                status: s.status === "completed" ? "completed" : "analyzing",
                progress: s.progress || 0,
                issues: s.issues_count || 0,
              })),
            );
          }
        } catch (e) {
          console.error("스크립트 목록 조회 실패:", e);
        }
      } catch (error) {
        console.error("강의 자료 데이터를 불러오는 중 오류 발생:", error);
      }
    };

    void fetchMaterialsData();

    const loadReport = async () => {
      try {
        const report = await getAnalysisReport();
        setAnalysisReport(report);
      } catch {
        // fallback to local demo
      }
    };
    void loadReport();
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !audioTask || audioTask.status === "completed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const task = await getAudioConvertTask(
          courseId,
          audioTask.audioId || audioTask.task_id,
        );
        setAudioTask(task);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [audioTask, courseId]);

  // ── 스크립트 상태 폴링 (진행 중인 분석이 있을 때만 5초마다 갱신) ──
  useEffect(() => {
    const hasAnalyzing = scripts.some((s) => s.status === "analyzing");
    if (!hasAnalyzing || !courseId) return;

    const interval = setInterval(async () => {
      try {
        const scriptData = await getCourseScripts(courseId);
        const list = scriptData.scripts;
        if (Array.isArray(list)) {
          setScripts(
            list.map((s: any) => ({
              id: s.scriptId || s.id,
              scheduleId: s.scheduleId || s.schedule_id,
              title: s.title || s.fileName || s.file_name || "업로드된 자료",
              format: (
                (s.fileName || s.file_name || "").split(".").pop() || "문서"
              ).toUpperCase(),
              uploadDate: new Date(
                s.uploadedAt || s.created_at || Date.now(),
              ).toLocaleDateString(),
              status: s.status === "completed" ? "completed" : "analyzing",
              progress: s.progress || 0,
              issues: s.issues_count || 0,
            })),
          );
        }
      } catch (e) {
        console.error("스크립트 폴링 실패:", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [scripts, courseId]);

  // ── 남은 시간 시뮬레이션 및 퍼센트 게이지 애니메이션 ──
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
              ), // 1~3% 랜덤 상승 (최대 99%)
              remaining: Math.max(1, current.remaining - 1), // 1초씩 감소
            };
          });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scripts]);

  const handleGeneratePreview = async (scheduleId: string | null) => {
    if (!courseId) return;
    try {
      await generatePreviewGuide(courseId, scheduleId || "default");
      alert("예습 자료 생성 요청이 성공적으로 전송되었습니다.");
    } catch (e) {
      alert("예습 자료 생성 중 오류가 발생했습니다.");
    }
  };

  const handleGenerateReview = async (scheduleId: string | null) => {
    if (!courseId) return;
    try {
      await generateReviewSummary(courseId, scheduleId || "default");
      alert("복습 자료 생성 요청이 성공적으로 전송되었습니다.");
    } catch (e) {
      alert("복습 자료 생성 중 오류가 발생했습니다.");
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsStartingConvert(true);
    try {
      const data = await uploadAudio(courseId as string, file);

      // 백엔드 응답을 프론트엔드 상태에 맞게 매핑
      setAudioTask({
        audioId: data.audioId,
        file_name: file.name,
        status: data.status,
        progress: 0,
        transcript_preview: null,
      });
      setActiveTab("scripts");
    } catch (error) {
      console.error(error);
      alert("음성 변환 요청 중 오류가 발생했습니다.");
    } finally {
      setIsStartingConvert(false);
      if (e.target) e.target.value = ""; // input 초기화
    }
  };

  // ── 2. 스크립트 업로드 및 AI 분석 로직 연결 ──
  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScript(true);

    try {
      const res = await uploadScript(courseId as string, {
        file,
        title: file.name,
      });

      // 방금 업로드한 스크립트를 목록 최상단에 즉시 추가하여 애니메이션을 바로 시작시킵니다.
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
      if (e.target) e.target.value = ""; // input 초기화
    }
  };

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
            {/* 숨겨진 파일 입력 필드 */}
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
              disabled={isUploadingScript}
            >
              <FileUp className="size-4" />
              {isUploadingScript ? "업로드 중..." : "강의 자료 업로드"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-2"
              onClick={() => audioInputRef.current?.click()}
              disabled={isStartingConvert}
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
              {audioTask.file_name}
              {" · "}
              {audioTask.status === "completed" ? "완료" : "처리 중"}
            </p>
            {audioTask.transcript_preview && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {audioTask.transcript_preview}
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
            {previewMaterials.map((material) => (
              <Card key={material.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          material.status === "published"
                            ? "bg-emerald-500/10"
                            : "bg-amber-500/10"
                        }`}
                      >
                        {material.status === "published" ? (
                          <CheckCircle className="size-5 text-emerald-500" />
                        ) : (
                          <Edit className="size-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.week}
                          </Badge>
                          <Badge
                            variant={
                              material.status === "published"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-xs ${material.status === "published" ? "bg-emerald-500" : ""}`}
                          >
                            {material.status === "published"
                              ? "발행됨"
                              : "임시저장"}
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
                        <DropdownMenuItem>
                          <Edit className="mr-2 size-4" />
                          {"수정"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {material.aiAnalysis && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 p-2">
                      <Sparkles className="size-4 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {"AI 분석 점수:"}
                      </span>
                      <span
                        className={`text-xs font-semibold ${material.aiAnalysis.score >= 90 ? "text-emerald-500" : "text-amber-500"}`}
                      >
                        {material.aiAnalysis.score}
                        {"점"}
                      </span>
                      {material.aiAnalysis.issues > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto text-xs"
                        >
                          {material.aiAnalysis.issues}
                          {"개 개선점"}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="flex flex-col gap-3">
            {reviewMaterials.map((material) => (
              <Card key={material.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
                        <FileText className="size-5 text-emerald-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.week}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {material.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {"다운로드 "}
                          {material.downloads}
                          {"회 · "}
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
                        <DropdownMenuItem>
                          <Edit className="mr-2 size-4" />
                          {"수정"}
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
            {scripts.map((script) => (
              <Card key={script.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl ${
                          script.status === "completed"
                            ? "bg-emerald-500/10"
                            : "bg-primary/10"
                        }`}
                      >
                        {script.status === "completed" ? (
                          <CheckCircle className="size-5 text-emerald-500" />
                        ) : (
                          <Clock className="size-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {script.format}
                          </Badge>
                          <Badge
                            variant={
                              script.status === "completed"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-xs ${script.status === "completed" ? "bg-emerald-500" : ""}`}
                          >
                            {script.status === "completed"
                              ? "분석 완료"
                              : "분석 중"}
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
                      <div className="mt-3 flex flex-col items-end gap-2 sm:mt-0 sm:flex-row">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleGeneratePreview(script.scheduleId)
                            }
                          >
                            {"예습 자료 생성"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleGenerateReview(script.scheduleId)
                            }
                          >
                            {"복습 자료 생성"}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full sm:w-auto"
                        >
                          {"리포트 보기"}
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
    </div>
  );
}
