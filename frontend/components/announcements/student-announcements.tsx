"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle,
  Bell,
  BookOpen,
  FileText,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { getNotices } from "@/lib/api";

const allAnnouncements = [
  {
    id: 1,
    course: "데이터베이스 개론",
    title: "3주차 예습 안내",
    content: "다음 주 수업에서는 SQL SELECT 구문을 학습합니다. 첨부된 예습 자료를 미리 확인해 주세요.",
    publishedAt: "오늘",
    type: "예습",
    isNew: true,
    isRead: false,
  },
  {
    id: 2,
    course: "운영체제",
    title: "중간고사 범위 공지",
    content: "중간고사 범위는 1주차부터 7주차까지입니다. 시험 일시: 4월 20일 10:00",
    publishedAt: "2일 전",
    type: "시험",
    isNew: true,
    isRead: false,
  },
  {
    id: 3,
    course: "컴퓨터 네트워크",
    title: "실습 과제 안내",
    content: "2주차 실습 과제를 첨부합니다. 제출 기한: 4월 15일 23:59",
    publishedAt: "3일 전",
    type: "과제",
    isNew: false,
    isRead: true,
  },
  {
    id: 4,
    course: "소프트웨어 공학",
    title: "팀 프로젝트 발표 일정",
    content: "팀 프로젝트 중간 발표 일정을 안내합니다. 발표 순서는 추첨으로 결정됩니다.",
    publishedAt: "1주 전",
    type: "일반",
    isNew: false,
    isRead: true,
  },
];

export function StudentAnnouncements() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [apiAnnouncements, setApiAnnouncements] = useState(allAnnouncements);

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const notices = await getNotices();
        setApiAnnouncements(
          notices.map((notice) => ({
            id: notice.id,
            course: "공통",
            title: notice.title,
            content: "백엔드에서 전달된 공지입니다.",
            publishedAt: "방금",
            type: notice.type,
            isNew: true,
            isRead: false,
          }))
        );
      } catch {
        // fallback to local demo data
      }
    };
    void loadNotices();
  }, []);

  const courses = [...new Set(apiAnnouncements.map((a) => a.course))];
  const filteredAnnouncements = selectedCourse
    ? apiAnnouncements.filter((a) => a.course === selectedCourse)
    : apiAnnouncements;

  const unreadCount = apiAnnouncements.filter((a) => !a.isRead).length;

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"공지사항"}</h1>
        <p className="text-sm text-muted-foreground">{"수업 관련 공지사항을 확인하세요"}</p>
      </div>

      {/* 읽지 않은 공지 */}
      {unreadCount > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20">
                <Bell className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{"새로운 공지사항"}</p>
                <p className="text-sm text-muted-foreground">
                  {"읽지 않은 공지가 "}{unreadCount}{"개 있습니다"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* 과목 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={selectedCourse === null ? "default" : "outline"}
          className="shrink-0"
          onClick={() => setSelectedCourse(null)}
        >
          {"전체"}
        </Button>
        {courses.map((course) => (
          <Button
            key={course}
            size="sm"
            variant={selectedCourse === course ? "default" : "outline"}
            className="shrink-0"
            onClick={() => setSelectedCourse(course)}
          >
            {course}
          </Button>
        ))}
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="text-xs">{"전체"}</TabsTrigger>
          <TabsTrigger value="예습" className="text-xs">{"예습"}</TabsTrigger>
          <TabsTrigger value="시험" className="text-xs">{"시험"}</TabsTrigger>
          <TabsTrigger value="과제" className="text-xs">{"과제"}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AnnouncementList announcements={filteredAnnouncements} />
        </TabsContent>

        <TabsContent value="예습" className="mt-4">
          <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "예습")} />
        </TabsContent>

        <TabsContent value="시험" className="mt-4">
          <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "시험")} />
        </TabsContent>

        <TabsContent value="과제" className="mt-4">
          <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "과제")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: typeof allAnnouncements }) {
  if (announcements.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-8 text-center">
          <FileText className="mx-auto size-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {"해당하는 공지사항이 없습니다."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {announcements.map((announcement) => (
        <Card 
          key={announcement.id} 
          className={`border-border/40 transition-all hover:shadow-sm ${
            !announcement.isRead ? "border-l-4 border-l-primary bg-primary/5" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {announcement.course}
                  </Badge>
                  <Badge variant={
                    announcement.type === "예습" ? "default" :
                    announcement.type === "시험" ? "destructive" :
                    announcement.type === "과제" ? "secondary" : "outline"
                  } className="text-xs">
                    {announcement.type === "예습" && <BookOpen className="mr-1 size-3" />}
                    {announcement.type === "시험" && <AlertTriangle className="mr-1 size-3" />}
                    {announcement.type === "과제" && <FileText className="mr-1 size-3" />}
                    {announcement.type}
                  </Badge>
                  {!announcement.isRead && (
                    <span className="flex size-2 rounded-full bg-primary" />
                  )}
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
                  {announcement.isRead && (
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle className="size-3" />
                      {"읽음"}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
