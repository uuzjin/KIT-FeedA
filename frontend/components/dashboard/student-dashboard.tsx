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
} from "lucide-react";
import {
  getStudentQuizHistory,
  getStudentMaterials,
  QuizSubmissionHistory,
  StudentMaterialItem,
} from "@/lib/api";

export function StudentDashboard() {
  const router = useRouter();
  const [quizHistory, setQuizHistory] = useState<QuizSubmissionHistory[]>([]);
  const [materials, setMaterials] = useState<StudentMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [quizData, materialsData] = await Promise.all([
          getStudentQuizHistory(),
          getStudentMaterials(),
        ]);
        setQuizHistory(quizData.history || []);
        setMaterials(materialsData.materials || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "대시보드 데이터를 불러오지 못했습니다.";
        setError(message);
        setQuizHistory([]);
        setMaterials([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  // 계산된 통계
  const stats = useMemo(() => {
    const totalParticipated = quizHistory.length;
    const averageScore = totalParticipated > 0
      ? Math.round(quizHistory.reduce((sum, h) => sum + h.score, 0) / totalParticipated)
      : 0;

    return {
      totalParticipated,
      averageScore,
      materialsCount: materials.length,
      coursesCount: new Set(quizHistory.map(h => h.courseId)).size,
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

  const studyMaterials = useMemo(() => {
    return materials.slice(0, 3);
  }, [materials]);

  const courseProgress = useMemo(() => {
    const courseMap = new Map<string, { courseId: string; quizzes: number; avgScore: number }>();

    quizHistory.forEach((submission) => {
      if (!courseMap.has(submission.courseId)) {
        courseMap.set(submission.courseId, { 
          courseId: submission.courseId, 
          quizzes: 0, 
          avgScore: 0 
        });
      }
      const course = courseMap.get(submission.courseId)!;
      course.quizzes += 1;
      course.avgScore = (course.avgScore * (course.quizzes - 1) + submission.score) / course.quizzes;
    });

    return Array.from(courseMap.values()).map((course) => ({
      courseId: course.courseId,
      progress: Math.min(100, course.quizzes * 20),
      quizzes: course.quizzes,
      averageScore: Math.round(course.avgScore),
    }));
  }, [quizHistory]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 pb-24">
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
                <p className="text-sm font-semibold text-foreground group-hover:text-blue-600">퀴즈 시작</p>
                <p className="text-xs text-muted-foreground mt-1">새로운 퀴즈에 도전하세요</p>
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
                <p className="text-sm font-semibold text-foreground group-hover:text-emerald-600">학습 자료</p>
                <p className="text-xs text-muted-foreground mt-1">강의 자료를 확인하세요</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{"나의 학습 현황"}</h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {weeklyStats.map((stat) => (
              <Card key={stat.label} className="min-w-35 shrink-0 border-border/40">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`size-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
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
          <h2 className="text-sm font-semibold text-foreground">{"최근 퀴즈 결과"}</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
            {"모두 보기"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {recentQuizzes.length > 0 ? (
            recentQuizzes.map((quiz) => (
              <Card key={quiz.submissionId} className="border-border/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${
                      quiz.score >= 80 ? "bg-emerald-500/10" : quiz.score >= 60 ? "bg-amber-500/10" : "bg-red-500/10"
                    }`}>
                      <HelpCircle className={`size-5 ${
                        quiz.score >= 80 ? "text-emerald-500" : quiz.score >= 60 ? "text-amber-500" : "text-red-500"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{quiz.courseId}</p>
                      <p className="text-xs text-muted-foreground">
                        {`${quiz.correctCount}/${quiz.totalCount} 정답`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={
                      quiz.score >= 80 ? "default" :
                      quiz.score >= 60 ? "secondary" : "destructive"
                    }>
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

      {/* 최근 학습 자료 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"새로운 학습 자료"}</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
            {"모두 보기"}
          </Button>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {studyMaterials.length > 0 ? (
              studyMaterials.map((material) => (
                <Card key={material.id} className="min-w-50 shrink-0 border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <Badge 
                        variant={material.type === "PREVIEW" ? "default" : "secondary"} 
                        className="text-xs"
                      >
                        {material.type === "PREVIEW" ? "예습" : "복습"}
                      </Badge>
                      <span className="flex size-2 rounded-full bg-primary" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{material.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(material.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="min-w-50 shrink-0 border-border/40">
                <CardContent className="p-4 text-center text-xs text-muted-foreground">
                  {"새로운 자료가 없습니다."}
                </CardContent>
              </Card>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
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
                      <span className="text-sm font-medium text-foreground">{course.courseId}</span>
                      <span className="text-xs text-muted-foreground">
                        {"평균 "}{course.averageScore}{"% · 퀴즈 "}{course.quizzes}{"회"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={course.progress} className="h-2 flex-1" />
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