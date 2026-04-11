"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle,
  Play,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Award,
  Target,
  Loader2,
} from "lucide-react";
import {
  getCourses,
  getCourseQuizzes,
  getStudentQuizHistory,
  type Quiz,
  type QuizSubmissionHistory,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function StudentQuiz() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("available");
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<QuizSubmissionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadQuizzes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 수강 강의 목록 조회
        const coursesData = await getCourses();
        
        if (!mounted) return;

        // 각 강의의 응시 가능한 퀴즈 조회
        const allAvailableQuizzes: Quiz[] = [];
        for (const course of coursesData.courses) {
          try {
            const quizzesData = await getCourseQuizzes(course.courseId, "PUBLISHED");
            allAvailableQuizzes.push(...quizzesData.quizzes);
          } catch (err) {
            console.error(`Failed to load quizzes for course ${course.courseId}:`, err);
          }
        }

        // 완료한 퀴즈 조회
        const historyData = await getStudentQuizHistory();
        
        if (mounted) {
          setAvailableQuizzes(allAvailableQuizzes);
          setCompletedQuizzes(historyData.history);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "퀴즈 목록을 불러오지 못했습니다.";
        if (mounted) setError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadQuizzes();

    return () => {
      mounted = false;
    };
  }, []);

  const avgScore = completedQuizzes.length > 0
    ? Math.round(
        completedQuizzes.reduce((sum, q) => sum + q.score, 0) / completedQuizzes.length
      )
    : 0;

  const maxScore = completedQuizzes.length > 0
    ? Math.max(...completedQuizzes.map((q) => q.score))
    : 0;

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

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"퀴즈"}</h1>
        <p className="text-sm text-muted-foreground">{"퀴즈에 참여하고 실력을 확인하세요"}</p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 학습 현황 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <div className="flex size-8 mx-auto items-center justify-center rounded-lg bg-primary/10">
              <Target className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{"참여 퀴즈"}</p>
            <p className="text-lg font-bold text-foreground">{completedQuizzes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <div className="flex size-8 mx-auto items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{"평균 점수"}</p>
            <p className="text-lg font-bold text-emerald-500">{avgScore}{"점"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <div className="flex size-8 mx-auto items-center justify-center rounded-lg bg-amber-500/10">
              <Award className="size-4 text-amber-500" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{"최고 점수"}</p>
            <p className="text-lg font-bold text-amber-500">{maxScore}{"점"}</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available" className="gap-2">
            <Play className="size-4" />
            {"응시 가능"} ({availableQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="size-4" />
            {"완료"} ({completedQuizzes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          <div className="flex flex-col gap-3">
            {availableQuizzes.length === 0 ? (
              <Card className="border-border/40">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="mx-auto size-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {"현재 응시 가능한 퀴즈가 없습니다."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              availableQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40 border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {quiz.courseId}
                          </Badge>
                          {quiz.expiresAt && new Date(quiz.expiresAt) < new Date() === false && (
                            <Badge variant="destructive" className="text-xs">
                              {"마감 임박"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 font-medium text-foreground">
                          {quiz.scheduleId || "퀴즈"}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="size-3" />
                            {quiz.questions.length}{"문항"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      {quiz.expiresAt && (
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="size-4 text-amber-500" />
                          <span className="text-amber-500">
                            {"마감: "}
                            {new Date(quiz.expiresAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                      )}
                      <Button className="gap-2" disabled={quiz.status !== "PUBLISHED"}>
                        <Play className="size-4" />
                        {"응시하기"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <CheckCircle className="mx-auto size-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {"완료한 퀴즈가 없습니다."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {completedQuizzes.map((quiz) => (
                <Card key={quiz.submissionId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {quiz.courseId}
                          </Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">
                          {quiz.quizId || "퀴즈"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(quiz.submittedAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-2xl font-bold ${
                            quiz.score >= 80
                              ? "text-emerald-500"
                              : quiz.score >= 60
                                ? "text-amber-500"
                                : "text-destructive"
                          }`}
                        >
                          {Math.round(quiz.score)}
                          <span className="text-sm text-muted-foreground">{"점"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {quiz.correctCount}/{quiz.totalCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Progress
                        value={quiz.score}
                        className="h-2"
                      />
                    </div>

                    {quiz.wrongAnswers && quiz.wrongAnswers.length > 0 && (
                      <div className="mt-3 rounded-lg bg-amber-500/10 p-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-amber-500" />
                          <span className="text-xs font-medium text-amber-700">
                            {"오답 "}{quiz.wrongAnswers.length}{"개"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        {"오답 복습"}
                      </Button>
                      <Button size="sm" variant="ghost">
                        {"상세 결과"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
