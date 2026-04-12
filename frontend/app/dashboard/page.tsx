"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { getCourses, type Course } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Clock, Plus, Users } from "lucide-react";

function formatDays(days: string[]) {
  if (!days?.length) return "요일 미정";
  return days.join(" · ");
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.courseId}`} className="block h-full">
      <Card className="h-full transition-all hover:border-primary/30 hover:shadow-md">
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-lg leading-snug">{course.courseName}</CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {course.semester}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {course.description?.trim() || "설명이 없습니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" />
            <span>{formatDays(course.dayOfWeek)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" />
            <span>
              {course.startTime && course.endTime
                ? `${course.startTime} – ${course.endTime}`
                : "시간 미정"}
            </span>
          </div>
          {course.maxStudents != null && (
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0" />
              <span>정원 {course.maxStudents}명</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, isHydrated, router]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      setListLoading(true);
      setLoadError(null);
      try {
        const res = await getCourses();
        setCourses(res.courses);
        setTotalCount(res.totalCount);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "강의 목록을 불러오지 못했습니다.";
        setLoadError(msg);
        setCourses([]);
        setTotalCount(0);
      } finally {
        setListLoading(false);
      }
    };

    void run();
  }, [user]);

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

  const isInstructor = user.role === "INSTRUCTOR";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">강의</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isInstructor
                ? "담당 중인 강의를 선택하거나 새로 개설하세요."
                : "수강 중인 강의 목록입니다."}
            </p>
          </div>
          {isInstructor && (
            <Button asChild className="shrink-0 gap-2">
              <Link href="/courses/create">
                <Plus className="size-4" />
                강의 개설
              </Link>
            </Button>
          )}
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>목록을 불러올 수 없습니다</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {listLoading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-10 text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">등록된 강의가 없습니다.</p>
              {isInstructor && (
                <Button asChild>
                  <Link href="/courses/create">첫 강의 만들기</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">총 {totalCount}개</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((c) => (
                <CourseCard key={c.courseId} course={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
