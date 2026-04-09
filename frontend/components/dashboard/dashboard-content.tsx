"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BookOpen, Clock, FileText, Users, TrendingUp, AlertCircle } from "lucide-react";

const upcomingDeadlines = [
  { id: 1, title: "DB 예습 자료 업로드", dueDate: "2024-03-15", course: "데이터베이스 개론", urgent: true },
  { id: 2, title: "운영체제 퀴즈 출제", dueDate: "2024-03-16", course: "운영체제", urgent: false },
  { id: 3, title: "네트워크 복습 자료", dueDate: "2024-03-18", course: "컴퓨터 네트워크", urgent: false },
];

const recentQuizResults = [
  { id: 1, course: "데이터베이스 개론", week: "3주차", avgScore: 82, participants: 45 },
  { id: 2, course: "운영체제", week: "3주차", avgScore: 68, participants: 38 },
  { id: 3, course: "컴퓨터 네트워크", week: "2주차", avgScore: 75, participants: 42 },
];

const weeklyStats = [
  { label: "총 수강생", value: "156", icon: Users, color: "bg-blue-500/10 text-blue-600" },
  { label: "진행중 퀴즈", value: "4", icon: FileText, color: "bg-emerald-500/10 text-emerald-600" },
  { label: "평균 이해도", value: "75%", icon: TrendingUp, color: "bg-amber-500/10 text-amber-600" },
  { label: "강의 수", value: "4", icon: BookOpen, color: "bg-violet-500/10 text-violet-600" },
];

export function DashboardContent() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4">
      {/* 주간 통계 */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-3">
          {weeklyStats.map((stat) => (
            <Card key={stat.label} className="min-w-[140px] shrink-0 border-border/40 shadow-sm transition-all hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn("flex size-11 items-center justify-center rounded-xl", stat.color)}>
                  <stat.icon className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold tracking-tight text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* 마감 임박 */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="size-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{"마감 임박"}</CardTitle>
              <CardDescription className="text-xs">{"곧 마감되는 업무들이에요"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upcomingDeadlines.map((deadline) => (
            <div
              key={deadline.id}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-secondary/30 p-4 transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground group-hover:text-primary">
                    {deadline.title}
                  </span>
                  {deadline.urgent && (
                    <Badge variant="destructive" className="px-2 py-0.5 text-[10px] font-semibold">
                      {"긴급"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{deadline.course}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <AlertCircle className="size-3" />
                {deadline.dueDate}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 최근 퀴즈 결과 */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{"최근 퀴즈 결과"}</CardTitle>
              <CardDescription className="text-xs">{"학생들의 이해도를 확인하세요"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {recentQuizResults.map((result) => (
            <div key={result.id} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground">{result.course}</span>
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {result.week}
                  </span>
                </div>
                <Badge
                  className={cn(
                    "px-2.5 py-1 font-semibold",
                    result.avgScore >= 80
                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : result.avgScore >= 60
                        ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                        : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                  )}
                >
                  {result.avgScore}%
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Progress 
                  value={result.avgScore} 
                  className="h-2 flex-1"
                />
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {result.participants}{"명 참여"}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
