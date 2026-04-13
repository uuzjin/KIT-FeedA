"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import {
  getReminderSettings,
  updateReminderSettings,
  type ReminderSettings,
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
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
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
        const res = await getReminderSettings(user.id);
        setSettings(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "설정을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const toggleChannel = (channelId: string) => {
    if (!settings) return;
    const channels = settings.channels.includes(channelId)
      ? settings.channels.filter((c) => c !== channelId)
      : [...settings.channels, channelId];
    setSettings({ ...settings, channels });
  };

  const handleSave = async () => {
    if (!settings || !user?.id) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateReminderSettings(user.id, {
        channels: settings.channels,
        hoursBefore: settings.hoursBefore,
        quizNotifications: settings.quizNotifications,
        materialNotifications: settings.materialNotifications,
      });
      setSettings(updated);
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
          <h1 className="text-xl font-bold text-foreground">{"마감 리마인더 설정"}</h1>
          <p className="text-sm text-muted-foreground">
            {"마감일 알림 채널과 알림 시간을 설정합니다."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{"오류"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading || !settings ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : (
          <>
            {/* 알림 채널 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{"알림 채널"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                {CHANNELS.map(({ id, label, icon: Icon }) => (
                  <div key={id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <Label htmlFor={`channel-${id}`} className="cursor-pointer text-sm font-medium">
                        {label}
                      </Label>
                    </div>
                    <Switch
                      id={`channel-${id}`}
                      checked={settings.channels.includes(id)}
                      onCheckedChange={() => toggleChannel(id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 알림 종류 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{"알림 종류"}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quiz-notif" className="cursor-pointer text-sm font-medium">
                    {"퀴즈 알림"}
                  </Label>
                  <Switch
                    id="quiz-notif"
                    checked={settings.quizNotifications}
                    onCheckedChange={(v) => setSettings({ ...settings, quizNotifications: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="material-notif" className="cursor-pointer text-sm font-medium">
                    {"학습 자료 알림"}
                  </Label>
                  <Switch
                    id="material-notif"
                    checked={settings.materialNotifications}
                    onCheckedChange={(v) => setSettings({ ...settings, materialNotifications: v })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 마감 알림 시간 */}
            <Card className="border-border/40">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">{"마감 알림 시간"}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {"마감 몇 시간 전에 알림을 받을지 설정합니다."}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{"첫 번째 알림"}</span>
                  <span className="text-sm font-semibold text-primary">
                    {settings.hoursBefore[0] ?? 24}{"시간 전"}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={72}
                  step={1}
                  value={[settings.hoursBefore[0] ?? 24]}
                  onValueChange={([v]) =>
                    setSettings({ ...settings, hoursBefore: [v, ...(settings.hoursBefore.slice(1))] })
                  }
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{"1시간"}</span>
                  <span>{"72시간"}</span>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Spinner className="size-4" />{"저장 중..."}</>
              ) : saved ? (
                <><Check className="size-4" />{"저장 완료!"}</>
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
