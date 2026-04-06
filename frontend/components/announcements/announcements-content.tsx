"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Megaphone, Clock, ChevronRight, Sparkles, Send, FileText, Edit, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const announcements = {
  published: [
    {
      id: 1,
      title: "3주차 예습 자료 안내",
      course: "데이터베이스 개론",
      content: "3주차 수업 전 예습 자료가 업로드되었습니다. LMS에서 확인해주세요.",
      date: "2024-03-14",
      type: "material",
    },
    {
      id: 2,
      title: "중간고사 일정 안내",
      course: "운영체제",
      content: "중간고사는 4월 15일 10:00에 진행됩니다. 범위는 1주차~7주차입니다.",
      date: "2024-03-12",
      type: "exam",
    },
    {
      id: 3,
      title: "과제 제출 마감 안내",
      course: "컴퓨터 네트워크",
      content: "1차 과제 제출 마감일이 3월 20일로 연장되었습니다.",
      date: "2024-03-10",
      type: "assignment",
    },
  ],
  draft: [
    {
      id: 4,
      title: "4주차 수업 안내",
      course: "데이터베이스 개론",
      content: "4주차에는 정규화 이론에 대해 학습합니다.",
      date: "2024-03-15",
      type: "material",
      aiGenerated: true,
    },
    {
      id: 5,
      title: "복습 자료 안내",
      course: "운영체제",
      content: "3주차 복습 자료가 준비되었습니다.",
      date: "2024-03-15",
      type: "material",
      aiGenerated: true,
    },
  ],
};

const typeConfig: Record<string, { label: string; color: string }> = {
  material: { label: "자료", color: "bg-blue-500/10 text-blue-600" },
  exam: { label: "시험", color: "bg-red-500/10 text-red-600" },
  assignment: { label: "과제", color: "bg-violet-500/10 text-violet-600" },
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function AnnouncementCard({ 
  announcement, 
  isDraft = false 
}: { 
  announcement: typeof announcements.published[0] & { aiGenerated?: boolean }; 
  isDraft?: boolean;
}) {
  const type = typeConfig[announcement.type] || { label: announcement.type, color: "bg-muted text-muted-foreground" };

  return (
    <Card className="border-border/40 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{announcement.title}</span>
                {announcement.aiGenerated && (
                  <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="mr-1 size-3" />
                    {"AI 생성"}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{announcement.course}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/10">
                  <MoreVertical className="size-4" />
                  <span className="sr-only">{"메뉴 열기"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem className="cursor-pointer">
                  <Edit className="mr-2 size-4 text-muted-foreground" />
                  {"수정"}
                </DropdownMenuItem>
                {isDraft && (
                  <DropdownMenuItem className="cursor-pointer">
                    <Send className="mr-2 size-4 text-muted-foreground" />
                    {"발행"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" className="cursor-pointer">
                  <Trash2 className="mr-2 size-4" />
                  {"삭제"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="line-clamp-2 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
            {announcement.content}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={cn("px-2 py-0.5 text-[10px] font-semibold", type.color)}>
                {type.label}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {announcement.date}
              </span>
            </div>
            {isDraft && (
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Send className="size-3.5" />
                {"발행"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnnouncementsContent() {
  return (
    <div className="flex flex-col gap-5 p-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{"공지사항"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{"수강생에게 공지를 전달하세요"}</p>
        </div>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="size-4" />
          {"작성"}
        </Button>
      </div>

      {/* AI 공지문 생성 카드 */}
      <Card className="group cursor-pointer border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Sparkles className="size-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{"AI 공지문 자동 생성"}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{"템플릿 기반으로 공지문을 자동 작성해요"}</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>

      {/* 탭 콘텐츠 */}
      <Tabs defaultValue="published" className="w-full">
        <TabsList className="h-12 w-full rounded-xl bg-secondary/50 p-1">
          <TabsTrigger 
            value="published" 
            className="flex-1 gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Megaphone className="size-4" />
            {"발행됨"}
            <Badge variant="secondary" className="ml-1 size-5 justify-center p-0 text-[10px]">
              {announcements.published.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="draft" 
            className="flex-1 gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <FileText className="size-4" />
            {"임시저장"}
            <Badge variant="secondary" className="ml-1 size-5 justify-center p-0 text-[10px]">
              {announcements.draft.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="published" className="mt-4 flex flex-col gap-3">
          {announcements.published.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </TabsContent>

        <TabsContent value="draft" className="mt-4 flex flex-col gap-3">
          {announcements.draft.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} isDraft />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
