"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const validateForm = (): boolean => {
    if (!email || !name || !password || !confirmPassword) {
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
      const result = await signUp(email, password, name, role);

      if (result) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError("회원가입에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      // Handle various error types
      let errorMessage = "회원가입 중 오류가 발생했습니다.";
      
      if (err instanceof Error) {
        if (err.message.includes("User already registered")) {
          errorMessage = "이미 등록된 이메일입니다.";
        } else if (err.message.includes("Invalid")) {
          errorMessage = "입력값을 다시 확인해주세요.";
        } else if (err.message.includes("Network")) {
          errorMessage = "네트워크 연결을 확인해주세요.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      console.error("Sign up error:", err);
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
                회원가입이 완료되었습니다!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                로그인 페이지로 이동 중입니다...
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
          <CardTitle className="text-xl">{"회원가입"}</CardTitle>
          <CardDescription>{"새 계정을 만들어보세요"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>{"역할 선택"}</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("STUDENT")}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      role === "STUDENT"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold">{"학생"}</p>
                    <p className="text-xs text-muted-foreground">{"강의 수강"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("INSTRUCTOR")}
                    className={`rounded-lg border-2 p-4 text-center transition-all ${
                      role === "INSTRUCTOR"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold">{"강사"}</p>
                    <p className="text-xs text-muted-foreground">{"강의 개설"}</p>
                  </button>
                </div>
              </Field>
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
              <Field>
                <FieldLabel htmlFor="name">{"이름"}</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{"비밀번호"}</FieldLabel>
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
                <FieldLabel htmlFor="confirmPassword">{"비밀번호 확인"}</FieldLabel>
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
                  {"가입 중..."}
                </>
              ) : (
                "회원가입"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-center text-sm text-muted-foreground">
              {"이미 계정이 있으신가요?"}
              <Link
                href="/login"
                className="ml-1 font-medium text-primary hover:underline"
              >
                {"로그인"}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
