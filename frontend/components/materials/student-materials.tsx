"use client";

import { useEffect, useState } from "react";
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
  Loader2,
} from "lucide-react";
import {
  getStudentMaterials,
  type StudentMaterialItem,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function StudentMaterials() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("preview");
  const [previewMaterials, setPreviewMaterials] = useState<StudentMaterialItem[]>([]);
  const [reviewMaterials, setReviewMaterials] = useState<StudentMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadMaterials = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getStudentMaterials();
        
        if (!mounted) return;

        const preview = data.materials.filter((m) => m.type === "PREVIEW");
        const review = data.materials.filter((m) => m.type === "REVIEW");
        
        if (mounted) {
          setPreviewMaterials(preview);
          setReviewMaterials(review);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "자료를 불러오지 못했습니다.";
        if (mounted) setError(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadMaterials();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{"로딩 중..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{"학습 자료"}</h1>
        <p className="text-sm text-muted-foreground">{"예습 및 복습 자료를 확인하세요"}</p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 학습 현황 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"예습 자료"}</p>
              <p className="text-lg font-bold text-foreground">{previewMaterials.length}{"개"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <FileText className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"복습 자료"}</p>
              <p className="text-lg font-bold text-foreground">{reviewMaterials.length}{"개"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview" className="gap-2">
            <BookOpen className="size-4" />
            {"예습 자료"} ({previewMaterials.length})
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <FileText className="size-4" />
            {"복습 자료"} ({reviewMaterials.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          {previewMaterials.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {"예습 자료가 없습니다."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {previewMaterials.map((material) => (
                <Card key={material.id} className="border-border/40 border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.courseId}
                          </Badge>
                          <Badge variant="default" className="text-xs bg-primary">
                            {"예습"}
                          </Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">{material.title}</p>
                        <div className="mt-3 flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(material.createdAt).toLocaleDateString("ko-KR")}
                          </span>
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
          )}
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          {reviewMaterials.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {"복습 자료가 없습니다."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {reviewMaterials.map((material) => (
                <Card key={material.id} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {material.courseId}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-emerald-500/20 text-emerald-700"
                          >
                            {"복습"}
                          </Badge>
                        </div>
                        <p className="mt-2 font-medium text-foreground">{material.title}</p>
                        <div className="mt-3 flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(material.createdAt).toLocaleDateString(
                              "ko-KR"
                            )}
                          </span>
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
                        <Star className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
