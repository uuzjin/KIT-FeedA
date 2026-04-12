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
  createAudioConvertTask,
  getAnalysisReport,
  getAudioConvertTask,
  type AnalysisReport,
  type AudioConvertTask,
} from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

const previewMaterials = [
  {
    id: 1,
    week: "3주차",
    title: "SQL 기초 - SELECT 구문",
    status: "draft",
    lastModified: "2시간 전",
    aiAnalysis: { score: 85, issues: 2 },
  },
  {
    id: 2,
    week: "4주차",
    title: "정규화 이론",
    status: "published",
    lastModified: "3일 전",
    aiAnalysis: { score: 92, issues: 0 },
  },
];

const reviewMaterials = [
  {
    id: 1,
    week: "1주차",
    title: "데이터베이스 개요 복습",
    status: "published",
    downloads: 42,
    lastModified: "1주 전",
  },
  {
    id: 2,
    week: "2주차",
    title: "관계형 모델 정리",
    status: "published",
    downloads: 38,
    lastModified: "4일 전",
  },
];

const scripts = [
  {
    id: 1,
    title: "3주차 강의 스크립트",
    format: "PDF",
    uploadDate: "오늘",
    status: "analyzing",
    progress: 65,
  },
  {
    id: 2,
    title: "2주차 슬라이드 노트",
    format: "PPTX",
    uploadDate: "3일 전",
    status: "completed",
    issues: 3,
  },
];

export function TeacherMaterials() {
  const [activeTab, setActiveTab] = useState("preview");
  const [audioTask, setAudioTask] = useState<AudioConvertTask | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(
    null,
  );
  const [isStartingConvert, setIsStartingConvert] = useState(false);
  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // TODO: 실제 환경에서는 라우터 파라미터나 상태 관리에서 현재 강의 ID를 가져와야 합니다.
  const courseId = "crs_001";

  useEffect(() => {
    const loadReport = async () => {
      try {
        const report = await getAnalysisReport();
        setAnalysisReport(report);
      } catch {
        // fallback to local demo
      }
    };
    void loadReport();
  }, []);

  useEffect(() => {
    if (!audioTask || audioTask.status === "completed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const task = await getAudioConvertTask(audioTask.task_id);
        setAudioTask(task);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [audioTask]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsStartingConvert(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      // Supabase 세션에서 유효한 JWT 토큰 가져오기
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // api.ts 대신 직접 fetch를 사용하여 FormData 전송
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/courses/${courseId}/audios`,
        {
          method: "POST",
          body: formData,
          headers,
        },
      );
      if (!res.ok) throw new Error("오디오 업로드 실패");

      const data = await res.json();
      // 백엔드 응답을 프론트엔드 상태에 맞게 매핑
      setAudioTask({
        task_id: data.audioId,
        file_name: data.fileName,
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name); // 백엔드에서 title을 필수로 요구함

    try {
      // Supabase 세션에서 유효한 JWT 토큰 가져오기
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/courses/${courseId}/scripts`,
        {
          method: "POST",
          body: formData,
          headers,
        },
      );
      if (!res.ok) throw new Error("스크립트 업로드 실패");

      alert("스크립트가 성공적으로 업로드되어 AI 분석이 시작되었습니다!");
      setActiveTab("scripts");
    } catch (error) {
      console.error(error);
      alert("스크립트 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingScript(false);
      if (e.target) e.target.value = ""; // input 초기화
    }
  };

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
              {isUploadingScript ? "업로드 중..." : "스크립트 업로드"}
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

      {(audioTask || analysisReport) && (
        <Card className="border-border/40">
          <CardContent className="space-y-2 p-4">
            {audioTask && (
              <p className="text-sm text-muted-foreground">
                {"음성 변환: "}
                {audioTask.file_name}
                {" · "}
                {audioTask.progress}%{" ("}
                {audioTask.status}
                {")"}
              </p>
            )}
            {analysisReport && (
              <p className="text-sm text-muted-foreground">
                {"분석 리포트: "}
                {analysisReport.source_file}
                {" · 논리 허점 "}
                {analysisReport.logical_gaps}
                {"개"}
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
                              value={script.progress}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-muted-foreground">
                              {script.progress}%
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
                      <Button size="sm" variant="outline">
                        {"리포트 보기"}
                      </Button>
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
