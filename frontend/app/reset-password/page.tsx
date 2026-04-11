"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidLink, setIsValidLink] = useState(true);
  const { updatePassword } = useAuth();
  const router = useRouter();

  // Check if user has valid session (from reset link)
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsValidLink(false);
        setError("유효하지 않은 재설정 링크입니다. 다시 시도해주세요.");
      }
    };

    checkSession();
  }, []);

  const validateForm = (): boolean => {
    if (!password || !confirmPassword) {
      setError("모든 필드를 입력해주세요.");
      return false;
    }

    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return false;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
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
      await updatePassword(password);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      let errorMessage = "비밀번호 변경에 실패했습니다.";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      console.error("Reset password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidLink) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-primary/5 via-background to-primary/10 p-4">
        <Card className="w-full max-w-sm border-border/40 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="size-8 text-red-600 dark:text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {"링크가 유효하지 않습니다."}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {"비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {"다시 시도해주세요."}
              </p>
            </div>
            <Button
              onClick={() => router.push("/forgot-password")}
              className="mt-4 w-full"
            >
              {"재설정 요청하기"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                {"비밀번호가 변경되었습니다!"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {"로그인 페이지로 이동 중입니다..."}
              </p>
            </div>
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
          <CardTitle className="text-xl">{"새 비밀번호 설정"}</CardTitle>
          <CardDescription>
            {"새로운 비밀번호를 입력해주세요."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">{"새 비밀번호"}</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="최소 8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4 text-muted-foreground" />
                    ) : (
                      <Eye className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  {"비밀번호 확인"}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4 text-muted-foreground" />
                    ) : (
                      <Eye className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
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
                  {"변경 중..."}
                </>
              ) : (
                "비밀번호 변경"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
