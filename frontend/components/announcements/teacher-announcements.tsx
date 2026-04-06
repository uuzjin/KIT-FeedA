"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Sparkles,
  Clock,
  Eye,
  Edit,
  MoreVertical,
  Send,
  FileText,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotices, getNoticeSettings, updateNoticeSettings, type Notice, type NoticeSettings } from "@/lib/api";

const publishedAnnouncements = [
  {
    id: 1,
    course: "데이터베이스 개론",
    title: "3주차 예습 안내",
    content: "다음 주 수업에서는 SQL SELECT 구문을 학습합니다. 첨부된 예습 자료를 미리 확인해 주세요.",
    views: 42,
    publishedAt: "오늘",
    type: "예습",
  },
  {
    id: 2,
    course: "운영체제",
    title: "중간고사 범위 공지",
    content: "중간고사 범위는 1주차부터 7주차까지입니다. 시험 일시: 4월 20일 10:00",
    views: 38,
    publishedAt: "2일 전",
    type: "시험",
  },
  {
    id: 3,
    course: "컴퓨터 네트워크",
    title: "실습 과제 안내",
    content: "2주차 실습 과제를 첨부합니다. 제출 기한: 4월 15일 23:59",
    views: 35,
    publishedAt: "3일 전",
    type: "과제",
  },
];

const draftAnnouncements = [
  {
    id: 1,
    course: "소프트웨어 공학",
    title: "팀 프로젝트 안내",
    content: "팀 프로젝트 구성 및 주제 선정에 대한 안내입니다...",
    lastModified: "오늘",
    type: "일반",
  },
];

export function TeacherAnnouncements() {
  const [activeTab, setActiveTab] = useState("published");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [settings, setSettings] = useState<NoticeSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [noticesData, settingsData] = await Promise.all([getNotices(), getNoticeSettings()]);
        setNotices(noticesData);
        setSettings(settingsData);
      } catch {
        // fallback to local demo data
      }
    };
    void load();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const result = await updateNoticeSettings(settings);
      setSettings(result.settings);
    } catch {
      // keep silent in demo mode
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{"공지사항"}</h1>
          <p className="text-sm text-muted-foreground">{"공지사항 작성 및 관리"}</p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          {"새 공지"}
        </Button>
      </div>

      {/* AI 공지문 생성 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{"AI 공지문 생성"}</h3>
              <p className="text-sm text-muted-foreground">
                {"템플릿을 선택하면 AI가 공지문 초안을 자동으로 작성합니다."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1">
              {"예습 안내"}
            </Button>
            <Button size="sm" variant="secondary" className="flex-1">
              {"복습 안내"}
            </Button>
            <Button size="sm" variant="secondary" className="flex-1">
              {"시험 공지"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {settings && (
        <Card className="border-border/40">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-muted-foreground">
              {"알림 채널: "}{settings.channels.join(", ")}{" · 마감 "}{settings.deadline_hours_before}{"시간 전"}
            </p>
            <Button size="sm" variant="outline" onClick={handleSaveSettings}>
              {"설정 저장"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="published" className="gap-2">
            <Send className="size-4" />
            {"발행됨"}
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2">
            <FileText className="size-4" />
            {"임시저장"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="published" className="mt-4">
          <div className="flex flex-col gap-3">
            {(notices.length > 0
              ? notices.map((notice) => ({
                  id: notice.id,
                  course: "공통",
                  title: notice.title,
                  content: "백엔드 공지 데이터입니다.",
                  views: 0,
                  publishedAt: "방금",
                  type: notice.type,
                }))
              : publishedAnnouncements
            ).map((announcement) => (
              <Card key={announcement.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {announcement.course}
                        </Badge>
                        <Badge variant={
                          announcement.type === "예습" ? "default" :
                          announcement.type === "시험" ? "destructive" : "secondary"
                        } className="text-xs">
                          {announcement.type}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-foreground">{announcement.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {announcement.content}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {announcement.publishedAt}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="size-3" />
                          {"조회 "}{announcement.views}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 size-4" />
                          {"미리보기"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 size-4" />
                          {"수정"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="mr-2 size-4" />
                          {"읽은 학생 확인"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="draft" className="mt-4">
          <div className="flex flex-col gap-3">
            {draftAnnouncements.length === 0 ? (
              <Card className="border-border/40">
                <CardContent className="p-8 text-center">
                  <FileText className="mx-auto size-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {"임시저장된 공지사항이 없습니다."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              draftAnnouncements.map((announcement) => (
                <Card key={announcement.id} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                          <Edit className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {announcement.course}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {announcement.type}
                            </Badge>
                          </div>
                          <p className="mt-1 font-medium text-foreground">{announcement.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {"수정 "}{announcement.lastModified}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          {"수정"}
                        </Button>
                        <Button size="sm" className="gap-1">
                          <Send className="size-3" />
                          {"발행"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
