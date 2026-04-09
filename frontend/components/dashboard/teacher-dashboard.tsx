"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Users,
  FileText,
  HelpCircle,
  TrendingUp,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api";

const weeklyStats = [
  { label: "총 수강생", value: "156", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "업로드 자료", value: "24", icon: FileText, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "출제 퀴즈", value: "12", icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  { label: "평균 이해도", value: "78%", icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10" },
];

const uploadStatus = [
  { week: "1주차", title: "데이터베이스 개요", status: "completed" },
  { week: "2주차", title: "관계형 모델", status: "completed" },
  { week: "3주차", title: "SQL 기초", status: "pending" },
  { week: "4주차", title: "정규화", status: "upcoming" },
];

const weakTopics = [
  { topic: "SQL JOIN 구문", accuracy: 45, students: 23 },
  { topic: "정규화 3NF", accuracy: 52, students: 18 },
  { topic: "트랜잭션 ACID", accuracy: 58, students: 15 },
];

const deadlines = [
  { title: "3주차 예습자료 업로드", course: "데이터베이스 개론", dueIn: "2시간", urgent: true },
  { title: "퀴즈 결과 확인", course: "운영체제", dueIn: "1일", urgent: false },
  { title: "공지사항 작성", course: "컴퓨터 네트워크", dueIn: "3일", urgent: false },
];

export function TeacherDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getDashboardSummary();
        setSummary(data);
      } catch {
        // fallback to static data
      }
    };
    void loadSummary();
  }, []);

  const mergedWeeklyStats = useMemo(() => {
    if (!summary) {
      return weeklyStats;
    }
    return weeklyStats.map((stat) =>
      stat.label === "평균 이해도" ? { ...stat, value: `${summary.averageAccuracy}%` } : stat
    );
  }, [summary]);

  const mergedWeakTopics = useMemo(() => {
    if (!summary || summary.weakTopics.length === 0) {
      return weakTopics;
    }
    return summary.weakTopics.slice(0, 3).map((topic, index) => ({
      topic,
      accuracy: Math.max(40, summary.averageAccuracy - (index + 1) * 7),
      students: 10 + (index + 1) * 4,
    }));
  }, [summary]);

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 환영 메시지 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20">
        <h1 className="text-xl font-bold">{"안녕하세요, 김교수님"}</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {"오늘도 좋은 강의 되세요!"}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="gap-2 bg-white/20 text-white hover:bg-white/30">
            <Upload className="size-4" />
            {"자료 업로드"}
          </Button>
          <Button size="sm" variant="secondary" className="gap-2 bg-white/20 text-white hover:bg-white/30">
            <Sparkles className="size-4" />
            {"AI 분석"}
          </Button>
        </div>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{"주간 통계"}</h2>
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

      {/* 마감 임박 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"마감 임박"}</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
            {"모두 보기"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {deadlines.map((deadline, index) => (
            <Card key={index} className={`border-border/40 ${deadline.urgent ? "border-l-4 border-l-destructive" : ""}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${deadline.urgent ? "bg-destructive/10" : "bg-muted"}`}>
                    {deadline.urgent ? (
                      <AlertTriangle className="size-5 text-destructive" />
                    ) : (
                      <Clock className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{deadline.title}</p>
                    <p className="text-xs text-muted-foreground">{deadline.course}</p>
                  </div>
                </div>
                <Badge variant={deadline.urgent ? "destructive" : "secondary"} className="shrink-0">
                  {deadline.dueIn}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 자료 업로드 현황 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"자료 업로드 현황"}</h2>
          <Badge variant="outline" className="text-xs">{"데이터베이스 개론"}</Badge>
        </div>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {uploadStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-lg ${
                      item.status === "completed" ? "bg-emerald-500/10" : 
                      item.status === "pending" ? "bg-amber-500/10" : "bg-muted"
                    }`}>
                      {item.status === "completed" ? (
                        <CheckCircle className="size-4 text-emerald-500" />
                      ) : item.status === "pending" ? (
                        <Clock className="size-4 text-amber-500" />
                      ) : (
                        <FileText className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.week}</p>
                      <p className="text-xs text-muted-foreground">{item.title}</p>
                    </div>
                  </div>
                  <Badge variant={
                    item.status === "completed" ? "default" : 
                    item.status === "pending" ? "secondary" : "outline"
                  } className={`text-xs ${item.status === "completed" ? "bg-emerald-500" : ""}`}>
                    {item.status === "completed" ? "완료" : item.status === "pending" ? "진행중" : "예정"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 취약 토픽 */}
      <section>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-primary" />
              {"취약 토픽 TOP 3"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {mergedWeakTopics.map((topic, index) => (
                <div key={index}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{topic.topic}</span>
                    <span className="text-xs text-muted-foreground">{topic.students}{"명 오답"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={topic.accuracy} className="h-2 flex-1" />
                    <span className="w-10 text-right text-xs font-medium text-destructive">
                      {topic.accuracy}%
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
