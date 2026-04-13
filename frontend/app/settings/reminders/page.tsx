"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Bell, Mail, Smartphone, MessageSquare, Check } from "lucide-react";

const CHANNELS = [
  { id: "EMAIL", label: "이메일", icon: Mail },
  { id: "PUSH", label: "푸시 알림", icon: Smartphone },
  { id: "IN_APP", label: "인앱 알림", icon: Bell },
  { id: "KAKAO", label: "카카오톡", icon: MessageSquare },
] as const;

export default function ReminderSettingsPage() {
  const { user, isLoading: isAuthLoading, isHydrated } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        const res = await getNotificationPreferences(user.id);
        setPrefs(res);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "설정을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const toggleChannel = (channelId: string) => {
    if (!prefs) return;
    const channels = prefs.channels.includes(channelId)
      ? prefs.channels.filter((c) => c !== channelId)
      : [...prefs.channels, channelId];
    setPrefs({ ...prefs, channels });
  };

  const handleSave = async () => {
    if (!prefs || !user?.id) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateNotificationPreferences(user.id, prefs);
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
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

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-24">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"알림 설정"}</h1>
          <p className="text-sm text-muted-foreground">
            {"알림 채널과 마감 알림 시간을 설정합니다."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{"오류"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading || !prefs ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : (
          <>
            {/* 알림 채널 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  {"알림 채널"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                {CHANNELS.map(({ id, label, icon: Icon }) => (
                  <div key={id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <Label
                        htmlFor={`channel-${id}`}
                        className="cursor-pointer text-sm font-medium"
                      >
                        {label}
                      </Label>
                    </div>
                    <Switch
                      id={`channel-${id}`}
                      checked={prefs.channels.includes(id)}
                      onCheckedChange={() => toggleChannel(id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 알림 종류 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  {"알림 종류"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="quiz-notif"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {"퀴즈 알림"}
                  </Label>
                  <Switch
                    id="quiz-notif"
                    checked={prefs.quizNotifications}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, quizNotifications: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="material-notif"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {"학습 자료 알림"}
                  </Label>
                  <Switch
                    id="material-notif"
                    checked={prefs.materialNotifications}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, materialNotifications: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="deadline-notif"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {"마감일 알림"}
                  </Label>
                  <Switch
                    id="deadline-notif"
                    checked={prefs.deadlineNotifications}
                    onCheckedChange={(v) =>
                      setPrefs({ ...prefs, deadlineNotifications: v })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 마감 알림 시간 (deadlineNotifications 켜져 있을 때만) */}
            {prefs.deadlineNotifications && (
              <Card className="border-border/40">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-semibold">
                    {"마감 알림 시간"}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {"마감 몇 시간 전에 알림을 받을지 설정합니다."}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {"알림 시간"}
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {prefs.deadlineHoursBefore}
                      {"시간 전"}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={72}
                    step={1}
                    value={[prefs.deadlineHoursBefore]}
                    onValueChange={([v]) =>
                      setPrefs({ ...prefs, deadlineHoursBefore: v })
                    }
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{"1시간"}</span>
                    <span>{"72시간"}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Spinner className="size-4" />
                  {"저장 중..."}
                </>
              ) : saved ? (
                <>
                  <Check className="size-4" />
                  {"저장 완료!"}
                </>
              ) : (
                "설정 저장"
              )}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}
