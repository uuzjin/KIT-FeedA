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
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCourses,
  getCourseQuizzes,
  createQuiz,
  closeQuiz,
  type Quiz,
  type Course,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function TeacherQuiz() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("active");
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeQuizzes, setActiveQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<Quiz[]>([]);
  const [draftQuizzes, setDraftQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadQuizzes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 강사의 담당 과목 조회
        const coursesData = await getCourses();
        
        if (!mounted) return;

        // 각 과목의 퀴즈 조회
        const allActiveQuizzes: Quiz[] = [];
        const allCompletedQuizzes: Quiz[] = [];
        const allDraftQuizzes: Quiz[] = [];

        for (const course of coursesData.courses) {
          try {
            const activeData = await getCourseQuizzes(course.courseId, "PUBLISHED");
            const closedData = await getCourseQuizzes(course.courseId, "CLOSED");
            const draftData = await getCourseQuizzes(course.courseId, "DRAFT");

            allActiveQuizzes.push(...activeData.quizzes);
            allCompletedQuizzes.push(...closedData.quizzes);
            allDraftQuizzes.push(...draftData.quizzes);
          } catch (err) {
            console.error(`Failed to load quizzes for course ${course.courseId}:`, err);
          }
        }

        if (mounted) {
          setCourses(coursesData.courses);
          setActiveQuizzes(allActiveQuizzes);
          setCompletedQuizzes(allCompletedQuizzes);
          setDraftQuizzes(allDraftQuizzes);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "퀴즈 목록을 불러오지 못했습니다.";
        if (mounted) setError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadQuizzes();

    return () => {
      mounted = false;
    };
  }, []);

  const handleCloseQuiz = async (courseId: string, quizId: string) => {
    try {
      await closeQuiz(courseId, quizId);
      // 새로고침
      setActiveQuizzes((prev) =>
        prev.filter((q) => q.quizId !== quizId)
      );
      setCompletedQuizzes((prev) => [
        ...prev,
        activeQuizzes.find((q) => q.quizId === quizId)!,
      ]);
    } catch (err) {
      console.error("Failed to close quiz:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{"로딩 중..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"퀴즈 관리"}</h1>
          <p className="text-sm text-muted-foreground">{"퀴즈 출제 및 결과 분석"}</p>
        </div>
        <Button className="gap-2" disabled={isCreating}>
          <Plus className="size-4" />
          {"새 퀴즈"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1">
            <Play className="size-3" />
            {"진행중"} ({activeQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="size-3" />
            {"완료"} ({completedQuizzes.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-1">
            <Edit className="size-3" />
            {"임시저장"} ({draftQuizzes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"진행 중인 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {activeQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40 border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {quiz.courseId}
                          </Badge>
                          <Badge className="bg-emerald-500 text-xs">{"진행중"}</Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">
                          {quiz.scheduleId || "퀴즈"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quiz.questions.length}{"문항"}
                        </p>
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
                          <DropdownMenuItem
                            onClick={() => handleCloseQuiz(quiz.courseId, quiz.quizId)}
                          >
                            <Pause className="mr-2 size-4" />
                            {"마감하기"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"완료된 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {completedQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {quiz.courseId}
                          </Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">
                          {quiz.scheduleId || "퀴즈"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quiz.questions.length}{"문항"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        {"리포트"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="draft" className="mt-4">
          {draftQuizzes.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{"임시 저장된 퀴즈가 없습니다."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {draftQuizzes.map((quiz) => (
                <Card key={quiz.quizId} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                          <Edit className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {quiz.courseId}
                            </Badge>
                          </div>
                          <p className="mt-1 font-medium text-foreground">
                            {quiz.scheduleId || "퀴즈"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {quiz.questions.length}{"문항"}
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

