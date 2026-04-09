"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Sparkles,
  Clock,
  CheckCircle,
  Users,
  BarChart3,
  Eye,
  Edit,
  MoreVertical,
  Play,
  Pause,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateQuiz, getLatestQuiz, type QuizLatest } from "@/lib/api";

const activeQuizzes = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "3주차",
    title: "SQL SELECT 구문 이해도 체크",
    questions: 5,
    participants: 38,
    total: 45,
    avgScore: 72,
    status: "active",
    endsIn: "2시간",
  },
  {
    id: 2,
    course: "운영체제",
    week: "2주차",
    title: "프로세스 관리 퀴즈",
    questions: 4,
    participants: 35,
    total: 38,
    avgScore: 85,
    status: "active",
    endsIn: "1일",
  },
];

const completedQuizzes = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "2주차",
    title: "관계형 모델 이해도 체크",
    questions: 5,
    participants: 45,
    total: 45,
    avgScore: 78,
    weakTopic: "외래 키 제약조건",
    completedAt: "3일 전",
  },
  {
    id: 2,
    course: "소프트웨어 공학",
    week: "1주차",
    title: "애자일 방법론 퀴즈",
    questions: 4,
    participants: 30,
    total: 31,
    avgScore: 92,
    weakTopic: null,
    completedAt: "1주 전",
  },
];

const draftQuizzes = [
  {
    id: 1,
    course: "컴퓨터 네트워크",
    week: "3주차",
    title: "TCP/IP 프로토콜 퀴즈",
    questions: 3,
    lastModified: "오늘",
  },
];

export function TeacherQuiz() {
  const [activeTab, setActiveTab] = useState("active");
  const [latestQuiz, setLatestQuiz] = useState<QuizLatest | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const data = await getLatestQuiz();
        setLatestQuiz(data);
      } catch {
        // fallback to local mock list
      }
    };
    void loadLatest();
  }, []);

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    try {
      const result = await generateQuiz({
        topic: "최신 강의",
        difficulty: "mixed",
        question_count: 5,
      });
      setLatestQuiz(result.quiz);
      setActiveTab("active");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"퀴즈 관리"}</h1>
          <p className="text-sm text-muted-foreground">{"퀴즈 출제 및 결과 분석"}</p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          {"새 퀴즈"}
        </Button>
      </div>

      {/* AI 자동 출제 카드 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{"AI 퀴즈 자동 출제"}</h3>
              <p className="text-sm text-muted-foreground">
                {"강의 내용을 기반으로 AI가 자동으로 퀴즈 문항을 생성합니다."}
              </p>
            </div>
          </div>
          <Button size="sm" className="mt-4 w-full gap-2" onClick={handleGenerateQuiz} disabled={isGenerating}>
            <Sparkles className="size-4" />
            {isGenerating ? "생성 중..." : "AI로 퀴즈 생성하기"}
          </Button>
        </CardContent>
      </Card>

      {latestQuiz && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{"백엔드 최신 퀴즈"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm font-medium text-foreground">{latestQuiz.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {latestQuiz.questions}{"문항 · 정답률 "}{latestQuiz.accuracy}%
            </p>
          </CardContent>
        </Card>
      )}

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1">
            <Play className="size-3" />
            {"진행중"}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="size-3" />
            {"완료"}
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1">
            <Edit className="size-3" />
            {"임시저장"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="flex flex-col gap-3">
            {activeQuizzes.map((quiz) => (
              <Card key={quiz.id} className="border-border/40 border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {quiz.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {quiz.week}
                        </Badge>
                        <Badge className="bg-emerald-500 text-xs">{"진행중"}</Badge>
                      </div>
                      <p className="mt-2 font-medium text-foreground">{quiz.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{quiz.questions}{"문항"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 size-4" />
                          {"결과 보기"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pause className="mr-2 size-4" />
                          {"마감하기"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{"참여"}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {quiz.participants}/{quiz.total}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <BarChart3 className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{"평균"}</span>
                      </div>
                      <p className={`text-sm font-semibold ${quiz.avgScore >= 80 ? "text-emerald-500" : quiz.avgScore >= 60 ? "text-amber-500" : "text-destructive"}`}>
                        {quiz.avgScore}{"점"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{"남은 시간"}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{quiz.endsIn}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{"참여율"}</span>
                      <span>{Math.round((quiz.participants / quiz.total) * 100)}%</span>
                    </div>
                    <Progress value={(quiz.participants / quiz.total) * 100} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <div className="flex flex-col gap-3">
            {completedQuizzes.map((quiz) => (
              <Card key={quiz.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {quiz.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {quiz.week}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-foreground">{quiz.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {quiz.questions}{"문항 · "}{quiz.completedAt}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      {"리포트"}
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{"참여율"}</span>
                      </div>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {Math.round((quiz.participants / quiz.total) * 100)}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{"평균 점수"}</span>
                      </div>
                      <p className={`mt-1 text-lg font-bold ${quiz.avgScore >= 80 ? "text-emerald-500" : quiz.avgScore >= 60 ? "text-amber-500" : "text-destructive"}`}>
                        {quiz.avgScore}{"점"}
                      </p>
                    </div>
                  </div>

                  {quiz.weakTopic && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2">
                      <AlertTriangle className="size-4 text-amber-500" />
                      <span className="text-xs text-amber-700">{"취약 토픽: "}{quiz.weakTopic}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="draft" className="mt-4">
          <div className="flex flex-col gap-3">
            {draftQuizzes.map((quiz) => (
              <Card key={quiz.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                        <Edit className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {quiz.course}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {quiz.week}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">{quiz.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quiz.questions}{"문항 · 수정 "}{quiz.lastModified}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        {"수정"}
                      </Button>
                      <Button size="sm">
                        {"발행"}
                      </Button>
                    </div>
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
