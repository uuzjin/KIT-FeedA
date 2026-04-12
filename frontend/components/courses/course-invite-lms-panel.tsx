"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createCourseInvite,
  getLmsSyncHistory,
  syncLmsStudents,
  type LmsSyncRecord,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Link2, Loader2, RefreshCw, Server } from "lucide-react";

const LMS_TYPES = ["MOODLE", "CANVAS", "BLACKBOARD"] as const;

function defaultInviteExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export function CourseInviteLmsPanel({
  courseId,
  isInstructor,
}: {
  courseId: string;
  isInstructor: boolean;
}) {
  const [syncs, setSyncs] = useState<LmsSyncRecord[]>([]);
  const [syncsLoading, setSyncsLoading] = useState(true);
  const [syncsError, setSyncsError] = useState<string | null>(null);

  const [lmsType, setLmsType] = useState<string>("MOODLE");
  const [lmsCourseId, setLmsCourseId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSyncs = useCallback(async () => {
    setSyncsLoading(true);
    setSyncsError(null);
    try {
      const res = await getLmsSyncHistory(courseId);
      setSyncs(res.syncs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LMS 이력을 불러오지 못했습니다.";
      setSyncsError(msg);
      setSyncs([]);
    } finally {
      setSyncsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadSyncs();
  }, [loadSyncs]);

  const handleSync = async () => {
    if (!lmsCourseId.trim()) {
      setSyncMessage("LMS 과목 ID를 입력하세요.");
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncLmsStudents(courseId, {
        lmsType,
        lmsCourseId: lmsCourseId.trim(),
        syncStudents: true,
      });
      setSyncMessage(
        `동기화 완료 · 신규 연동 ${res.syncedStudents}명 · ${new Date(res.lastSyncAt).toLocaleString("ko-KR")}`
      );
      await loadSyncs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "동기화에 실패했습니다.";
      setSyncMessage(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteError(null);
    setCopied(false);
    try {
      const expiresAt = defaultInviteExpiresAt();
      const res = await createCourseInvite(courseId, { expiresAt });
      const base =
        typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${base}/join?token=${encodeURIComponent(res.token)}`);
      setInviteExpires(res.expiresAt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "초대 링크를 만들지 못했습니다.";
      setInviteError(msg);
      setInviteUrl(null);
      setInviteExpires(null);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("클립보드 복사에 실패했습니다.");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {isInstructor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="size-5 text-primary" />
              학생 초대
            </CardTitle>
            <CardDescription>
              초대 링크를 발급해 학생이 로그인한 뒤 수강 등록할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteError && (
              <Alert variant="destructive">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              onClick={handleCreateInvite}
              disabled={inviteLoading}
              className="w-full gap-2 sm:w-auto"
            >
              {inviteLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              초대 링크 발급 (7일 유효)
            </Button>
            {inviteUrl && (
              <div className="space-y-2">
                <Label>초대 URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                  <Button type="button" variant="secondary" onClick={copyInvite}>
                    <Copy className="size-4" />
                    {copied ? "복사됨" : "복사"}
                  </Button>
                </div>
                {inviteExpires && (
                  <p className="text-xs text-muted-foreground">
                    만료: {new Date(inviteExpires).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={isInstructor ? "" : "lg:col-span-2"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="size-5 text-primary" />
            LMS 연동
          </CardTitle>
          <CardDescription>
            LMS에서 수강생을 가져와 FeedA 수강 명단과 맞춥니다. 동기화 이력은 아래에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstructor && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>LMS 종류</Label>
                  <Select value={lmsType} onValueChange={setLmsType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LMS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="lmsCourseId">LMS 과목 ID</Label>
                  <Input
                    id="lmsCourseId"
                    value={lmsCourseId}
                    onChange={(e) => setLmsCourseId(e.target.value)}
                    placeholder="예: moodle course id"
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                수강생 동기화 실행
              </Button>
              {syncMessage && (
                <Alert variant={syncMessage.includes("실패") || syncMessage.includes("오류") ? "destructive" : "default"}>
                  <AlertDescription className="text-sm">{syncMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium">동기화 이력</h4>
            {syncsLoading ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : syncsError ? (
              <Alert variant="destructive">
                <AlertTitle>이력 조회 실패</AlertTitle>
                <AlertDescription>{syncsError}</AlertDescription>
              </Alert>
            ) : syncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 LMS 동기화 이력이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {syncs.map((s) => (
                  <li
                    key={s.syncId}
                    className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{s.lmsType}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        과목 {s.lmsCourseId}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      동기화 {s.syncedStudents}명 ·{" "}
                      {new Date(s.syncedAt).toLocaleString("ko-KR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
