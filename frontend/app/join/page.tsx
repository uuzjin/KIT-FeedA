"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { joinCourseByInviteToken } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function toKoreanJoinError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "수강 등록에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
  const raw = err.message.trim();
  if (!raw) {
    return "수강 등록에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (raw.includes("학생만")) {
    return "초대 링크 수락은 학생 계정으로만 할 수 있습니다. 학생 계정으로 로그인한 뒤 다시 시도해주세요.";
  }
  if (raw.includes("이미 이 강의에")) {
    return "이미 이 강의에 등록되어 있습니다.";
  }
  if (raw.includes("유효하지 않은 초대") || raw.includes("RESOURCE_NOT_FOUND")) {
    return "유효하지 않거나 만료된 초대 링크입니다.";
  }
  if (raw.includes("만료된 초대") || raw.includes("RESOURCE_GONE")) {
    return "만료된 초대 링크입니다. 강사에게 새 링크를 요청해주세요.";
  }
  if (raw.includes("인증 토큰")) {
    return raw;
  }
  return raw;
}

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [joinedCourseId, setJoinedCourseId] = useState<string | null>(null);
  const [manualJoining, setManualJoining] = useState(false);
  const autoJoinStarted = useRef(false);

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      const next =
        token.length > 0
          ? `/join?token=${encodeURIComponent(token)}`
          : "/join";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, isLoading, isHydrated, router, token]);

  useEffect(() => {
    if (!isHydrated || isLoading || !user || !token || user.role !== "STUDENT") {
      return;
    }
    if (autoJoinStarted.current) {
      return;
    }
    autoJoinStarted.current = true;

    queueMicrotask(() => {
      setStatus("joining");
      setMessage(null);
    });

    void (async () => {
      try {
        const res = await joinCourseByInviteToken(token);
        setJoinedCourseId(res.courseId);
        setStatus("done");
        setMessage(res.message ?? "수강 등록이 완료되었습니다.");
        router.replace(`/courses/${res.courseId}`);
      } catch (e) {
        setStatus("error");
        setMessage(toKoreanJoinError(e));
        autoJoinStarted.current = false;
      }
    })();
  }, [isHydrated, isLoading, user, token, router]);

  const handleJoin = async () => {
    if (!token) {
      setStatus("error");
      setMessage("유효한 초대 링크가 아닙니다.");
      return;
    }
    if (user?.role !== "STUDENT") {
      setStatus("error");
      setMessage("초대 링크 수락은 학생 계정으로만 할 수 있습니다.");
      return;
    }
    setManualJoining(true);
    setStatus("joining");
    setMessage(null);
    try {
      const res = await joinCourseByInviteToken(token);
      setJoinedCourseId(res.courseId);
      setStatus("done");
      setMessage(res.message ?? "수강 등록이 완료되었습니다.");
      router.replace(`/courses/${res.courseId}`);
    } catch (e) {
      setStatus("error");
      setMessage(toKoreanJoinError(e));
    } finally {
      setManualJoining(false);
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (token && user.role !== "STUDENT") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>강의 초대</CardTitle>
          <CardDescription>초대 링크로 이 강의에 수강 등록합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>계정 안내</AlertTitle>
            <AlertDescription>
              초대 링크 수락은 학생 계정으로만 할 수 있습니다. 학생 계정으로 로그인한 뒤 링크를 다시 열어주세요.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/">대시보드</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>강의 초대</CardTitle>
        <CardDescription>초대 링크로 이 강의에 수강 등록합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token && (
          <Alert variant="destructive">
            <AlertTitle>토큰 없음</AlertTitle>
            <AlertDescription>초대 URL에 token 파라미터가 필요합니다.</AlertDescription>
          </Alert>
        )}

        {status === "joining" && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            수강 등록 처리 중…
          </div>
        )}

        {status === "done" && joinedCourseId && (
          <Alert>
            <AlertTitle>완료</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {status === "error" && message && (
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {token && user.role === "STUDENT" && status === "error" && (
          <Button className="w-full" onClick={handleJoin} disabled={manualJoining}>
            다시 시도
          </Button>
        )}

        {joinedCourseId && status !== "joining" && (
          <Button variant="secondary" className="w-full" asChild>
            <Link href={`/courses/${joinedCourseId}`}>강의 상세로 이동</Link>
          </Button>
        )}

        <Button variant="outline" className="w-full" asChild>
          <Link href={user?.role === "INSTRUCTOR" ? "/" : "/dashboard"}>
            {user?.role === "INSTRUCTOR" ? "대시보드" : "강의 목록"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function JoinPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-12">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Spinner className="size-10 text-primary" />
            </div>
          }
        >
          <JoinContent />
        </Suspense>
      </div>
    </AppShell>
  );
}
