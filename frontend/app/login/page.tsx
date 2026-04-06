"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await login(username, password);
    
    if (success) {
      router.push("/");
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
          <GraduationCap className="size-9 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{"EduFlow"}</h1>
          <p className="text-sm text-muted-foreground">{"스마트 교육 플랫폼"}</p>
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
                <FieldLabel htmlFor="username">{"아이디"}</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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

          <div className="mt-6 rounded-lg bg-muted/50 p-4">
            <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{"테스트 계정"}</p>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                <span className="font-medium text-foreground">{"강사"}</span>
                <span className="text-muted-foreground">{"teacher / teacher"}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                <span className="font-medium text-foreground">{"학생"}</span>
                <span className="text-muted-foreground">{"student / student"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
