"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Sparkles, Download, Eye, MoreVertical, FileUp, BookOpen, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const materials = {
  preview: [
    { id: 1, title: "3주차 예습 가이드", course: "데이터베이스 개론", status: "generated", date: "2024-03-14" },
    { id: 2, title: "4주차 예습 가이드", course: "운영체제", status: "pending", date: "2024-03-15" },
  ],
  review: [
    { id: 3, title: "2주차 복습 요약본", course: "데이터베이스 개론", status: "generated", date: "2024-03-12" },
    { id: 4, title: "2주차 복습 요약본", course: "운영체제", status: "generated", date: "2024-03-13" },
    { id: 5, title: "3주차 복습 요약본", course: "컴퓨터 네트워크", status: "pending", date: "2024-03-14" },
  ],
  scripts: [
    { id: 6, title: "3주차 강의 스크립트", course: "데이터베이스 개론", status: "analyzed", date: "2024-03-10" },
    { id: 7, title: "3주차 강의 스크립트", course: "운영체제", status: "uploaded", date: "2024-03-11" },
  ],
};

const statusConfig: Record<string, { label: string; color: string }> = {
  generated: { label: "생성됨", color: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "대기중", color: "bg-amber-500/10 text-amber-600" },
  analyzed: { label: "분석완료", color: "bg-blue-500/10 text-blue-600" },
  uploaded: { label: "업로드됨", color: "bg-violet-500/10 text-violet-600" },
};

function MaterialCard({ material }: { material: { id: number; title: string; course: string; status: string; date: string } }) {
  const status = statusConfig[material.status] || { label: material.status, color: "bg-muted text-muted-foreground" };

  return (
    <Card className="border-border/40 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-foreground">{material.title}</span>
            <span className="text-sm text-muted-foreground">{material.course}</span>
            <div className="flex items-center gap-2">
              <Badge className={cn("px-2 py-0.5 text-[10px] font-semibold", status.color)}>
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{material.date}</span>
            </div>
          </div>
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
              <Eye className="mr-2 size-4 text-muted-foreground" />
              {"미리보기"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Download className="mr-2 size-4 text-muted-foreground" />
              {"다운로드"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <RefreshCw className="mr-2 size-4 text-muted-foreground" />
              {"재생성"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export function MaterialsContent() {
  return (
    <div className="flex flex-col gap-5 p-4">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{"강의 자료"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{"AI가 생성한 예습/복습 자료를 관리하세요"}</p>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="group h-auto flex-col gap-3 border-dashed border-border/60 bg-secondary/30 py-5 transition-all hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 transition-all group-hover:bg-primary/20">
            <FileUp className="size-6 text-primary" />
          </div>
          <span className="text-sm font-medium">{"스크립트 업로드"}</span>
        </Button>
        <Button 
          variant="outline" 
          className="group h-auto flex-col gap-3 border-dashed border-border/60 bg-secondary/30 py-5 transition-all hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 transition-all group-hover:bg-primary/20">
            <Sparkles className="size-6 text-primary" />
          </div>
          <span className="text-sm font-medium">{"AI 자료 생성"}</span>
        </Button>
      </div>

      {/* 탭 콘텐츠 */}
      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="h-12 w-full rounded-xl bg-secondary/50 p-1">
          <TabsTrigger 
            value="preview" 
            className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <BookOpen className="mr-1.5 size-4" />
            {"예습 자료"}
          </TabsTrigger>
          <TabsTrigger 
            value="review" 
            className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <RefreshCw className="mr-1.5 size-4" />
            {"복습 자료"}
          </TabsTrigger>
          <TabsTrigger 
            value="scripts" 
            className="flex-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Upload className="mr-1.5 size-4" />
            {"스크립트"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4 flex flex-col gap-3">
          {materials.preview.map((material) => (
            <MaterialCard key={material.id} material={material} />
          ))}
        </TabsContent>

        <TabsContent value="review" className="mt-4 flex flex-col gap-3">
          {materials.review.map((material) => (
            <MaterialCard key={material.id} material={material} />
          ))}
        </TabsContent>

        <TabsContent value="scripts" className="mt-4 flex flex-col gap-3">
          {materials.scripts.map((material) => (
            <MaterialCard key={material.id} material={material} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
