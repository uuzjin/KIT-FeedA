"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { loadCourseWorkspace } from "@/lib/course-workspace";
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
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  Users,
} from "lucide-react";

function formatDays(days: string[]) {
  if (!days?.length) return "요일 미정";
  return days.join(" · ");
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = typeof params?.id === "string" ? params.id : "";
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof loadCourseWorkspace>
  > | null>(null);

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
        const res = await loadCourseWorkspace(courseId);
        setData(res);
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

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-1 px-0 text-muted-foreground"
            asChild
          >
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              강의 목록
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
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {course.courseName}
                  </h1>
                  <Badge variant="secondary">{course.semester}</Badge>
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

              <CourseInviteLmsPanel
                courseId={course.courseId}
                isInstructor={user.role === "INSTRUCTOR"}
              />

              <Separator className="my-8" />

              <div className="grid gap-8 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="size-5 text-primary" />
                      수강생
                    </CardTitle>
                    <CardDescription>
                      총 {data!.enrollments.totalCount}명
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StudentList students={data!.enrollments.students} />
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
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="size-5 text-primary" />
                    주차별 예습 · 복습 자료
                  </CardTitle>
                  <CardDescription>
                    스케줄에 연결된 예습 가이드와 복습 요약이 있으면 표시됩니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScheduleMaterialsList rows={data!.scheduleExtras} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
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
