"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  AlertCircle,
} from "lucide-react";
import {
  getInstructorComprehensionTrends,
  getInstructorWeakTopics,
  getInstructorUploadStatus,
  ComprehensionTrendItem,
  WeakTopicItem,
  UploadStatusItem,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function TeacherDashboard() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [trends, setTrends] = useState<ComprehensionTrendItem[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopicItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatusItem[]>([]);
  const [completionRate, setCompletionRate] = useState(0);
  const [overallTrend, setOverallTrend] = useState<
    "IMPROVING" | "DECLINING" | "STABLE"
  >("STABLE");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !user) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [trendsData, weakTopicsData, uploadStatusData] =
          await Promise.all([
            getInstructorComprehensionTrends(),
            getInstructorWeakTopics(),
            getInstructorUploadStatus(),
          ]);
        setTrends(trendsData.trends || []);
        setOverallTrend(trendsData.overallTrend || "STABLE");
        setWeakTopics(weakTopicsData.weakTopics || []);
        setUploadStatus(uploadStatusData.uploadStatus || []);
        setCompletionRate(uploadStatusData.completionRate || 0);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "대시보드 데이터를 불러오지 못했습니다.";
        setError(message);
        setTrends([]);
        setWeakTopics([]);
        setUploadStatus([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [isAuthLoading, user]);

  const weeklyStats = useMemo(() => {
    const uniqueCourses = new Set(trends.map((t) => t.courseId)).size;
    const completedCount = uploadStatus.filter((u) => {
      const isComplete = u.previewGuide || u.reviewSummary || u.script;
      return isComplete;
    }).length;

    // 평균 이해도 계산
    const avgUnderstanding =
      trends.length > 0
        ? Math.round(
            trends.reduce((sum, t) => sum + t.averageScore, 0) / trends.length,
          )
        : 0;

    return [
      {
        label: "담당 과목",
        value: uniqueCourses.toString(),
        icon: Users,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        label: "업로드 자료",
        value: completedCount.toString(),
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
        value: `${avgUnderstanding}%`,
        icon: TrendingUp,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
      },
    ];
  }, [trends, uploadStatus]);

  const pendingDeadlines = useMemo(() => {
    return uploadStatus
      .filter((item) => !item.previewGuide || !item.reviewSummary)
      .slice(0, 3)
      .map((item) => ({
        week: item.weekNumber,
        topic: item.topic,
        pending:
          (!item.previewGuide ? "예습 " : "") +
          (!item.reviewSummary ? "복습" : ""),
      }));
  }, [uploadStatus]);

  const topWeakTopics = useMemo(() => {
    return weakTopics.slice(0, 3);
  }, [weakTopics]);

  if (isAuthLoading || isLoading) {
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
          className="group cursor-pointer border-border/40 bg-linear-to-br from-amber-500/10 to-amber-600/5 shadow-sm transition-all hover:from-amber-500/20 hover:to-amber-600/10 hover:shadow-lg hover:border-amber-400/50"
          onClick={() => router.push("/materials")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/20 transition-all group-hover:scale-110 group-hover:bg-amber-500/30">
                <Upload className="size-6 text-amber-600 group-hover:text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-amber-600">
                  자료 업로드
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  강의 자료를 업로드하세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="group cursor-pointer border-border/40 bg-linear-to-br from-violet-500/10 to-violet-600/5 shadow-sm transition-all hover:from-violet-500/20 hover:to-violet-600/10 hover:shadow-lg hover:border-violet-400/50"
          onClick={() => router.push("/analysis")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/20 transition-all group-hover:scale-110 group-hover:bg-violet-500/30">
                <Sparkles className="size-6 text-violet-600 group-hover:text-violet-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-violet-600">
                  AI 분석
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  학생 데이터를 분석하세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 주간 통계 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {"주간 통계"}
        </h2>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {weeklyStats.map((stat) => (
              <Card
                key={stat.label}
                className="min-w-35 shrink-0 border-border/40"
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

      {/* 미완료 항목 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {"미완료 항목"}
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
          {pendingDeadlines.length > 0 ? (
            pendingDeadlines.map((item, index) => (
              <Card
                key={index}
                className="border-l-4 border-l-amber-500 border-border/40"
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <AlertTriangle className="size-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {`${item.week}주차 - ${item.topic}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.pending}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {"남음"}
                  </Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                {"미완료 항목이 없습니다."}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* 자료 업로드 현황 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {"자료 업로드 현황"}
          </h2>
        </div>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold">
                {"완료율"}
              </CardTitle>
              <span className="text-sm font-bold text-primary">
                {Math.round(completionRate)}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Progress value={completionRate} className="mb-4 h-2" />
            <div className="flex flex-col gap-3">
              {uploadStatus.length > 0 ? (
                uploadStatus.slice(0, 5).map((item) => {
                  const isComplete =
                    item.previewGuide || item.reviewSummary || item.script;
                  return (
                    <div
                      key={`${item.weekNumber}-${item.topic}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-8 items-center justify-center rounded-lg ${
                            isComplete ? "bg-emerald-500/10" : "bg-muted"
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle className="size-4 text-emerald-500" />
                          ) : (
                            <FileText className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {`${item.weekNumber}주차`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.topic}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {item.previewGuide && (
                          <Badge variant="outline" className="text-xs">
                            {"예습"}
                          </Badge>
                        )}
                        {item.reviewSummary && (
                          <Badge variant="outline" className="text-xs">
                            {"복습"}
                          </Badge>
                        )}
                        {item.script && (
                          <Badge variant="outline" className="text-xs">
                            {"스크립트"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  {"업로드 현황 데이터가 없습니다."}
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
              {"취약 토픽 TOP"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {topWeakTopics.length > 0 ? (
                topWeakTopics.map((topic) => (
                  <div key={topic.topic}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {`${topic.rank || "-"}. ${topic.topic}`}
                      </span>
                      <span className="text-xs font-medium text-destructive">
                        {Math.round(topic.wrongRate * 100)}% 오답
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.round(topic.wrongRate * 100))}
                      className="h-2"
                    />
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  {"취약한 토픽이 없습니다."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 학습 추이 */}
      <section>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" />
              {"학습 추이"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-4 flex items-center gap-2">
              <Badge
                variant={
                  overallTrend === "IMPROVING"
                    ? "default"
                    : overallTrend === "DECLINING"
                      ? "destructive"
                      : "secondary"
                }
              >
                {overallTrend === "IMPROVING"
                  ? "📈 개선 중"
                  : overallTrend === "DECLINING"
                    ? "📉 하락 중"
                    : "➡️ 안정적"}
              </Badge>
            </div>
            <div className="flex flex-col gap-3">
              {trends.length > 0 ? (
                trends.slice(0, 5).map((trend) => (
                  <div
                    key={trend.quizId}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {`${trend.weekNumber}주차 - ${trend.topic}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`참여: ${Math.round(trend.participationRate * 100)}%`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">
                        {trend.averageScore}%
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  {"추이 데이터가 없습니다."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
