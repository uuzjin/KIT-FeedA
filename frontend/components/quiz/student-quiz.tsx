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
} from "lucide-react";
import { getLatestQuiz, type QuizLatest } from "@/lib/api";

const availableQuizzes = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "3주차",
    title: "SQL SELECT 구문 이해도 체크",
    questions: 5,
    timeLimit: "10분",
    endsIn: "2시간",
    isUrgent: true,
  },
  {
    id: 2,
    course: "운영체제",
    week: "2주차",
    title: "프로세스 관리 퀴즈",
    questions: 4,
    timeLimit: "8분",
    endsIn: "1일",
    isUrgent: false,
  },
];

const completedQuizzes = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "2주차",
    title: "관계형 모델 이해도 체크",
    score: 80,
    total: 100,
    rank: "상위 30%",
    weakTopics: ["외래 키 제약조건"],
    completedAt: "3일 전",
  },
  {
    id: 2,
    course: "소프트웨어 공학",
    week: "1주차",
    title: "애자일 방법론 퀴즈",
    score: 95,
    total: 100,
    rank: "상위 10%",
    weakTopics: [],
    completedAt: "1주 전",
  },
  {
    id: 3,
    course: "운영체제",
    week: "1주차",
    title: "운영체제 개요 퀴즈",
    score: 70,
    total: 100,
    rank: "상위 50%",
    weakTopics: ["커널의 역할", "시스템 콜"],
    completedAt: "2주 전",
  },
];

export function StudentQuiz() {
  const [activeTab, setActiveTab] = useState("available");
  const [latestQuiz, setLatestQuiz] = useState<QuizLatest | null>(null);

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const data = await getLatestQuiz();
        setLatestQuiz(data);
      } catch {
        // fallback to static list
      }
    };
    void loadLatest();
  }, []);

  const avgScore = Math.round(
    completedQuizzes.reduce((sum, q) => sum + q.score, 0) / completedQuizzes.length
  );

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"퀴즈"}</h1>
        <p className="text-sm text-muted-foreground">{"퀴즈에 참여하고 실력을 확인하세요"}</p>
      </div>

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
            <p className="text-lg font-bold text-amber-500">{"95"}{"점"}</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available" className="gap-2">
            <Play className="size-4" />
            {"응시 가능"}
            {availableQuizzes.length > 0 && (
              <Badge variant="destructive" className="ml-1 size-5 rounded-full p-0 text-xs">
                {availableQuizzes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="size-4" />
            {"완료"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          <div className="flex flex-col gap-3">
            {latestQuiz && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">{"백엔드 최신 퀴즈"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{latestQuiz.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestQuiz.questions}{"문항 · 최근 정답률 "}{latestQuiz.accuracy}%
                  </p>
                </CardContent>
              </Card>
            )}
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
                <Card key={quiz.id} className={`border-border/40 ${quiz.isUrgent ? "border-l-4 border-l-primary" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {quiz.course}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {quiz.week}
                          </Badge>
                          {quiz.isUrgent && (
                            <Badge variant="destructive" className="text-xs">
                              {"마감 임박"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 font-medium text-foreground">{quiz.title}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="size-3" />
                            {quiz.questions}{"문항"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {quiz.timeLimit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="size-4 text-amber-500" />
                        <span className="text-amber-500">{"마감까지 "}{quiz.endsIn}</span>
                      </div>
                      <Button className="gap-2">
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
          <div className="flex flex-col gap-3">
            {completedQuizzes.map((quiz) => (
              <Card key={quiz.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {quiz.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {quiz.week}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-foreground">{quiz.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{quiz.completedAt}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${quiz.score >= 80 ? "text-emerald-500" : quiz.score >= 60 ? "text-amber-500" : "text-destructive"}`}>
                        {quiz.score}
                        <span className="text-sm text-muted-foreground">{"/"}{quiz.total}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{quiz.rank}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <Progress value={quiz.score} className="h-2" />
                  </div>

                  {quiz.weakTopics.length > 0 && (
                    <div className="mt-3 rounded-lg bg-amber-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">{"보완이 필요한 부분"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {quiz.weakTopics.map((topic, index) => (
                          <Badge key={index} variant="outline" className="text-xs bg-white">
                            {topic}
                          </Badge>
                        ))}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
