"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { getInvitePreview, joinCourseByInviteToken, type CourseInvitePreview } from "@/lib/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Loader2, Calendar, User, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
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
  return raw;
}

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();
  
  const [status, setStatus] = useState<"idle" | "loading" | "preview" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CourseInvitePreview | null>(null);
  const [joinedCourseId, setJoinedCourseId] = useState<string | null>(null);

  // 로그인 체크 및 리다이렉트
  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      const next = token.length > 0 ? `/join?token=${encodeURIComponent(token)}` : "/join";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, isLoading, isHydrated, router, token]);

  // 초대 정보 미리보기 로딩
  useEffect(() => {
    if (!isHydrated || isLoading || !user || !token) return;
    
    // 교수 계정인 경우 미리 경고
    if (user.role === "INSTRUCTOR") {
      setStatus("error");
      setMessage("강사 계정으로는 수강 등록을 할 수 없습니다. 학생 계정으로 이용해주세요.");
      return;
    }

    const fetchPreview = async () => {
      setStatus("loading");
      try {
        const data = await getInvitePreview(token);
        setPreview(data);
        if (data.isExpired) {
          setStatus("error");
          setMessage("만료된 초대 링크입니다. 강사에게 새 링크를 요청해주세요.");
        } else {
          setStatus("preview");
        }
      } catch (e) {
        setStatus("error");
        setMessage(toKoreanJoinError(e));
      }
    };

    fetchPreview();
  }, [isHydrated, isLoading, user, token]);

  const handleJoin = async () => {
    if (!token || !user || user.role !== "STUDENT") return;
    
    setStatus("joining");
    setMessage(null);
    try {
      const res = await joinCourseByInviteToken(token);
      setJoinedCourseId(res.courseId);
      setStatus("done");
      setMessage(res.message ?? "수강 등록이 완료되었습니다.");
      
      // 등록 성공 시 1.5초 후 강의실로 이동
      setTimeout(() => {
        router.push(`/courses/${res.courseId}`);
      }, 1500);
    } catch (e) {
      setStatus("error");
      setMessage(toKoreanJoinError(e));
    }
  };

  if (!isHydrated || isLoading || status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4 size-8 text-primary" />
          <p className="text-sm text-muted-foreground">초대 정보를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <Card className="mx-auto max-w-md overflow-hidden border-2 shadow-lg">
      <CardHeader className="bg-primary/5 text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpen className="size-6" />
        </div>
        <CardTitle className="text-xl">강의 초대</CardTitle>
        <CardDescription>초대된 강의 정보를 확인하고 참여를 확정하세요.</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {!token && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>토큰 없음</AlertTitle>
            <AlertDescription>유효한 초대 링크를 통해 접속해주세요.</AlertDescription>
          </Alert>
        )}

        {preview && status !== "error" && status !== "done" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-green-500" />
                <div>
                  <h3 className="font-bold text-lg leading-tight">{preview.courseName}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {preview.description || "강의 설명이 없습니다."}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 pt-2 border-t text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-4" />
                  <span>담당 교수: <strong>{preview.instructorName}</strong></span>
                </div>
                {preview.expiresAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-4" />
                    <span>초대 만료: {new Date(preview.expiresAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-xs text-center text-muted-foreground px-4">
              [참여 수락] 버튼을 누르면 즉시 수강생 목록에 등록되며,<br />
              강의 자료 및 퀴즈에 접근할 수 있습니다.
            </p>
          </div>
        )}

        {status === "joining" && (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">수강 신청을 처리하고 있습니다...</p>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">수강 등록 완료!</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          </div>
        )}

        {status === "error" && message && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>알림</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 bg-muted/30 pb-6 pt-2">
        {status === "preview" && user.role === "STUDENT" && (
          <Button className="w-full text-base font-bold h-11" onClick={handleJoin}>
            참여 수락
          </Button>
        )}
        
        {status === "error" && token && user.role === "STUDENT" && !message?.includes("만료") && !message?.includes("이미") && (
          <Button className="w-full" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        )}

        {(status === "done" || (status === "error" && message?.includes("이미"))) && joinedCourseId && (
          <Button variant="default" className="w-full" asChild>
            <Link href={`/courses/${joinedCourseId}`}>강의실로 입장</Link>
          </Button>
        )}

        <Button variant="ghost" className="w-full text-muted-foreground" asChild>
          <Link href={user.role === "INSTRUCTOR" ? "/" : "/dashboard"}>
            {user.role === "INSTRUCTOR" ? "대시보드" : "강의 목록으로 가기"}
          </Link>
        </Button>
      </CardFooter>
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
