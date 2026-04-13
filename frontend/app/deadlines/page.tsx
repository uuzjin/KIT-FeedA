"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { getReminders, dismissReminder, type Reminder } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, Clock, X, AlertCircle, Settings } from "lucide-react";

function getReminderStyle(status: Reminder["status"]) {
  switch (status) {
    case "pending":
      return {
        bg: "bg-amber-500/10",
        icon: "text-amber-500",
        badge: "secondary" as const,
      };
    case "sent":
      return {
        bg: "bg-blue-500/10",
        icon: "text-blue-500",
        badge: "default" as const,
      };
    case "dismissed":
      return {
        bg: "bg-muted",
        icon: "text-muted-foreground",
        badge: "outline" as const,
      };
  }
}

function getStatusLabel(status: Reminder["status"]) {
  switch (status) {
    case "pending":
      return "대기 중";
    case "sent":
      return "발송됨";
    case "dismissed":
      return "해제됨";
  }
}

export default function DeadlinesPage() {
  const { user, isLoading: isAuthLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, isHydrated, router]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getReminders(user.id);
        setReminders(res.reminders);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "마감일 정보를 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const handleDismiss = async (reminderId: string) => {
    if (!user?.id) return;
    setDismissingId(reminderId);
    try {
      await dismissReminder(user.id, reminderId);
      setReminders((prev) =>
        prev.map((r) =>
          r.reminderId === reminderId ? { ...r, status: "dismissed" } : r,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알림 해제에 실패했습니다.",
      );
    } finally {
      setDismissingId(null);
    }
  };

  if (!isHydrated || isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const pendingReminders = reminders.filter((r) => r.status === "pending");
  const otherReminders = reminders.filter((r) => r.status !== "pending");

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{"마감일"}</h1>
            <p className="text-sm text-muted-foreground">
              {pendingReminders.length > 0
                ? `대기 중인 알림 ${pendingReminders.length}개`
                : "예정된 마감일이 없습니다"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/settings/reminders">
              <Settings className="size-4" />
              {"알림 설정"}
            </Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{"오류"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : reminders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Calendar className="size-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {"마감일 알림이 없습니다."}
              </p>
              <p className="text-xs text-muted-foreground">
                {"강의별 마감일이 등록되면 여기에 표시됩니다."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingReminders.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {"대기 중인 알림"}
                </h2>
                <div className="flex flex-col gap-2">
                  {pendingReminders.map((reminder) => {
                    const style = getReminderStyle(reminder.status);
                    return (
                      <Card key={reminder.reminderId} className="border-border/40">
                        <CardContent className="flex items-start justify-between p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.bg}`}
                            >
                              <Clock className={`size-5 ${style.icon}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground">
                                  {reminder.title}
                                </p>
                                <Badge
                                  variant={style.badge}
                                  className="h-4 px-1.5 text-[10px]"
                                >
                                  {getStatusLabel(reminder.status)}
                                </Badge>
                              </div>
                              {reminder.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {reminder.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="size-3" />
                                <span>
                                  {new Date(reminder.dueDate).toLocaleString(
                                    "ko-KR",
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            disabled={dismissingId === reminder.reminderId}
                            onClick={() => handleDismiss(reminder.reminderId)}
                          >
                            {dismissingId === reminder.reminderId ? (
                              <Spinner className="size-3" />
                            ) : (
                              <X className="size-4" />
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {otherReminders.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                  {"이전 알림"}
                </h2>
                <div className="flex flex-col gap-2">
                  {otherReminders.map((reminder) => {
                    const style = getReminderStyle(reminder.status);
                    return (
                      <Card
                        key={reminder.reminderId}
                        className="border-border/40 opacity-60"
                      >
                        <CardContent className="flex items-start gap-3 p-4">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.bg}`}
                          >
                            <Clock className={`size-5 ${style.icon}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">
                                {reminder.title}
                              </p>
                              <Badge
                                variant={style.badge}
                                className="h-4 px-1.5 text-[10px]"
                              >
                                {getStatusLabel(reminder.status)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(reminder.dueDate).toLocaleString(
                                "ko-KR",
                              )}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
