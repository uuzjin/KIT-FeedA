"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import {
  getNotificationChannels,
  updateNotificationChannels,
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationChannel,
  type NotificationPreferenceItem,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Check,
  HelpCircle,
  BookOpen,
  Clock,
  Settings,
} from "lucide-react";

const CHANNEL_META: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  EMAIL: { label: "이메일", icon: Mail, description: "등록된 이메일로 알림을 받습니다" },
  PUSH: { label: "푸시 알림", icon: Smartphone, description: "기기 푸시 알림을 받습니다" },
  IN_APP: { label: "인앱 알림", icon: Bell, description: "앱 내 알림 벨을 통해 받습니다" },
  KAKAO: { label: "카카오톡", icon: MessageSquare, description: "카카오 채널 연동 후 사용 가능합니다" },
};

const PREF_META: Record<
  string,
  { label: string; icon: React.ElementType; description: string }
> = {
  QUIZ: { label: "퀴즈 알림", icon: HelpCircle, description: "새 퀴즈가 발행되면 알립니다" },
  MATERIAL: { label: "학습 자료 알림", icon: BookOpen, description: "예습/복습 자료가 준비되면 알립니다" },
  DEADLINE: { label: "마감일 알림", icon: Clock, description: "마감일이 다가오면 알립니다" },
};

export default function NotificationSettingsPage() {
  const { user, isLoading: isAuthLoading, isHydrated } = useAuth();
  const router = useRouter();

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
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
        const [chRes, prefRes] = await Promise.all([
          getNotificationChannels(user.id),
          getNotificationPreferences(user.id),
        ]);
        setChannels(chRes.channels);
        setPreferences(prefRes.preferences);
      } catch (err) {
        setError(err instanceof Error ? err.message : "설정을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const toggleChannel = (type: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.type === type ? { ...c, enabled: !c.enabled } : c)),
    );
  };

  const togglePreference = (type: string) => {
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const [chRes, prefRes] = await Promise.all([
        updateNotificationChannels(
          user.id,
          channels.map((c) => ({ type: c.type, enabled: c.enabled })),
        ),
        updateNotificationPreferences(
          user.id,
          preferences.map((p) => ({ type: p.type, enabled: p.enabled })),
        ),
      ]);
      setChannels(chRes.channels);
      setPreferences(prefRes.preferences);
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
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Settings className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{"알림 설정"}</h1>
            <p className="text-sm text-muted-foreground">
              {"알림 채널과 수신 유형을 설정합니다."}
            </p>
          </div>
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
        ) : (
          <>
            {/* 알림 채널 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{"알림 수신 채널"}</CardTitle>
                <p className="text-xs text-muted-foreground">{"알림을 받을 채널을 선택합니다."}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                {channels.map((ch) => {
                  const meta = CHANNEL_META[ch.type];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const isKakao = ch.type === "KAKAO";
                  return (
                    <div key={ch.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`channel-${ch.type}`}
                              className="cursor-pointer text-sm font-medium"
                            >
                              {meta.label}
                            </Label>
                            {isKakao && !ch.verifiedAt && (
                              <Badge variant="outline" className="text-xs">미연동</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>
                      <Switch
                        id={`channel-${ch.type}`}
                        checked={ch.enabled}
                        disabled={isKakao && !ch.verifiedAt}
                        onCheckedChange={() => toggleChannel(ch.type)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 알림 유형 */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{"알림 유형"}</CardTitle>
                <p className="text-xs text-muted-foreground">{"수신할 알림 종류를 선택합니다."}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-0">
                {preferences.map((pref) => {
                  const meta = PREF_META[pref.type];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={pref.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <Label
                            htmlFor={`pref-${pref.type}`}
                            className="cursor-pointer text-sm font-medium"
                          >
                            {meta.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>
                      <Switch
                        id={`pref-${pref.type}`}
                        checked={pref.enabled}
                        onCheckedChange={() => togglePreference(pref.type)}
                      />
                    </div>
                  );
                })}
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
