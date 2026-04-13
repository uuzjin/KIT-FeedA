"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotifications,
  markNotificationAsRead,
  type Notification,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, CheckCheck, AlertCircle } from "lucide-react";

export default function NotificationsPage() {
  const { user, isLoading: isAuthLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

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
        const res = await getNotifications(user.id);
        setNotifications(res.notifications);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "알림을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    setMarkingId(notificationId);
    try {
      await markNotificationAsRead(user.id, notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, read: true } : n,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "읽음 처리에 실패했습니다.",
      );
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      await handleMarkAsRead(n.notificationId);
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{"알림"}</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `읽지 않은 알림 ${unreadCount}개`
                : "모든 알림을 읽었습니다"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="size-4" />
              {"모두 읽음"}
            </Button>
          )}
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
        ) : notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Bell className="size-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {"알림이 없습니다."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => (
              <Card
                key={notification.notificationId}
                className={`border-border/40 transition-colors ${
                  !notification.read
                    ? "border-primary/20 bg-primary/5"
                    : ""
                }`}
              >
                <CardContent className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        !notification.read ? "bg-primary/20" : "bg-muted"
                      }`}
                    >
                      <Bell
                        className={`size-5 ${
                          !notification.read
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <Badge className="h-4 px-1.5 text-[10px]">
                            {"NEW"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString(
                          "ko-KR",
                        )}
                      </p>
                    </div>
                  </div>
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={markingId === notification.notificationId}
                      onClick={() =>
                        handleMarkAsRead(notification.notificationId)
                      }
                    >
                      {markingId === notification.notificationId ? (
                        <Spinner className="size-3" />
                      ) : (
                        "읽음"
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
