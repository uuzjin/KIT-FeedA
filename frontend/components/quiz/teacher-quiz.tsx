"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus,
  CheckCircle,
  Edit,
  MoreVertical,
  Play,
  Pause,
  BarChart3,
  Loader2,
  TrendingUp,
  AlertTriangle,
  ThumbsUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCourses,
  getCourseQuizzes,
  createQuiz,
  closeQuiz,
  getQuizComprehension,
  type Quiz,
  type Course,
  type ComprehensionReport,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

const LEVEL_CONFIG = {
  GOOD: { label: "양호", color: "text-emerald-500", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
  PARTIAL: { label: "부분 이해", color: "text-amber-500", bg: "bg-amber-500/10", bar: "bg-amber-500" },
  LOW: { label: "이해 부족", color: "text-destructive", bg: "bg-destructive/10", bar: "bg-destructive" },
};

export function TeacherQuiz() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("active");
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeQuizzes, setActiveQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<Quiz[]>([]);
  const [draftQuizzes, setDraftQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // 이해도 리포트 상태
  const [reportSheet, setReportSheet] = useState<{
    open: boolean;
    quiz: Quiz | null;
    report: ComprehensionReport | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, quiz: null, report: null, loading: false, error: null });

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadQuizzes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const coursesData = await getCourses();
        if (!mounted) return;

        const allActiveQuizzes: Quiz[] = [];
        const allCompletedQuizzes: Quiz[] = [];
        const allDraftQuizzes: Quiz[] = [];

        for (const course of coursesData.courses) {
          try {
            const [activeData, closedData, draftData] = await Promise.all([
              getCourseQuizzes(course.courseId, "PUBLISHED"),
              getCourseQuizzes(course.courseId, "CLOSED"),
              getCourseQuizzes(course.courseId, "DRAFT"),
            ]);
            allActiveQuizzes.push(...activeData.quizzes);
            allCompletedQuizzes.push(...closedData.quizzes);
            allDraftQuizzes.push(...draftData.quizzes);
          } catch (err) {
            console.error(`Failed to load quizzes for course ${course.courseId}:`, err);
          }
        }

        if (mounted) {
          setCourses(coursesData.courses);
          setActiveQuizzes(allActiveQuizzes);
          setCompletedQuizzes(allCompletedQuizzes);
          setDraftQuizzes(allDraftQuizzes);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "퀴즈 목록을 불러오지 못했습니다.";
        if (mounted) setError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadQuizzes();

    return () => { mounted = false; };
  }, [user?.id]);

  const handleCloseQuiz = async (courseId: string, quizId: string) => {
    try {
      await closeQuiz(courseId, quizId);
      const closed = activeQuizzes.find((q) => q.quizId === quizId);
      setActiveQuizzes((prev) => prev.filter((q) => q.quizId !== quizId));
      if (closed) setCompletedQuizzes((prev) => [closed, ...prev]);
    } catch (err) {
      console.error("Failed to close quiz:", err);
    }
  };

  const handleOpenReport = async (quiz: Quiz) => {
    setReportSheet({ open: true, quiz, report: null, loading: true, error: null });
    try {
      const report = await getQuizComprehension(quiz.courseId, quiz.quizId);
      setReportSheet((prev) => ({ ...prev, report, loading: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "리포트를 불러오지 못했습니다.";
      setReportSheet((prev) => ({ ...prev, loading: false, error: msg }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{"로딩 중..."}</p>
        </div>
      </div>
    );
  }

  const levelCfg = reportSheet.report ? LEVEL_CONFIG[reportSheet.report.level] : null;

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"퀴즈 관리"}</h1>
          <p className="text-sm text-muted-foreground">{"퀴즈 출제 및 결과 분석"}</p>
        </div>
        <Button className="gap-2" disabled={isCreating}>
          <Plus className="size-4" />
          {"새 퀴즈"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1">
            <Play className="size-3" />
            {"진행중"} ({activeQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="size-3" />
            {"완료"} ({completedQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1">
            <Edit className="size-3" />
            {"임시저장"} ({draftQuizzes.length})
          </TabsTrigger>
        </TabsList>

        {/* 진행중 탭 */}
        <TabsContent value="active" className="mt-4">
          {activeQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"진행 중인 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {activeQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40 border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{quiz.courseId}</Badge>
                          <Badge className="bg-emerald-500 text-xs">{"진행중"}</Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">{quiz.scheduleId || "퀴즈"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{quiz.questions.length}{"문항"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCloseQuiz(quiz.courseId, quiz.quizId)}>
                            <Pause className="mr-2 size-4" />
                            {"마감하기"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 완료 탭 — 리포트 버튼 연결 */}
        <TabsContent value="completed" className="mt-4">
          {completedQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"완료된 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {completedQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{quiz.courseId}</Badge>
                          <Badge variant="secondary" className="text-xs">{"완료"}</Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">{quiz.scheduleId || "퀴즈"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{quiz.questions.length}{"문항"}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleOpenReport(quiz)}>
                        <BarChart3 className="size-3.5" />
                        {"이해도 리포트"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 임시저장 탭 */}
        <TabsContent value="draft" className="mt-4">
          {draftQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"임시 저장된 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {draftQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                          <Edit className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{quiz.courseId}</Badge>
                          </div>
                          <p className="mt-1 font-medium text-foreground">{quiz.scheduleId || "퀴즈"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{quiz.questions.length}{"문항"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">{"수정"}</Button>
                        <Button size="sm">{"발행"}</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 이해도 리포트 시트 */}
      <Sheet
        open={reportSheet.open}
        onOpenChange={(open) => setReportSheet((prev) => ({ ...prev, open }))}
      >
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              {"이해도 리포트"}
            </SheetTitle>
          </SheetHeader>

          {reportSheet.loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {reportSheet.error && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="size-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">{reportSheet.error}</p>
              <p className="text-xs text-muted-foreground">{"아직 제출 데이터가 없거나 리포트를 불러올 수 없습니다."}</p>
            </div>
          )}

          {reportSheet.report && levelCfg && (
            <div className="flex flex-col gap-5">
              {/* 전체 이해도 */}
              <Card className={`border-0 ${levelCfg.bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {reportSheet.report.level === "GOOD" ? (
                      <ThumbsUp className="size-8 text-emerald-500" />
                    ) : reportSheet.report.level === "PARTIAL" ? (
                      <TrendingUp className="size-8 text-amber-500" />
                    ) : (
                      <AlertTriangle className="size-8 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">{"전체 평균 정답률"}</p>
                      <p className={`text-3xl font-bold ${levelCfg.color}`}>
                        {reportSheet.report.overallRate}
                        <span className="text-lg font-normal">{"%"}</span>
                      </p>
                      <Badge
                        className={`mt-1 ${
                          reportSheet.report.level === "GOOD"
                            ? "bg-emerald-500"
                            : reportSheet.report.level === "PARTIAL"
                            ? "bg-amber-500"
                            : "bg-destructive"
                        } text-white`}
                      >
                        {levelCfg.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {reportSheet.report.level === "GOOD"
                      ? "학생들이 전반적으로 수업 내용을 잘 이해하고 있습니다."
                      : reportSheet.report.level === "PARTIAL"
                      ? "일부 학생들이 어려움을 겪고 있습니다. 취약 개념을 복습하세요."
                      : "많은 학생이 이해에 어려움을 겪고 있습니다. 다음 수업에서 재설명이 필요합니다."}
                  </p>
                </CardContent>
              </Card>

              {/* 문항별 정답률 */}
              <div>
                <h3 className="mb-3 font-semibold text-foreground">{"문항별 정답률"}</h3>
                <div className="flex flex-col gap-3">
                  {reportSheet.report.topicBreakdown.map((item, idx) => {
                    const cfg = LEVEL_CONFIG[item.level];
                    return (
                      <Card key={idx} className="border-border/40">
                        <CardContent className="p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground line-clamp-2 flex-1 mr-2">
                              {item.topic}
                            </p>
                            <span className={`text-sm font-bold ${cfg.color} shrink-0`}>
                              {item.rate}%
                            </span>
                          </div>
                          <Progress value={item.rate} className="h-2" />
                          <Badge variant="outline" className={`mt-1.5 text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* 개선 제안 */}
              {reportSheet.report.level !== "GOOD" && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">{"다음 수업 개선 제안"}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {reportSheet.report.topicBreakdown
                        .filter((t) => t.level !== "GOOD")
                        .slice(0, 3)
                        .map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0">{"•"}</span>
                            <span>
                              <strong className="text-foreground">{t.topic.slice(0, 20)}{t.topic.length > 20 ? "..." : ""}</strong>
                              {" — 정답률 "}{t.rate}{"%. 복습 슬라이드 추가를 권장합니다."}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
