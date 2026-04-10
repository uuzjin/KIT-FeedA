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
  Loader2,
} from "lucide-react";
import {
  getDashboardSummary,
  getInstructorComprehensionTrends,
  getInstructorWeakTopics,
  getInstructorUploadStatus,
  type DashboardSummary,
  type ComprehensionTrend,
  type WeakTopic,
  type UploadStatusItem,
} from "@/lib/api";

export function TeacherDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<ComprehensionTrend[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [summaryData, trendsData, weakTopicsData, uploadStatusData] = await Promise.all([
          getDashboardSummary(),
          getInstructorComprehensionTrends(),
          getInstructorWeakTopics(),
          getInstructorUploadStatus(),
        ]);
        setSummary(summaryData);
        setTrends(trendsData.trends || []);
        setWeakTopics(weakTopicsData.weakTopics || []);
        setUploadStatus(uploadStatusData.uploadedWeeks || []);
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
        label: "총 수강생",
        value: "156",
        icon: Users,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        label: "업로드 자료",
        value: uploadStatus.filter((u) => u.status === "completed").length.toString(),
        icon: FileText,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
      },
      {
        label: "출제 퀴즈",
        value: trends.length.toString(),
        icon: HelpCircle,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
      {
        label: "평균 이해도",
        value: summary ? `${summary.averageAccuracy}%` : "0%",
        icon: TrendingUp,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
      },
    ];
  }, [summary, uploadStatus, trends]);

  const deadlines = useMemo(() => {
    return uploadStatus
      .filter((item) => item.status === "pending" || item.status === "upcoming")
      .slice(0, 3)
      .map((item) => ({
        title: `${item.week} - ${item.title}`,
        course: "과정",
        dueIn: item.status === "pending" ? "진행 중" : "예정",
        urgent: item.status === "pending",
      }));
  }, [uploadStatus]);

  const mergedWeakTopics = useMemo(() => {
    return weakTopics.slice(0, 3);
  }, [weakTopics]);

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
          <Upload className="size-4" />
          {"자료 업로드"}
        </Button>
        <Button size="sm" variant="secondary" className="gap-2">
          <Sparkles className="size-4" />
          {"AI 분석"}
        </Button>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{"주간 통계"}</h2>
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

      {/* 마감 임박 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"마감 임박"}</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
            {"모두 보기"}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {deadlines.length > 0 ? (
            deadlines.map((deadline, index) => (
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
            ))
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                마감이 임박한 항목이 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* 자료 업로드 현황 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{"자료 업로드 현황"}</h2>
        </div>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {uploadStatus.length > 0 ? (
                uploadStatus.map((item, index) => (
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
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  업로드된 자료가 없습니다.
                </div>
              )}
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
              {"취약 토픽"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {mergedWeakTopics.length > 0 ? (
                mergedWeakTopics.map((topic, index) => (
                  <div key={index}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{topic.topic}</span>
                      <span className="text-xs text-muted-foreground">{topic.affectedStudents}{"명"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={topic.averageScore} className="h-2 flex-1" />
                      <span className="w-10 text-right text-xs font-medium text-destructive">
                        {topic.averageScore}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  취약한 토픽이 없습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
