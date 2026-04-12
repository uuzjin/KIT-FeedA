"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { createCourse, createCourseInvite, type CourseInviteResponse } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, CheckCircle2, Copy, Loader2 } from "lucide-react";

function toKoreanCreateError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "강의를 만들지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  const raw = err.message.trim();
  if (!raw) {
    return "강의를 만들지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (/^HTTP error/i.test(raw) || /^fetch/i.test(raw)) {
    return "서버와 통신하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.";
  }
  if (raw.includes("인증 토큰")) {
    return raw;
  }
  return raw;
}

const DAY_OPTIONS = [
  { value: "월", label: "월" },
  { value: "화", label: "화" },
  { value: "수", label: "수" },
  { value: "목", label: "목" },
  { value: "금", label: "금" },
  { value: "토", label: "토" },
  { value: "일", label: "일" },
];

export default function CreateCoursePage() {
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();

  const [courseName, setCourseName] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxStudents, setMaxStudents] = useState("50");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [invite, setInvite] = useState<CourseInviteResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, isHydrated, router]);

  useEffect(() => {
    if (isHydrated && !isLoading && user && user.role !== "INSTRUCTOR") {
      router.replace("/");
    }
  }, [user, isLoading, isHydrated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteError(null);
    setInvite(null);
    setCreatedCourseId(null);
    if (!courseName.trim() || !semester.trim()) {
      setError("강의명과 학기를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const max = parseInt(maxStudents, 10);
      const course = await createCourse({
        courseName: courseName.trim(),
        semester: semester.trim(),
        dayOfWeek,
        startTime: startTime.trim() || null,
        endTime: endTime.trim() || null,
        maxStudents: Number.isFinite(max) ? max : 50,
        description: description.trim() || undefined,
      });
      setCreatedCourseId(course.courseId);
      try {
        const inv = await createCourseInvite(course.courseId);
        setInvite(inv);
      } catch (invErr) {
        setInviteError(toKoreanCreateError(invErr));
      }
    } catch (err) {
      setError(toKoreanCreateError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!invite?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("클립보드 복사에 실패했습니다.");
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

  if (!user || user.role !== "INSTRUCTOR") {
    return null;
  }

  const showSuccess = Boolean(createdCourseId);

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div>
          <Button variant="ghost" size="sm" className="mb-4 gap-1 px-0 text-muted-foreground" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              대시보드
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">강의 개설</h1>
          <p className="mt-1 text-sm text-muted-foreground">기본 정보를 입력한 뒤 저장하면 강의실이 생성됩니다.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showSuccess && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertTitle>강의가 생성되었습니다</AlertTitle>
            <AlertDescription className="space-y-3 pt-2">
              {invite && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    아래 링크를 학생에게 공유하면 로그인 후 수강 등록할 수 있습니다.
                  </p>
                  <Label className="text-xs">초대 링크</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={invite.inviteLink} className="font-mono text-xs" />
                    <Button type="button" variant="secondary" onClick={copyInviteLink} className="shrink-0 gap-1">
                      <Copy className="size-4" />
                      {copied ? "복사됨" : "복사"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    만료: {new Date(invite.expiresAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              )}
              {inviteError && (
                <p className="text-sm text-destructive">
                  초대 링크는 자동으로 만들지 못했습니다. 강의 상세에서 다시 발급할 수 있습니다. ({inviteError})
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {createdCourseId && (
                  <Button asChild variant="default">
                    <Link href={`/courses/${createdCourseId}`}>강의 상세로 이동</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/">대시보드</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>강의 정보</CardTitle>
            <CardDescription>제목, 학기, 요일·시간은 이후에도 수정할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="courseName">강의명</Label>
                <Input
                  id="courseName"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="예: 데이터베이스 개론"
                  required
                  autoComplete="off"
                  disabled={showSuccess}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semester">학기</Label>
                <Input
                  id="semester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="예: 2026-1"
                  required
                  autoComplete="off"
                  disabled={showSuccess}
                />
              </div>

              <div className="space-y-2">
                <Label>요일</Label>
                <ToggleGroup
                  type="multiple"
                  value={dayOfWeek}
                  onValueChange={setDayOfWeek}
                  className="flex flex-wrap justify-start gap-1"
                  disabled={showSuccess}
                >
                  {DAY_OPTIONS.map((d) => (
                    <ToggleGroupItem key={d.value} value={d.value} className="px-3">
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startTime">시작</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={showSuccess}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">종료</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={showSuccess}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStudents">정원</Label>
                <Input
                  id="maxStudents"
                  type="number"
                  min={1}
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(e.target.value)}
                  disabled={showSuccess}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="강의 소개, 과제 안내 등"
                  rows={4}
                  disabled={showSuccess}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || showSuccess}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    저장 중...
                  </>
                ) : showSuccess ? (
                  "강의 생성 완료"
                ) : (
                  "강의 만들기"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
