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
  AlertCircle,
} from "lucide-react";
import { getNotices, Announcement } from "@/lib/api";

type DisplayAnnouncement = {
  id: string;
  course: string;
  title: string;
  content: string;
  publishedAt: string;
  type: string;
  isNew: boolean;
  isRead: boolean;
};

function mapAnnouncementToDisplay(announcement: Announcement, course: string): DisplayAnnouncement {
  const createdDate = new Date(announcement.createdAt);
  const now = new Date();
  const diffTime = now.getTime() - createdDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let publishedAt = "방금";
  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    if (diffHours > 0) publishedAt = `${diffHours}시간 전`;
  } else if (diffDays === 1) {
    publishedAt = "어제";
  } else if (diffDays < 7) {
    publishedAt = `${diffDays}일 전`;
  } else {
    publishedAt = createdDate.toLocaleDateString("ko-KR");
  }

  return {
    id: announcement.announcementId,
    course,
    title: announcement.title || "제목 없음",
    content: announcement.content || "내용 없음",
    publishedAt,
    type: announcement.templateType || "일반",
    isNew: diffDays === 0,
    isRead: false,
  };
}

export function StudentAnnouncements() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<DisplayAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNotices = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const notices = await getNotices();
        
        // Announcement 타입을 DisplayAnnouncement로 변환
        const displayAnnouncements: DisplayAnnouncement[] = notices.map((notice) =>
          mapAnnouncementToDisplay(notice, notice.courseId || "공통")
        );

        setAnnouncements(displayAnnouncements);
      } catch (err) {
        const message = err instanceof Error ? err.message : "공지사항을 불러오지 못했습니다.";
        setError(message);
        setAnnouncements([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadNotices();
  }, []);

  const courses = [...new Set(announcements.map((a) => a.course))].sort();
  const filteredAnnouncements = selectedCourse
    ? announcements.filter((a) => a.course === selectedCourse)
    : announcements;

  const unreadCount = announcements.filter((a) => a.isNew).length;

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"공지사항"}</h1>
        <p className="text-sm text-muted-foreground">{"수업 관련 공지사항을 확인하세요"}</p>
      </div>

      {/* 에러 표시 */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{"오류"}</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 로딩 중 */}
      {isLoading && (
        <Card className="border-border/40">
          <CardContent className="p-8 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full border-4 border-border border-t-primary size-8"></div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{"공지사항을 불러오는 중..."}</p>
          </CardContent>
        </Card>
      )}

      {/* 읽지 않은 공지 */}
      {!isLoading && !error && unreadCount > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20">
                <Bell className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{"새로운 공지사항"}</p>
                <p className="text-sm text-muted-foreground">
                  {"새로운 공지가 "}{unreadCount}{"개 있습니다"}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* 과목 필터 */}
      {!isLoading && courses.length > 0 && (
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
      )}

      {/* 콘텐츠 */}
      {!isLoading && !error && (
        <>
          {/* 탭 네비게이션 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">{"전체"}</TabsTrigger>
              <TabsTrigger value="PREVIEW" className="text-xs">{"예습"}</TabsTrigger>
              <TabsTrigger value="REVIEW" className="text-xs">{"시험"}</TabsTrigger>
              <TabsTrigger value="GENERAL" className="text-xs">{"과제"}</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <AnnouncementList announcements={filteredAnnouncements} />
            </TabsContent>

            <TabsContent value="PREVIEW" className="mt-4">
              <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "PREVIEW")} />
            </TabsContent>

            <TabsContent value="REVIEW" className="mt-4">
              <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "REVIEW")} />
            </TabsContent>

            <TabsContent value="GENERAL" className="mt-4">
              <AnnouncementList announcements={filteredAnnouncements.filter((a) => a.type === "GENERAL")} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: DisplayAnnouncement[] }) {
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

  function getTypeLabel(type: string): string {
    switch (type) {
      case "PREVIEW": return "예습";
      case "REVIEW": return "복습";
      case "GENERAL": return "일반";
      default: return type;
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "PREVIEW": return <BookOpen className="mr-1 size-3" />;
      case "REVIEW": return <AlertTriangle className="mr-1 size-3" />;
      default: return <FileText className="mr-1 size-3" />;
    }
  }

  function getTypeVariant(type: string): "default" | "destructive" | "secondary" | "outline" {
    switch (type) {
      case "PREVIEW": return "default";
      case "REVIEW": return "destructive";
      case "GENERAL": return "secondary";
      default: return "outline";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {announcements.map((announcement) => (
        <Card 
          key={announcement.id} 
          className={`border-border/40 transition-all hover:shadow-sm ${
            announcement.isNew ? "border-l-4 border-l-primary bg-primary/5" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {announcement.course}
                  </Badge>
                  <Badge variant={getTypeVariant(announcement.type)} className="text-xs">
                    {getTypeIcon(announcement.type)}
                    {getTypeLabel(announcement.type)}
                  </Badge>
                  {announcement.isNew && (
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
