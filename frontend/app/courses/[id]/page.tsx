"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useCourse } from "@/contexts/course-context";
import { loadCourseWorkspace } from "@/lib/course-workspace";
import { addCourseStudents, deleteCourse, getCourseStudents } from "@/lib/api";
import type { CourseEnrollment, CourseScriptListItem } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CourseInviteLmsPanel } from "@/components/courses/course-invite-lms-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CalendarDays,
  Clock,
  FileText,
  FileUp,
  HelpCircle,
  Bell,
  Users,
  Trash2,
  Plus,
} from "lucide-react";
import { createCourseSchedule } from "@/lib/api";

function formatDays(days: string[]) {
  if (!days?.length) return "요일 미정";
  return days.join(" · ");
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = typeof params?.id === "string" ? params.id : "";
  const { user, isLoading, isHydrated } = useAuth();
  const { selectedCourse, setSelectedCourse, courses, refreshCourses } = useCourse();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof loadCourseWorkspace>
  > | null>(null);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [enrollmentTotal, setEnrollmentTotal] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 주차 추가 관련 상태
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);

  const refreshWorkspace = async () => {
    if (!courseId) return;
    try {
      const res = await loadCourseWorkspace(courseId);
      setData(res);
      setEnrollments(res.enrollments.students);
      setEnrollmentTotal(res.enrollments.totalCount);
    } catch (e) {
      console.error("Failed to refresh workspace:", e);
    }
  };

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, isHydrated, router]);

  useEffect(() => {
    if (!user || !courseId.trim()) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshWorkspace();
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "강의 정보를 불러오지 못했습니다.";
        setError(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user, courseId]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !newWeekNumber || !newTopic) return;

    setIsSubmittingSchedule(true);
    try {
      await createCourseSchedule(courseId, {
        weekNumber: parseInt(newWeekNumber),
        topic: newTopic,
        date: new Date().toISOString().split("T")[0], // 기본값 오늘
      });
      setNewWeekNumber("");
      setNewTopic("");
      setIsAddingSchedule(false);
      await refreshWorkspace();
      alert(`${newWeekNumber}주차 스케줄이 추가되었습니다.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "스케줄 추가 실패");
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !courseId) return;
    setUploadingFile(true);
    setUploadResult(null);
    try {
      const res = await addCourseStudents(courseId, { file });
      let msg = `${res.addedCount}명이 등록되었습니다.`;
      if (res.notFoundEmails?.length) {
        msg += ` (미등록 이메일 ${res.notFoundEmails.length}개 있음)`;
      }
      setUploadResult(msg);
      // Refresh student list
      const updated = await getCourseStudents(courseId);
      setEnrollments(updated.students);
      setEnrollmentTotal(updated.totalCount);
    } catch (err) {
      setUploadResult(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseId || user?.role !== "INSTRUCTOR") return;

    setIsDeleting(true);
    setError(null);
    try {
      await deleteCourse(courseId);
      await refreshCourses();

      const nextCourse =
        courses.find((course) => course.courseId !== courseId) ?? null;
      if (nextCourse) {
        setSelectedCourse(nextCourse);
      } else if (selectedCourse?.courseId === courseId) {
        setSelectedCourse(null);
      }

      router.push("/");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "강의 삭제에 실패했습니다.";
      setError(msg);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!courseId.trim()) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>잘못된 주소</AlertTitle>
            <AlertDescription>강의 ID가 없습니다.</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const course = data?.course;
  const backHref = user.role === "INSTRUCTOR" ? "/" : "/dashboard";
  const backLabel = user.role === "INSTRUCTOR" ? "대시보드" : "강의 목록";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <Button variant="ghost" size="sm" className="mb-4 gap-1 px-0 text-muted-foreground" asChild>
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </Button>

          {loading && (
            <div className="flex justify-center py-16">
              <Spinner className="size-10 text-primary" />
            </div>
          )}

          {error && !loading && (
            <Alert variant="destructive">
              <AlertTitle>불러오기 실패</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && course && (
            <>
              <div className="space-y-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                      {course.courseName}
                    </h1>
                    <Badge variant="secondary">{course.semester}</Badge>
                  </div>
                  {user.role === "INSTRUCTOR" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2 self-start"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="size-4" />
                      강의 삭제
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {course.description?.trim() || "설명이 없습니다."}
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    {formatDays(course.dayOfWeek)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {course.startTime && course.endTime
                      ? `${course.startTime} – ${course.endTime}`
                      : "시간 미정"}
                  </span>
                  {course.maxStudents != null && (
                    <span className="flex items-center gap-1.5">
                      <Users className="size-4" />
                      정원 {course.maxStudents}명
                    </span>
                  )}
                </div>
              </div>

              <Separator className="my-8" />

              {/* 기능 바로가기 */}
              <QuickNav
                courseId={courseId}
                course={course}
                isInstructor={user.role === "INSTRUCTOR"}
                onNavigate={(dest) => {
                  setSelectedCourse(course);
                  router.push(dest);
                }}
              />

              <Separator className="my-8" />

              <CourseInviteLmsPanel
                courseId={course.courseId}
                isInstructor={user.role === "INSTRUCTOR"}
              />

              <Separator className="my-8" />

              <div className="grid gap-8 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="size-5 text-primary" />
                          수강생
                        </CardTitle>
                        <CardDescription>총 {enrollmentTotal}명</CardDescription>
                      </div>
                      {user.role === "INSTRUCTOR" && (
                        <>
                          <input
                            ref={excelInputRef}
                            type="file"
                            className="hidden"
                            accept=".xlsx,.csv"
                            onChange={handleExcelUpload}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={uploadingFile}
                          >
                            <FileUp className="size-3.5" />
                            {uploadingFile ? "업로드 중..." : "엑셀 업로드"}
                          </Button>
                        </>
                      )}
                    </div>
                    {uploadResult && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {uploadResult}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <StudentList students={enrollments} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="size-5 text-primary" />
                      업로드 스크립트
                    </CardTitle>
                    <CardDescription>강의 자료(파일) 목록</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScriptList scripts={data!.scripts} />
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-8">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="size-5 text-primary" />
                        주차별 예습 · 복습 자료
                      </CardTitle>
                      <CardDescription>
                        스케줄에 연결된 예습 가이드와 복습 요약이 있으면 표시됩니다.
                      </CardDescription>
                    </div>
                    {user.role === "INSTRUCTOR" && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1.5"
                        onClick={() => setIsAddingSchedule(!isAddingSchedule)}
                      >
                        <Plus className="size-3.5" />
                        주차 추가
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isAddingSchedule && (
                    <form onSubmit={handleAddSchedule} className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                      <p className="text-sm font-semibold">새로운 주차 스케줄 등록</p>
                      <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">주차 (숫자)</label>
                          <input
                            type="number"
                            min="1"
                            max="16"
                            placeholder="예: 1"
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            value={newWeekNumber}
                            onChange={(e) => setNewWeekNumber(e.target.value)}
                            required
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">주제 (Topic)</label>
                          <input
                            type="text"
                            placeholder="예: 인공지능 개론 및 파이썬 기초"
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            value={newTopic}
                            onChange={(e) => setNewTopic(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingSchedule(false)}>취소</Button>
                        <Button type="submit" size="sm" disabled={isSubmittingSchedule}>
                          {isSubmittingSchedule ? "등록 중..." : "등록 완료"}
                        </Button>
                      </div>
                    </form>
                  )}
                  <ScheduleMaterialsList rows={data!.scheduleExtras} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>강의를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 강의는 되돌릴 수 없습니다. 수강생, 자료, 일정 연결도 함께 영향을 받을 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCourse();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StudentList({ students }: { students: CourseEnrollment[] }) {
  if (!students.length) {
    return (
      <p className="text-sm text-muted-foreground">등록된 수강생이 없습니다.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {students.map((s) => (
        <li
          key={s.userId}
          className="flex flex-col rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
        >
          <span className="font-medium">{s.name || "(이름 없음)"}</span>
          <span className="text-xs text-muted-foreground">
            {s.email || s.userId}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            등록: {new Date(s.joinedAt).toLocaleString("ko-KR")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ScriptList({ scripts }: { scripts: CourseScriptListItem[] }) {
  if (!scripts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        업로드된 스크립트가 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {scripts.map((sc) => (
        <li
          key={sc.scriptId}
          className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
        >
          <span className="font-medium">{sc.title}</span>
          <span className="text-xs text-muted-foreground">
            {sc.fileName} ·{" "}
            {sc.weekNumber != null ? `${sc.weekNumber}주차` : "주차 미지정"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(sc.uploadedAt).toLocaleString("ko-KR")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ScheduleMaterialsList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadCourseWorkspace>>["scheduleExtras"];
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        등록된 주차 스케줄이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map(({ schedule, preview, review }) => (
        <div
          key={schedule.scheduleId}
          className="rounded-xl border border-border/60 bg-card/50 p-4"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">
              {schedule.weekNumber}주차 · {schedule.topic || "주제 미정"}
            </span>
            {schedule.date && (
              <Badge variant="outline" className="text-xs">
                {schedule.date}
              </Badge>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                예습 가이드
              </p>
              {preview ? (
                <>
                  <p className="font-medium">{preview.title}</p>
                </>
              ) : (
                <p className="text-muted-foreground">아직 없음</p>
              )}
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                복습 요약
              </p>
              {review ? (
                <>
                  <p className="font-medium">{review.title}</p>
                </>
              ) : (
                <p className="text-muted-foreground">아직 없음</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 기능 바로가기 컴포넌트 ────────────────────────────────────────────────────

type NavItem = {
  label: string;
  description: string;
  icon: React.ElementType;
  dest: string;
  color: string;
  instructorOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "강의 자료",
    description: "스크립트 업로드·분석, 예습/복습 생성",
    icon: FileText,
    dest: "/materials",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    label: "퀴즈 관리",
    description: "퀴즈 출제, 이해도 리포트 확인",
    icon: HelpCircle,
    dest: "/quiz",
    color: "text-violet-500 bg-violet-500/10",
  },
  {
    label: "공지사항",
    description: "예습·복습 공지문 생성 및 배포",
    icon: Bell,
    dest: "/announcements",
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    label: "AI 학생 시뮬레이션",
    description: "강의 자료 이해도 사전 진단",
    icon: Bot,
    dest: "ai-simulation", // 상대 경로 — onNavigate에서 /courses/{id}/ai-simulation 으로 변환
    color: "text-emerald-500 bg-emerald-500/10",
    instructorOnly: true,
  },
];

function QuickNav({
  courseId,
  course,
  isInstructor,
  onNavigate,
}: {
  courseId: string;
  course: { courseId: string };
  isInstructor: boolean;
  onNavigate: (dest: string) => void;
}) {
  const items = NAV_ITEMS.filter((item) => !item.instructorOnly || isInstructor);

  const resolveDest = (item: NavItem) =>
    item.dest === "ai-simulation" ? `/courses/${courseId}/ai-simulation` : item.dest;

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold tracking-tight">기능 바로가기</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(resolveDest(item))}
            className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
          >
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
              <item.icon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
