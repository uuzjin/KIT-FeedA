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
} from "lucide-react";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api";

const weeklyStats = [
  { label: "참여 퀴즈", value: "8", icon: HelpCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "평균 점수", value: "85%", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "학습 자료", value: "12", icon: FileText, color: "text-amber-500", bg: "bg-amber-500/10" },
  { label: "수강 과목", value: "4", icon: BookOpen, color: "text-violet-500", bg: "bg-violet-500/10" },
];

const upcomingQuizzes = [
  { course: "데이터베이스 개론", topic: "SQL JOIN 구문", dueIn: "오늘", urgent: true },
  { course: "운영체제", topic: "프로세스 스케줄링", dueIn: "내일", urgent: false },
  { course: "컴퓨터 네트워크", topic: "TCP/IP 프로토콜", dueIn: "3일 후", urgent: false },
];

const recentResults = [
  { course: "데이터베이스 개론", topic: "관계형 모델", score: 90, total: 100, date: "2일 전" },
  { course: "운영체제", topic: "메모리 관리", score: 75, total: 100, date: "4일 전" },
  { course: "소프트웨어 공학", topic: "애자일 방법론", score: 95, total: 100, date: "1주 전" },
];

const studyMaterials = [
  { course: "데이터베이스 개론", title: "3주차 예습 가이드", type: "예습", isNew: true },
  { course: "운영체제", title: "2주차 복습 요약본", type: "복습", isNew: true },
  { course: "컴퓨터 네트워크", title: "OSI 모델 정리", type: "복습", isNew: false },
];

const myProgress = [
  { course: "데이터베이스 개론", progress: 75, quizzes: 6 },
  { course: "운영체제", progress: 50, quizzes: 4 },
  { course: "컴퓨터 네트워크", progress: 30, quizzes: 2 },
];

export function StudentDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch {
        // fallback to static values
      }
    };
    void loadSummary();
  }, []);

  const mergedWeeklyStats = useMemo(() => {
    if (!summary) {
      return weeklyStats;
    }

    return weeklyStats.map((stat) => {
      if (stat.label === "평균 점수") {
        return { ...stat, value: `${summary.averageAccuracy}%` };
      }
      if (stat.label === "학습 자료") {
        return { ...stat, value: `${summary.uploadedWeeks}` };
      }
      return stat;
    });
  }, [summary]);

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 환영 메시지 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20">
        <h1 className="text-xl font-bold">{"안녕하세요, 이학생님"}</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {"오늘도 열심히 공부해봐요!"}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="gap-2 bg-white/20 text-white hover:bg-white/30">
            <Play className="size-4" />
            {"퀴즈 시작"}
          </Button>
          <Button size="sm" variant="secondary" className="gap-2 bg-white/20 text-white hover:bg-white/30">
            <BookOpen className="size-4" />
            {"학습 자료"}
          </Button>
        </div>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{"나의 학습 현황"}</h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {mergedWeeklyStats.map((stat) => (
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
          {upcomingQuizzes.map((quiz, index) => (
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
                  {quiz.urgent && (
                    <Button size="sm" className="h-8">{"응시"}</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
            {studyMaterials.map((material, index) => (
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
            ))}
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
              {recentResults.map((result, index) => (
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
              ))}
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
              {myProgress.map((course, index) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
