"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  Sparkles,
  Clock,
  CheckCircle,
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
  getCourses,
  getCourseSchedules,
  getPreviewGuide,
  getReviewSummary,
  getCourseScripts,
  uploadScript,
  uploadAudio,
  getAudio,
  type Course,
  type PreviewGuide,
  type ReviewSummary,
  type CourseScriptListItem,
  type AudioItem,
} from "@/lib/api";

type SchedulePreview = {
  scheduleId: string;
  weekNumber: number;
  topic: string;
  preview: PreviewGuide | null;
  review: ReviewSummary | null;
};

export function TeacherMaterials() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<SchedulePreview[]>([]);
  const [scripts, setScripts] = useState<CourseScriptListItem[]>([]);

  const [activeTab, setActiveTab] = useState("preview");
  const [audioTask, setAudioTask] = useState<(AudioItem & { taskId: string }) | null>(null);
  const [isStartingConvert, setIsStartingConvert] = useState(false);
  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const courseId = selectedCourseId ?? courses[0]?.courseId ?? null;

  // Load instructor's courses
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await getCourses();
        setCourses(res.courses ?? []);
      } catch (err) {
        console.error("강의 목록 로드 실패:", err);
      }
    };
    void loadCourses();
  }, []);

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
              getPreviewGuide(courseId, s.scheduleId).catch(() => null as PreviewGuide | null),
              getReviewSummary(courseId, s.scheduleId).catch(() => null as ReviewSummary | null),
            ]);
            return { scheduleId: s.scheduleId, weekNumber: s.weekNumber, topic: s.topic, preview, review };
          }),
        );

        setSchedules(scheduleData);
        setScripts(scriptsRes.scripts ?? []);
      } catch (err) {
        console.error("강의 자료 데이터 로드 실패:", err);
      }
    };

    void loadData();
  }, [courseId]);

  // Poll audio transcription status
  useEffect(() => {
    if (!audioTask || !courseId || audioTask.status === "COMPLETED" || audioTask.status === "FAILED") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const item = await getAudio(courseId, audioTask.taskId);
        setAudioTask((prev) =>
          prev ? { ...prev, status: item.status, transcriptPreview: item.transcriptPreview } : prev,
        );
        if (item.status === "COMPLETED" || item.status === "FAILED") {
          window.clearInterval(intervalId);
        }
      } catch {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [audioTask, courseId]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !courseId) return;

    setIsStartingConvert(true);
    try {
      const data = await uploadAudio(courseId, file);
      setAudioTask({
        audioId: data.audioId,
        taskId: data.audioId,
        courseId,
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
      await uploadScript(courseId, { file, title: file.name });
      alert("스크립트가 성공적으로 업로드되어 AI 분석이 시작되었습니다!");
      // Refresh scripts list
      const res = await getCourseScripts(courseId);
      setScripts(res.scripts ?? []);
      setActiveTab("scripts");
    } catch (error) {
      console.error(error);
      alert("스크립트 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingScript(false);
      if (e.target) e.target.value = "";
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
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"강의 자료"}</h1>
          <p className="text-sm text-muted-foreground">
            {"자료 업로드 및 AI 분석"}
          </p>
        </div>
        <Button className="gap-2">
          <Upload className="size-4" />
          {"업로드"}
        </Button>
      </div>

      {/* 강의 선택 */}
      {courses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {courses.map((c) => (
            <button
              key={c.courseId}
              onClick={() => setSelectedCourseId(c.courseId)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                courseId === c.courseId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c.courseName}
            </button>
          ))}
        </div>
      )}
      {!courseId && courses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {"담당 강의가 없습니다. 먼저 강의를 생성해 주세요."}
        </p>
      )}

      {/* AI 분석 카드 */}
      <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                {"AI 스크립트 분석"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {
                  "강의 스크립트를 업로드하면 AI가 구조적 허점을 분석하고 보완점을 제안합니다."
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
              {isUploadingScript ? "업로드 중..." : "스크립트 업로드"}
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
          <TabsTrigger value="scripts">{"스크립트"}</TabsTrigger>
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
                          <Edit className="size-5 text-amber-500" />
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
                          <FileText className="size-5 text-amber-500" />
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
            {scripts.map((script) => {
              const ext = script.fileName?.split(".").pop()?.toUpperCase() ?? "파일";
              const uploadedDate = script.uploadedAt
                ? new Date(script.uploadedAt).toLocaleDateString("ko-KR")
                : "-";
              return (
                <Card key={script.scriptId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {ext}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">
                          {script.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {uploadedDate}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
