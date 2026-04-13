"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { getCourses, type Course } from "@/lib/api";
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
import { BookOpen, CalendarDays, Clock, Plus, Users } from "lucide-react";

function formatDays(days: string[] | undefined) {
  if (!days?.length) return "요일 미정";
  return days.join(" · ");
}

export default function CoursesPage() {
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      router.push("/login");
    }
    if (isHydrated && !isLoading && user && user.role !== "INSTRUCTOR") {
      router.push("/dashboard");
    }
  }, [user, isLoading, isHydrated, router]);

  useEffect(() => {
    if (!user || user.role !== "INSTRUCTOR") return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getCourses();
        setCourses(res.courses);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "강의 목록을 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  if (!isHydrated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "INSTRUCTOR") {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">내 강의</h1>
            <p className="text-sm text-muted-foreground">
              개설한 강의를 관리하세요.
            </p>
          </div>
          <Button asChild>
            <Link href="/courses/create">
              <Plus className="mr-2 size-4" />
              강의 개설
            </Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner className="size-8 text-primary" />
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <BookOpen className="size-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground">
                  개설한 강의가 없습니다.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  강의를 개설하면 여기에 표시됩니다.
                </p>
              </div>
              <Button asChild>
                <Link href="/courses/create">
                  <Plus className="mr-2 size-4" />
                  첫 강의 개설하기
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.courseId}
                href={`/courses/${course.courseId}`}
                className="block"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {course.courseName}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {course.semester}
                      </Badge>
                    </div>
                    {course.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {course.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {formatDays(course.dayOfWeek)}
                      </span>
                      {course.startTime && course.endTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {course.startTime} – {course.endTime}
                        </span>
                      )}
                      {course.maxStudents != null && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          정원 {course.maxStudents}명
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
