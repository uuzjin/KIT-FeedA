"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  getDashboardSummary,
  getStudentQuizHistory,
  getStudentMaterials,
  type DashboardSummary,
  type QuizHistory,
  type StudentMaterial,
} from "@/lib/api";

export function StudentDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistory[]>([]);
  const [materials, setMaterials] = useState<StudentMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [summaryData, quizData, materialsData] = await Promise.all([
          getDashboardSummary(),
          getStudentQuizHistory(),
          getStudentMaterials(),
        ]);
        setSummary(summaryData);
        setQuizHistory(quizData.quizzes || []);
        setMaterials(materialsData.materials || []);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  const weeklyStats = useMemo(() => {
    return [
      {
        label: "참여 퀴즈",
        value: quizHistory.length.toString(),
        icon: HelpCircle,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        label: "평균 점수",
        value: summary ? `${summary.averageAccuracy}%` : "0%",
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
        value: summary ? summary.totalWeeks.toString() : "0",
        icon: BookOpen,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
      },
    ];
  }, [summary, quizHistory, materials]);

  const upcomingQuizzes = useMemo(() => {
    return quizHistory.slice(0, 3).map((quiz) => ({
      course: quiz.course,
      topic: quiz.topic,
      dueIn: "예정",
      urgent: false,
    }));
  }, [quizHistory]);

  const recentResults = useMemo(() => {
    return quizHistory.slice(0, 3).map((quiz) => ({
      course: quiz.course,
      topic: quiz.topic,
      score: quiz.score,
      total: 100,
      date: quiz.date,
    }));
  }, [quizHistory]);

  const studyMaterials = useMemo(() => {
    return materials.slice(0, 3);
  }, [materials]);

  const myProgress = useMemo(() => {
    const courseMap = new Map<string, { course: string; quizzes: number }>();

    quizHistory.forEach((quiz) => {
      if (!courseMap.has(quiz.course)) {
        courseMap.set(quiz.course, { course: quiz.course, quizzes: 0 });
      }
      const item = courseMap.get(quiz.course)!;
      item.quizzes += 1;
    });

    return Array.from(courseMap.values()).map((course) => ({
      course: course.course,
      progress: Math.min(100, course.quizzes * 20),
      quizzes: course.quizzes,
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
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-2">
          <Play className="size-4" />
          {"퀴즈 시작"}
        </Button>
        <Button size="sm" variant="secondary" className="gap-2">
          <BookOpen className="size-4" />
          {"학습 자료"}
        </Button>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{"나의 학습 현황"}</h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {weeklyStats.map((stat) => (
              <Card key={stat.label} className="min-w-[140px] shrink-0 border-border/40">
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

      {/* 진행 예정 퀴즈 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"진행 예정 퀴즈"}</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
            {"모두 보기"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {upcomingQuizzes.length > 0 ? (
            upcomingQuizzes.map((quiz, index) => (
              <Card key={index} className={`border-border/40 ${quiz.urgent ? "border-l-4 border-l-primary" : ""}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${quiz.urgent ? "bg-primary/10" : "bg-muted"}`}>
                      <HelpCircle className={`size-5 ${quiz.urgent ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{quiz.topic}</p>
                      <p className="text-xs text-muted-foreground">{quiz.course}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={quiz.urgent ? "default" : "secondary"} className="shrink-0">
                      {quiz.dueIn}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                진행 예정인 퀴즈가 없습니다.
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
              studyMaterials.map((material, index) => (
                <Card key={index} className="min-w-[200px] shrink-0 border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <Badge variant={material.type === "예습" ? "default" : "secondary"} className="text-xs">
                        {material.type}
                      </Badge>
                      {material.isNew && (
                        <span className="flex size-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{material.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{material.course}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="min-w-[200px] shrink-0 border-border/40">
                <CardContent className="p-4 text-center text-xs text-muted-foreground">
                  새로운 자료가 없습니다.
                </CardContent>
              </Card>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      {/* 최근 퀴즈 결과 */}
      <section>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Star className="size-4 text-primary" />
              {"최근 퀴즈 결과"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-3">
              {recentResults.length > 0 ? (
                recentResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${
                        result.score >= 80 ? "bg-emerald-500/10" : "bg-amber-500/10"
                      }`}>
                        {result.score >= 80 ? (
                          <CheckCircle className="size-5 text-emerald-500" />
                        ) : (
                          <TrendingUp className="size-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{result.topic}</p>
                        <p className="text-xs text-muted-foreground">{result.course}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${result.score >= 80 ? "text-emerald-500" : "text-amber-500"}`}>
                        {result.score}{"점"}
                      </p>
                      <p className="text-xs text-muted-foreground">{result.date}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  응시한 퀴즈가 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
              {myProgress.length > 0 ? (
                myProgress.map((course, index) => (
                  <div key={index}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{course.course}</span>
                      <span className="text-xs text-muted-foreground">{"퀴즈 "}{course.quizzes}{"회 참여"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={course.progress} className="h-2 flex-1" />
                      <span className="w-10 text-right text-xs font-medium text-primary">
                        {course.progress}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  진행 중인 과목이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

