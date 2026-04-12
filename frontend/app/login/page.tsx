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
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await signIn(email, password);

      if (success) {
        router.push("/");
      } else {
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      let errorMessage = "로그인 중 오류가 발생했습니다.";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="text-xl">{"로그인"}</CardTitle>
          <CardDescription>{"계정 정보를 입력하세요"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{"이메일"}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="비밀번호를 입력하세요"
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
                  {"로그인 중..."}
                </>
              ) : (
                "로그인"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {"비밀번호를 잊으셨나요?"}
            </Link>
          </div>

          <div className="mt-6 border-t pt-4">
            <p className="text-center text-sm text-muted-foreground">
              {"아직 계정이 없으신가요?"}
              <Link
                href="/register"
                className="ml-1 font-medium text-primary hover:underline"
              >
                {"회원가입"}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
