"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, Users, BarChart3, ChevronRight, Sparkles, CheckCircle2, XCircle } from "lucide-react";

const activeQuizzes = [
  {
    id: 1,
    title: "3주차 수업 이해도 퀴즈",
    course: "데이터베이스 개론",
    questions: 5,
    participants: 32,
    total: 45,
    endTime: "2024-03-15 18:00",
    status: "active",
  },
  {
    id: 2,
    title: "프로세스 관리 퀴즈",
    course: "운영체제",
    questions: 4,
    participants: 0,
    total: 38,
    endTime: "2024-03-16 23:59",
    status: "scheduled",
  },
];

const completedQuizzes = [
  {
    id: 3,
    title: "2주차 SQL 기초 퀴즈",
    course: "데이터베이스 개론",
    avgScore: 78,
    participants: 43,
    date: "2024-03-08",
    weakTopics: ["JOIN 연산", "서브쿼리"],
  },
  {
    id: 4,
    title: "2주차 메모리 관리 퀴즈",
    course: "운영체제",
    avgScore: 65,
    participants: 36,
    date: "2024-03-09",
    weakTopics: ["페이지 교체 알고리즘", "가상 메모리"],
  },
  {
    id: 5,
    title: "1주차 OSI 7계층 퀴즈",
    course: "컴퓨터 네트워크",
    avgScore: 85,
    participants: 40,
    date: "2024-03-05",
    weakTopics: ["전송 계층"],
  },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function ActiveQuizCard({ quiz }: { quiz: typeof activeQuizzes[0] }) {
  const participationRate = (quiz.participants / quiz.total) * 100;

  return (
    <Card className="border-border/40 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-semibold text-foreground">{quiz.title}</span>
              <p className="mt-0.5 text-sm text-muted-foreground">{quiz.course}</p>
            </div>
            <Badge
              className={cn(
                "px-2.5 py-1 font-semibold",
                quiz.status === "active"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              )}
            >
              {quiz.status === "active" ? "진행중" : "예정"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <Clock className="size-3.5" />
              <span className="text-xs font-medium">{quiz.endTime}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <Users className="size-3.5" />
              <span className="text-xs font-medium">{quiz.participants}/{quiz.total}{"명"}</span>
            </div>
          </div>
          {quiz.status === "active" && (
            <div className="flex flex-col gap-2 rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">{"참여율"}</span>
                <span className="font-bold text-foreground">{participationRate.toFixed(0)}%</span>
              </div>
              <Progress value={participationRate} className="h-2" />
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full justify-center">
            {"상세 보기"}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedQuizCard({ quiz }: { quiz: typeof completedQuizzes[0] }) {
  return (
    <Card className="border-border/40 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-semibold text-foreground">{quiz.title}</span>
              <p className="mt-0.5 text-sm text-muted-foreground">{quiz.course}</p>
            </div>
            <Badge
              className={cn(
                "px-2.5 py-1 font-semibold",
                quiz.avgScore >= 80
                  ? "bg-emerald-500/10 text-emerald-600"
                  : quiz.avgScore >= 60
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-red-500/10 text-red-600"
              )}
            >
              {"평균 "}{quiz.avgScore}%
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{quiz.date}</span>
            <span className="text-xs">{quiz.participants}{"명 참여"}</span>
          </div>
          {quiz.weakTopics.length > 0 && (
            <div className="rounded-xl bg-red-500/5 p-3">
              <span className="text-xs font-semibold text-red-600">{"취약 토픽"}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {quiz.weakTopics.map((topic, index) => (
                  <Badge key={index} variant="outline" className="border-red-200 bg-red-50 text-xs text-red-600">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full justify-center">
            <BarChart3 className="mr-1.5 size-4" />
            {"리포트 보기"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuizContent() {
  return (
    <div className="flex flex-col gap-5 p-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{"퀴즈"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{"수업 이해도를 확인하세요"}</p>
        </div>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="size-4" />
          {"퀴즈 생성"}
        </Button>
      </div>

      {/* AI 퀴즈 생성 카드 */}
      <Card className="group cursor-pointer border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Sparkles className="size-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{"AI 퀴즈 자동 출제"}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{"강의 내용을 기반으로 퀴즈를 자동 생성해요"}</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>

      {/* 탭 콘텐츠 */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="h-12 w-full rounded-xl bg-secondary/50 p-1">
          <TabsTrigger 
            value="active" 
            className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Clock className="mr-1.5 size-4" />
            {"진행중"}
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            {"완료됨"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 flex flex-col gap-3">
          {activeQuizzes.length > 0 ? (
            activeQuizzes.map((quiz) => <ActiveQuizCard key={quiz.id} quiz={quiz} />)
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <XCircle className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">{"진행중인 퀴즈가 없어요"}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 flex flex-col gap-3">
          {completedQuizzes.map((quiz) => (
            <CompletedQuizCard key={quiz.id} quiz={quiz} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
