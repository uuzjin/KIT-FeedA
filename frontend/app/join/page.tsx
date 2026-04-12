"use client";

import { Suspense, useEffect, useState } from "react";
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

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [joinedCourseId, setJoinedCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      const next =
        token.length > 0
          ? `/join?token=${encodeURIComponent(token)}`
          : "/join";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, isLoading, isHydrated, router, token]);

  const handleJoin = async () => {
    if (!token) {
      setStatus("error");
      setMessage("유효한 초대 링크가 아닙니다.");
      return;
    }
    setStatus("joining");
    setMessage(null);
    try {
      const res = await joinCourseByInviteToken(token);
      setJoinedCourseId(res.courseId);
      setStatus("done");
      setMessage(res.message);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "수강 등록에 실패했습니다.");
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

        {token && status !== "done" && (
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={status === "joining"}
          >
            {status === "joining" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                등록 중...
              </>
            ) : (
              "이 강의 수강하기"
            )}
          </Button>
        )}

        {joinedCourseId && (
          <Button variant="secondary" className="w-full" asChild>
            <Link href={`/courses/${joinedCourseId}`}>강의 상세로 이동</Link>
          </Button>
        )}

        <Button variant="outline" className="w-full" asChild>
          <Link href="/dashboard">강의 목록</Link>
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
