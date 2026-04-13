"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  BookOpen,
  CheckCircle,
  FileText,
  HelpCircle,
  TrendingUp,
  Calendar,
  Star,
  Play,
  Loader2,
  AlertCircle,
  ArrowRight,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getStudentQuizHistory,
  getStudentMaterials,
  QuizSubmissionHistory,
  StudentMaterialItem,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCourse } from "@/contexts/course-context";
import { CourseInfoBanner } from "@/components/layout/course-info-banner";

// 날짜를 "N일 전", "오늘" 등으로 변환
function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function StudentDashboard() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { selectedCourse } = useCourse();
  const [quizHistory, setQuizHistory] = useState<QuizSubmissionHistory[]>([]);
  const [materials, setMaterials] = useState<StudentMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllWrongAnswers, setShowAllWrongAnswers] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedCourse?.courseId) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [quizRes, materialsRes] = await Promise.allSettled([
          getStudentQuizHistory(selectedCourse.courseId),
          getStudentMaterials(selectedCourse.courseId),
        ]);

        setQuizHistory(
          quizRes.status === "fulfilled" ? quizRes.value.history || [] : [],
        );
        setMaterials(
          materialsRes.status === "fulfilled"
            ? materialsRes.value.materials || []
            : [],
        );

        if (
          quizRes.status === "rejected" ||
          materialsRes.status === "rejected"
        ) {
          setError(
            "일부 데이터를 불러오지 못했습니다. 백엔드 상태를 확인해주세요.",
          );
        }
      } catch (err) {
        setError("대시보드 데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [isAuthLoading, user, selectedCourse?.courseId]);

  // 계산된 통계
  const stats = useMemo(() => {
    const totalParticipated = quizHistory.length;
    const averageScore =
      totalParticipated > 0
        ? Math.round(
            quizHistory.reduce((sum, h) => sum + h.score, 0) /
              totalParticipated,
          )
        : 0;

    return {
      totalParticipated,
      averageScore,
      materialsCount: materials.length,
      coursesCount: new Set(quizHistory.map((h) => h.courseId)).size,
    };
  }, [quizHistory, materials]);

  const weeklyStats = useMemo(() => {
    return [
      {
        label: "참여 퀴즈",
        value: stats.totalParticipated.toString(),
        icon: HelpCircle,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        label: "평균 점수",
        value: `${stats.averageScore}%`,
        icon: TrendingUp,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
      },
      {
        label: "학습 자료",
        value: materials.length.toString(),
        icon: FileText,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
      {
        label: "수강 과목",
        value: stats.coursesCount.toString(),
        icon: BookOpen,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
      },
    ];
  }, [stats, materials.length]);

  const recentQuizzes = useMemo(() => {
    return quizHistory.slice(0, 3).map((submission) => ({
      submissionId: submission.submissionId,
      courseId: submission.courseId,
      score: submission.score,
      correctCount: submission.correctCount,
      totalCount: submission.totalCount,
      submittedAt: submission.submittedAt,
      wrongAnswerCount: submission.wrongAnswers?.length || 0,
    }));
  }, [quizHistory]);

  // 오답 복습 — 최근 퀴즈에서 틀린 문제 수집
  const wrongAnswers = useMemo(() => {
    return quizHistory
      .slice(0, 5)
      .flatMap((sub) =>
        (sub.wrongAnswers || []).map((wa) => ({
          ...wa,
          submittedAt: sub.submittedAt,
          quizScore: sub.score,
        })),
      )
      .slice(0, 10);
  }, [quizHistory]);

  // 자료 타임라인 — 날짜 기준 그룹화
  const materialsTimeline = useMemo(() => {
    const sorted = [...materials].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const groups = new Map<string, StudentMaterialItem[]>();
    sorted.forEach((m) => {
      const label = relativeDate(m.createdAt);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(m);
    });

    return Array.from(groups.entries()).slice(0, 4); // 최대 4개 그룹
  }, [materials]);

  const courseProgress = useMemo(() => {
    const courseMap = new Map<
      string,
      { courseId: string; quizzes: number; avgScore: number }
    >();

    quizHistory.forEach((submission) => {
      if (!courseMap.has(submission.courseId)) {
        courseMap.set(submission.courseId, {
          courseId: submission.courseId,
          quizzes: 0,
          avgScore: 0,
        });
      }
      const course = courseMap.get(submission.courseId)!;
      course.quizzes += 1;
      course.avgScore =
        (course.avgScore * (course.quizzes - 1) + submission.score) /
        course.quizzes;
    });

    return Array.from(courseMap.values()).map((course) => ({
      courseId: course.courseId,
      progress: Math.min(100, course.quizzes * 20),
      quizzes: course.quizzes,
      averageScore: Math.round(course.avgScore),
    }));
  }, [quizHistory]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 pb-24">
      <CourseInfoBanner />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>오류 발생</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 주요 액션 버튼 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card
          className="group cursor-pointer border-border/40 bg-linear-to-br from-blue-500/10 to-blue-600/5 shadow-sm transition-all hover:from-blue-500/20 hover:to-blue-600/10 hover:shadow-lg hover:border-blue-400/50"
          onClick={() => router.push("/quiz")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/20 transition-all group-hover:scale-110 group-hover:bg-blue-500/30">
                <Play className="size-6 text-blue-600 group-hover:text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-blue-600">
                  퀴즈 시작
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  새로운 퀴즈에 도전하세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="group cursor-pointer border-border/40 bg-linear-to-br from-emerald-500/10 to-emerald-600/5 shadow-sm transition-all hover:from-emerald-500/20 hover:to-emerald-600/10 hover:shadow-lg hover:border-emerald-400/50"
          onClick={() => router.push("/materials")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/20 transition-all group-hover:scale-110 group-hover:bg-emerald-500/30">
                <BookOpen className="size-6 text-emerald-600 group-hover:text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-emerald-600">
                  학습 자료
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  강의 자료를 확인하세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 주간 통계 */}
      {selectedCourse?.courseId && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push(`/courses/${selectedCourse.courseId}`)}
          >
            강의 상세 보기
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {"나의 학습 현황"}
        </h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {weeklyStats.map((stat) => (
              <Card
                key={stat.label}
                className="min-w-[140px] shrink-0 border-border/40"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}
                  >
                    <stat.icon className={`size-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      {/* 최근 퀴즈 결과 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {"최근 퀴즈 결과"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
          >
            {"모두 보기"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {recentQuizzes.length > 0 ? (
            recentQuizzes.map((quiz) => (
              <Card key={quiz.submissionId} className="border-border/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        quiz.score >= 80
                          ? "bg-emerald-500/10"
                          : quiz.score >= 60
                            ? "bg-amber-500/10"
                            : "bg-red-500/10"
                      }`}
                    >
                      <HelpCircle
                        className={`size-5 ${
                          quiz.score >= 80
                            ? "text-emerald-500"
                            : quiz.score >= 60
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {quiz.courseId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`${quiz.correctCount}/${quiz.totalCount} 정답`}
                        {quiz.wrongAnswerCount > 0 && (
                          <span className="ml-2 text-red-500">
                            {`오답 ${quiz.wrongAnswerCount}개`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        quiz.score >= 80
                          ? "default"
                          : quiz.score >= 60
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {quiz.score}점
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quiz.submittedAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                {"최근 퀴즈 결과가 없습니다."}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* 오답 복습 */}
      {wrongAnswers.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {"오답 복습"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-primary"
              onClick={() => setShowAllWrongAnswers((v) => !v)}
            >
              {showAllWrongAnswers ? (
                <>
                  {"접기"}
                  <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  {`전체 ${wrongAnswers.length}개`}
                  <ChevronDown className="size-3" />
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {(showAllWrongAnswers ? wrongAnswers : wrongAnswers.slice(0, 3)).map(
              (wa, idx) => (
                <Card
                  key={`${wa.questionId}-${idx}`}
                  className="border-red-200/40 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                        <XCircle className="size-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {wa.content && (
                          <p className="text-sm font-medium text-foreground line-clamp-2">
                            {wa.content}
                          </p>
                        )}
                        <div className="mt-2 flex flex-col gap-1">
                          {wa.selectedOption && (
                            <p className="text-xs text-red-500">
                              {"내 답: "}
                              <span className="font-medium">
                                {wa.selectedOption}
                              </span>
                            </p>
                          )}
                          {wa.correctAnswer && (
                            <p className="text-xs text-emerald-600">
                              {"정답: "}
                              <span className="font-medium">
                                {wa.correctAnswer}
                              </span>
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {relativeDate(wa.submittedAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </section>
      )}

      {/* 예습/복습 자료 타임라인 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {"학습 자료 타임라인"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            onClick={() => router.push("/materials")}
          >
            {"모두 보기"}
          </Button>
        </div>

        {materialsTimeline.length > 0 ? (
          <div className="relative flex flex-col gap-0 pl-4">
            {/* 세로 타임라인 선 */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
            {materialsTimeline.map(([dateLabel, items], groupIdx) => (
              <div key={dateLabel} className="relative mb-4 last:mb-0">
                {/* 타임라인 점 */}
                <div className="absolute -left-4 top-1 flex size-4 items-center justify-center">
                  <div
                    className={`size-2 rounded-full ${groupIdx === 0 ? "bg-primary" : "bg-border"}`}
                  />
                </div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {dateLabel}
                </p>
                <div className="flex flex-col gap-2">
                  {items.map((material) => (
                    <Card
                      key={material.id}
                      className="border-border/40"
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            material.type === "PREVIEW"
                              ? "bg-blue-500/10"
                              : "bg-violet-500/10"
                          }`}
                        >
                          {material.type === "PREVIEW" ? (
                            <Star
                              className="size-4 text-blue-500"
                            />
                          ) : (
                            <CheckCircle className="size-4 text-violet-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {material.title}
                          </p>
                        </div>
                        <Badge
                          variant={
                            material.type === "PREVIEW"
                              ? "default"
                              : "secondary"
                          }
                          className="shrink-0 text-xs"
                        >
                          {material.type === "PREVIEW" ? "예습" : "복습"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-border/40">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              {"학습 자료가 없습니다."}
            </CardContent>
          </Card>
        )}
      </section>

      {/* 과목별 진도 */}
      <section>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="size-4 text-primary" />
              {"과목별 학습 진도"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {courseProgress.length > 0 ? (
                courseProgress.map((course) => (
                  <div key={course.courseId}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {course.courseId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {"평균 "}
                        {course.averageScore}
                        {"% · 퀴즈 "}
                        {course.quizzes}
                        {"회"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={course.progress}
                        className="h-2 flex-1"
                      />
                      <span className="w-10 text-right text-xs font-medium text-primary">
                        {Math.min(100, course.progress)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {"진행 중인 과목이 없습니다."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
