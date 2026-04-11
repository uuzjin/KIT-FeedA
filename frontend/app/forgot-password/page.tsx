"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Loader2, Check, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { resetPasswordForEmail } = useAuth();

  const validateForm = (): boolean => {
    if (!email) {
      setError("이메일을 입력해주세요.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 주소를 입력해주세요.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordForEmail(email);
      setIsSuccess(true);
    } catch (err) {
      let errorMessage = "비밀번호 재설정 요청에 실패했습니다.";

      if (err instanceof Error) {
        if (err.message.includes("User not found")) {
          errorMessage = "등록되지 않은 이메일입니다.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-primary/5 via-background to-primary/10 p-4">
        <Card className="w-full max-w-sm border-border/40 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="size-8 text-green-600 dark:text-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {"재설정 메일이 전송되었습니다!"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {"입력하신 이메일 주소로 비밀번호 재설정 링크를 보냈습니다."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {"메일함을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요."}
              </p>
            </div>
            <Link href="/login" className="mt-4 w-full">
              <Button className="w-full">{"로그인 페이지로 돌아가기"}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="mb-5 flex flex-col items-center gap-3">
        <img src="/logo.svg" alt="KIT FeedA" className="width-30" />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {"더 나은 학습 환경을 피워내다"}
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm border-border/40 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <CardTitle className="text-xl">{"비밀번호 재설정"}</CardTitle>
          <CardDescription>
            {"계정과 연결된 이메일을 입력해주세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{"이메일"}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@university.ac.kr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </Field>
            </FieldGroup>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {"전송 중..."}
                </>
              ) : (
                "재설정 링크 받기"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {"로그인으로 돌아가기"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
