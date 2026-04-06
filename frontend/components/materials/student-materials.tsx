"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  FileText,
  Download,
  Clock,
  CheckCircle,
  Star,
  Eye,
} from "lucide-react";

const previewMaterials = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "3주차",
    title: "SQL 기초 - SELECT 구문 예습 가이드",
    description: "SQL SELECT 문의 기본 문법과 활용 방법을 미리 학습합니다.",
    isNew: true,
    isRead: false,
    uploadedAt: "오늘",
  },
  {
    id: 2,
    course: "운영체제",
    week: "3주차",
    title: "프로세스 스케줄링 예습 가이드",
    description: "CPU 스케줄링 알고리즘의 종류와 특징을 알아봅니다.",
    isNew: true,
    isRead: false,
    uploadedAt: "어제",
  },
  {
    id: 3,
    course: "컴퓨터 네트워크",
    week: "2주차",
    title: "OSI 7계층 예습 자료",
    description: "네트워크 계층 구조의 기초를 학습합니다.",
    isNew: false,
    isRead: true,
    uploadedAt: "3일 전",
  },
];

const reviewMaterials = [
  {
    id: 1,
    course: "데이터베이스 개론",
    week: "2주차",
    title: "관계형 모델 복습 요약본",
    description: "관계형 데이터베이스의 핵심 개념을 정리했습니다.",
    isBookmarked: true,
    isRead: true,
    uploadedAt: "4일 전",
  },
  {
    id: 2,
    course: "운영체제",
    week: "2주차",
    title: "메모리 관리 복습 요약본",
    description: "가상 메모리와 페이징 기법을 복습합니다.",
    isBookmarked: false,
    isRead: true,
    uploadedAt: "1주 전",
  },
  {
    id: 3,
    course: "소프트웨어 공학",
    week: "1주차",
    title: "애자일 방법론 정리",
    description: "스크럼과 칸반 방식의 차이점을 정리했습니다.",
    isBookmarked: true,
    isRead: true,
    uploadedAt: "2주 전",
  },
];

export function StudentMaterials() {
  const [activeTab, setActiveTab] = useState("preview");

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"학습 자료"}</h1>
        <p className="text-sm text-muted-foreground">{"예습 및 복습 자료를 확인하세요"}</p>
      </div>

      {/* 학습 현황 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"새로운 자료"}</p>
              <p className="text-lg font-bold text-foreground">{"2"}{"개"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Star className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"북마크"}</p>
              <p className="text-lg font-bold text-foreground">{"2"}{"개"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview" className="gap-2">
            <BookOpen className="size-4" />
            {"예습 자료"}
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <FileText className="size-4" />
            {"복습 자료"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="flex flex-col gap-3">
            {previewMaterials.map((material) => (
              <Card key={material.id} className={`border-border/40 ${material.isNew ? "border-l-4 border-l-primary" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {material.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {material.week}
                        </Badge>
                        {material.isNew && (
                          <span className="flex size-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-2 font-medium text-foreground">{material.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{material.description}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {material.uploadedAt}
                        </span>
                        {material.isRead && (
                          <span className="flex items-center gap-1 text-xs text-emerald-500">
                            <CheckCircle className="size-3" />
                            {"읽음"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1 gap-2">
                      <Eye className="size-4" />
                      {"자료 보기"}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Download className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="flex flex-col gap-3">
            {reviewMaterials.map((material) => (
              <Card key={material.id} className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {material.course}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {material.week}
                        </Badge>
                        {material.isBookmarked && (
                          <Star className="size-4 fill-amber-500 text-amber-500" />
                        )}
                      </div>
                      <p className="mt-2 font-medium text-foreground">{material.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{material.description}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {material.uploadedAt}
                        </span>
                        {material.isRead && (
                          <span className="flex items-center gap-1 text-xs text-emerald-500">
                            <CheckCircle className="size-3" />
                            {"읽음"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1 gap-2">
                      <Eye className="size-4" />
                      {"자료 보기"}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Download className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2">
                      <Star className={`size-4 ${material.isBookmarked ? "fill-amber-500 text-amber-500" : ""}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
