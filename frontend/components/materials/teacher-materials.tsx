"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Sparkles,
  Clock,
  CheckCircle,
  Eye,
  MoreVertical,
  FileUp,
  Mic,
  AlertTriangle,
  Settings2,
  BarChart2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCourseSchedules,
  getPreviewGuide,
  getReviewSummary,
  getCourseScripts,
  getScriptAnalysis,
  type ScriptAnalysis,
  uploadScript,
  updateScript,
  uploadAudio,
  getAudioConvertTask,
  listAudios,
  generatePreviewGuide,
  generateReviewSummary,
  getPostAnalyses,
  triggerStructureAnalysis,
  triggerConceptsAnalysis,
  type CourseScriptListItem,
  type PreviewGuide,
  type ReviewSummary,
  type PostAnalysisItem,
  type AudioItem,
} from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useCourse } from "@/contexts/course-context";
import { CourseInfoBanner } from "@/components/layout/course-info-banner";
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime-subscription";

type SchedulePreview = {
  scheduleId: string;
  weekNumber: number;
  topic: string;
  preview: PreviewGuide | null;
  review: ReviewSummary | null;
};

export function TeacherMaterials() {
  const { selectedCourse } = useCourse();
  const courseId = selectedCourse?.courseId;

  const [schedules, setSchedules] = useState<SchedulePreview[]>([]);
  const [scripts, setScripts] = useState<Array<{
    id: string;
    scheduleId: string | null;
    weekNumber: number | null;
    title: string;
    format: string;
    uploadDate: string;
    status: string;
    progress: number;
    issues: number;
  }>>([]);
  
  // 모달 상태
  const [uploadModal, setUploadModal] = useState({
    open: false,
    file: null as File | null,
    title: "",
    scheduleId: "none",
  });
  const [editModal, setEditModal] = useState({
    open: false,
    scriptId: "",
    title: "",
    scheduleId: "none",
  });

  const [simulatedProgress, setSimulatedProgress] = useState<
    Record<string, { progress: number; remaining: number }>
  >({});

  const [activeTab, setActiveTab] = useState("preview");
  const [audioList, setAudioList] = useState<AudioItem[]>([]);
  const [transcriptSheet, setTranscriptSheet] = useState<{
    open: boolean;
    audioId: string | null;
    fileName: string;
    transcript: string | null;
    loading: boolean;
  }>({ open: false, audioId: null, fileName: "", transcript: null, loading: false });

  const [isStartingConvert, setIsStartingConvert] = useState(false);
  const [isUploadingScript, setIsUploadingScript] = useState(false);

  // 수업 후 분석 상태 (6.6.x - structure/concepts)
  const [postAnalysisSheet, setPostAnalysisSheet] = useState<{
    open: boolean;
    scriptId: string | null;
    scriptTitle: string;
    analyses: PostAnalysisItem[];
    loading: boolean;
    triggering: string | null;
  }>({ open: false, scriptId: null, scriptTitle: "", analyses: [], loading: false, triggering: null });

  // 사전 분석 리포트 상태 (4.2/4.3 - logic/terminology/prerequisites + suggestions + report)
  const [scriptReportSheet, setScriptReportSheet] = useState<{
    open: boolean;
    scriptId: string | null;
    scriptTitle: string;
    data: ScriptAnalysis | null;
    loading: boolean;
  }>({ open: false, scriptId: null, scriptTitle: "", data: null, loading: false });
  
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // 데이터 로드
  useEffect(() => {
    if (!courseId) return;

    const loadData = async () => {
      try {
        const [schedulesRes, scriptsRes, audiosRes] = await Promise.all([
          getCourseSchedules(courseId),
          getCourseScripts(courseId),
          listAudios(courseId).catch(() => ({ audios: [], totalCount: 0 })),
        ]);

        const scheduleData = await Promise.all(
          schedulesRes.schedules.map(async (s) => {
            const [preview, review] = await Promise.all([
              getPreviewGuide(courseId, s.scheduleId).catch(() => null),
              getReviewSummary(courseId, s.scheduleId).catch(() => null),
            ]);
            return { 
              scheduleId: s.scheduleId, 
              weekNumber: s.weekNumber, 
              topic: s.topic, 
              preview, 
              review 
            };
          }),
        );

        setSchedules(scheduleData);
        setAudioList(audiosRes.audios);

        const list = scriptsRes.scripts;
        if (Array.isArray(list)) {
          setScripts(
            list.map((s: CourseScriptListItem) => ({
              id: s.scriptId,
              scheduleId: s.scheduleId ?? null,
              weekNumber: s.weekNumber ?? null,
              title: s.title || s.fileName || "업로드된 자료",
              format: (s.fileName.split(".").pop() || "문서").toUpperCase(),
              uploadDate: new Date(s.uploadedAt).toLocaleDateString(),
              status: s.status === "completed" ? "completed" : "analyzing",
              progress: 0,
              issues: 0,
            })),
          );
        }
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      }
    };

    void loadData();
  }, [courseId]);

  // Realtime
  useRealtimeSubscription({
    table: "audios",
    filter: courseId ? `course_id=eq.${courseId}` : undefined,
    event: "UPDATE",
    enabled: !!courseId,
    onUpdate: (payload) => {
      const row = payload.new;
      setAudioList((prev) => prev.map(a => a.audioId === row.id ? { ...a, status: row.status as string } : a));
    },
  });

  useRealtimeSubscription({
    table: "scripts",
    filter: courseId ? `course_id=eq.${courseId}` : undefined,
    event: "UPDATE",
    enabled: !!courseId && scripts.some(s => s.status === "analyzing"),
    onUpdate: (payload) => {
      const row = payload.new;
      if (!row.id) return;
      setScripts(prev => prev.map(s => s.id === row.id ? { ...s, status: row.status === "completed" ? "completed" : "analyzing" } : s));
    },
  });

  // 시뮬레이션
  useEffect(() => {
    const hasAnalyzing = scripts.some(s => s.status === "analyzing");
    if (!hasAnalyzing) return;
    const interval = setInterval(() => {
      setSimulatedProgress(prev => {
        const next = { ...prev };
        scripts.filter(s => s.status === "analyzing").forEach(s => {
          const current = next[s.id] || { progress: 0, remaining: 45 };
          next[s.id] = {
            progress: Math.min(99, current.progress + Math.floor(Math.random() * 3) + 1),
            remaining: Math.max(1, current.remaining - 1),
          };
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [scripts]);

  const handleGeneratePreview = async (sid: string | null) => {
    if (!courseId || !sid) return;
    try {
      await generatePreviewGuide(courseId, sid);
      alert("예습 자료 생성 요청이 전송되었습니다.");
      const preview = await getPreviewGuide(courseId, sid).catch(() => null);
      setSchedules(prev => prev.map(s => s.scheduleId === sid ? { ...s, preview } : s));
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    }
  };

  const handleGenerateReview = async (sid: string | null) => {
    if (!courseId || !sid) return;
    try {
      await generateReviewSummary(courseId, sid);
      alert("복습 자료 생성 요청이 전송되었습니다.");
      const review = await getReviewSummary(courseId, sid).catch(() => null);
      setSchedules(prev => prev.map(s => s.scheduleId === sid ? { ...s, review } : s));
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !courseId) return;
    setIsStartingConvert(true);
    try {
      const data = await uploadAudio(courseId, file);
      const newAudio: AudioItem = {
        audioId: data.audioId,
        courseId,
        fileName: data.fileName,
        status: data.status,
        transcriptPreview: null,
        createdAt: new Date().toISOString(),
      };
      setAudioList(prev => [newAudio, ...prev]);
      setActiveTab("scripts");
    } catch (error) {
      alert("음성 변환 실패");
    } finally {
      setIsStartingConvert(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleScriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadModal({
      open: true,
      file,
      title: file.name,
      scheduleId: schedules[0]?.scheduleId || "none",
    });
    if (e.target) e.target.value = "";
  };

  const handleScriptUploadConfirm = async () => {
    const { file, title, scheduleId } = uploadModal;
    if (!file || !courseId) return;
    setIsUploadingScript(true);
    setUploadModal(prev => ({ ...prev, open: false }));
    try {
      const selectedSchedule = schedules.find(s => s.scheduleId === scheduleId);
      // res를 any로 받아서 모든 타입 체크를 우회하거나, 정확한 타입을 지정합니다.
      const res: any = await uploadScript(courseId, { 
        file, 
        title,
        scheduleId: scheduleId === "none" ? undefined : scheduleId,
        weekNumber: selectedSchedule?.weekNumber
      });
      const newScript = {
        id: res.scriptId,
        scheduleId: res.scheduleId ?? null,
        weekNumber: res.weekNumber ?? null,
        title: res.title || title,
        format: (res.fileName?.split(".").pop() || "문서").toUpperCase(),
        uploadDate: new Date(res.uploadedAt || new Date()).toLocaleDateString(),
        status: "analyzing",
        progress: 0,
        issues: 0,
      };
      setScripts(prev => [newScript, ...prev]);
      alert("업로드되었습니다.");
      setActiveTab("scripts");
    } catch (err) {
      alert("업로드 실패");
    } finally {
      setIsUploadingScript(false);
    }
  };

  const handleUpdateScriptConfirm = async () => {
    const { scriptId, title, scheduleId } = editModal;
    if (!courseId || !scriptId) return;
    try {
      const selectedSchedule = schedules.find(s => s.scheduleId === scheduleId);
      await updateScript(courseId, scriptId, {
        title,
        scheduleId: scheduleId === "none" ? null : scheduleId,
        weekNumber: selectedSchedule?.weekNumber
      });
      setScripts(prev => prev.map(s => s.id === scriptId ? {
        ...s,
        title,
        scheduleId: scheduleId === "none" ? null : scheduleId,
        weekNumber: selectedSchedule?.weekNumber ?? null
      } : s));
      setEditModal(prev => ({ ...prev, open: false }));
      alert("수정되었습니다.");
    } catch (err) {
      alert("수정 실패");
    }
  };

  const handleOpenPostAnalysis = async (scriptId: string, scriptTitle: string) => {
    if (!courseId) return;
    setPostAnalysisSheet({ open: true, scriptId, scriptTitle, analyses: [], loading: true, triggering: null });
    try {
      const data = await getPostAnalyses(courseId, scriptId);
      setPostAnalysisSheet(prev => ({ ...prev, analyses: data.postAnalyses, loading: false }));
    } catch {
      setPostAnalysisSheet(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenScriptReport = async (scriptId: string, scriptTitle: string) => {
    if (!courseId) return;
    setScriptReportSheet({ open: true, scriptId, scriptTitle, data: null, loading: true });
    try {
      const data = await getScriptAnalysis(courseId, scriptId);
      setScriptReportSheet(prev => ({ ...prev, data, loading: false }));
    } catch {
      setScriptReportSheet(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenTranscript = async (audio: AudioItem) => {
    setTranscriptSheet({ open: true, audioId: audio.audioId, fileName: audio.fileName, transcript: null, loading: true });
    try {
      const data = await getAudioConvertTask(courseId!, audio.audioId);
      setTranscriptSheet(prev => ({ ...prev, transcript: data.transcript ?? null, loading: false }));
    } catch {
      setTranscriptSheet(prev => ({ ...prev, loading: false }));
    }
  };

  const handleTriggerAnalysis = async (type: "structure" | "concepts") => {
    const { scriptId } = postAnalysisSheet;
    if (!courseId || !scriptId) return;
    setPostAnalysisSheet(prev => ({ ...prev, triggering: type }));
    try {
      if (type === "structure") await triggerStructureAnalysis(courseId, scriptId);
      else await triggerConceptsAnalysis(courseId, scriptId);
      await new Promise(r => setTimeout(r, 1500));
      const data = await getPostAnalyses(courseId, scriptId);
      setPostAnalysisSheet(prev => ({ ...prev, analyses: data.postAnalyses, triggering: null }));
    } catch {
      setPostAnalysisSheet(prev => ({ ...prev, triggering: null }));
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      <CourseInfoBanner />

      <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">AI 강의 자료 분석</h3>
              <p className="text-sm text-muted-foreground truncate">강의 자료를 업로드하면 AI가 구조를 분석합니다.</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input type="file" ref={scriptInputRef} className="hidden" accept=".pdf,.pptx,.docx,.txt" onChange={handleScriptFileChange} />
            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
            <Button size="sm" variant="secondary" className="flex-1 gap-2" onClick={() => scriptInputRef.current?.click()} disabled={isUploadingScript || !courseId}>
              <FileUp className="size-4" />
              {isUploadingScript ? "처리 중..." : "자료 업로드"}
            </Button>
            <Button size="sm" variant="secondary" className="flex-1 gap-2" onClick={() => audioInputRef.current?.click()} disabled={isStartingConvert || !courseId}>
              <Mic className="size-4" />
              {isStartingConvert ? "요청 중..." : "음성 변환"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {audioList.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium">음성 변환 목록</p>
            <div className="flex flex-col gap-2">
              {audioList.map(audio => (
                <div key={audio.audioId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{audio.fileName}</span>
                    {audio.status === "COMPLETED" ? <CheckCircle className="size-4 text-emerald-500" /> : audio.status === "FAILED" ? <AlertTriangle className="size-4 text-destructive" /> : <Loader2 className="size-4 animate-spin text-primary" />}
                  </div>
                  {audio.status === "COMPLETED" && (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleOpenTranscript(audio)}>내용 보기</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preview">예습 자료</TabsTrigger>
          <TabsTrigger value="review">복습 자료</TabsTrigger>
          <TabsTrigger value="scripts">강의 자료</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="flex flex-col gap-3">
            {schedules.filter(s => s.preview).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">생성된 예습 자료가 없습니다.</p>}
            {schedules.filter(s => s.preview).map(s => (
              <Card key={s.scheduleId} className="border-border/40 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      {s.preview!.status === "completed" ? <CheckCircle className="size-5 text-emerald-500" /> : <Clock className="size-5 text-primary" />}
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">{s.weekNumber}주차</Badge>
                      <p className="mt-1 font-medium">{s.preview!.title}</p>
                      <p className="text-xs text-muted-foreground">업데이트: {new Date(s.preview!.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="flex flex-col gap-3">
            {schedules.filter(s => s.review).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">생성된 복습 자료가 없습니다.</p>}
            {schedules.filter(s => s.review).map(s => (
              <Card key={s.scheduleId} className="border-border/40 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      {s.review!.status === "completed" ? <CheckCircle className="size-5 text-emerald-500" /> : <Clock className="size-5 text-primary" />}
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">{s.weekNumber}주차</Badge>
                      <p className="mt-1 font-medium">{s.review!.title}</p>
                      <p className="text-xs text-muted-foreground">업데이트: {new Date(s.review!.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scripts" className="mt-4">
          <div className="flex flex-col gap-3">
            {scripts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">업로드된 자료가 없습니다.</p>}
            {scripts.map(s => (
              <Card key={s.id} className="border-border/40 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3 min-w-0">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{s.format}</Badge>
                          <Badge variant="secondary" className="text-xs">{s.weekNumber ? `${s.weekNumber}주차` : "주차 미지정"}</Badge>
                        </div>
                        <p className="mt-1 font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.uploadDate}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditModal({ open: true, scriptId: s.id, title: s.title, scheduleId: s.scheduleId || "none" })}>
                          <Settings2 className="mr-2 size-4" /> 정보 수정
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {s.status === "completed" && (
                    <div className="mt-2 flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleGeneratePreview(s.scheduleId)} disabled={!s.scheduleId}>예습 생성</Button>
                      <Button size="sm" variant="outline" onClick={() => handleGenerateReview(s.scheduleId)} disabled={!s.scheduleId}>복습 생성</Button>
                      <Button size="sm" variant="outline" onClick={() => handleOpenScriptReport(s.id, s.title)}>
                        <BarChart2 className="mr-1 size-3.5" />분석 리포트
                      </Button>
                      <Button size="sm" onClick={() => handleOpenPostAnalysis(s.id, s.title)}>수업 후 분析</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={uploadModal.open} onOpenChange={o => setUploadModal(prev => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>강의 자료 업로드</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>자료 제목</Label>
              <Input value={uploadModal.title} onChange={e => setUploadModal(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>대상 주차</Label>
              <Select value={uploadModal.scheduleId} onValueChange={v => setUploadModal(prev => ({ ...prev, scheduleId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">주차 미지정</SelectItem>
                  {schedules.map(sc => <SelectItem key={sc.scheduleId} value={sc.scheduleId}>{sc.weekNumber}주차: {sc.topic}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadModal(prev => ({ ...prev, open: false }))}>취소</Button>
            <Button onClick={handleScriptUploadConfirm} disabled={isUploadingScript}>업로드 시작</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModal.open} onOpenChange={o => setEditModal(prev => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>자료 정보 수정</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>자료 제목</Label>
              <Input value={editModal.title} onChange={e => setEditModal(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>주차 변경</Label>
              <Select value={editModal.scheduleId} onValueChange={v => setEditModal(prev => ({ ...prev, scheduleId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">주차 미지정</SelectItem>
                  {schedules.map(sc => <SelectItem key={sc.scheduleId} value={sc.scheduleId}>{sc.weekNumber}주차: {sc.topic}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(prev => ({ ...prev, open: false }))}>취소</Button>
            <Button onClick={handleUpdateScriptConfirm}>수정 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={transcriptSheet.open} onOpenChange={o => setTranscriptSheet(prev => ({ ...prev, open: o }))}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>음성 트랜스크립트</SheetTitle></SheetHeader>
          {transcriptSheet.loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : <p className="whitespace-pre-wrap text-sm py-4">{transcriptSheet.transcript || "내용이 없습니다."}</p>}
        </SheetContent>
      </Sheet>

      <Sheet open={postAnalysisSheet.open} onOpenChange={o => setPostAnalysisSheet(prev => ({ ...prev, open: o }))}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>수업 후 분석</SheetTitle></SheetHeader>
          {postAnalysisSheet.loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div> : (
            <div className="flex flex-col gap-4 py-4">
              <PostAnalysisCard label="수업 흐름 구조 분석" type="structure" item={postAnalysisSheet.analyses.find(a => a.analysisType === "structure") ?? null} triggering={postAnalysisSheet.triggering === "structure"} onTrigger={() => handleTriggerAnalysis("structure")} />
              <PostAnalysisCard label="핵심 개념어 체크" type="concepts" item={postAnalysisSheet.analyses.find(a => a.analysisType === "concepts") ?? null} triggering={postAnalysisSheet.triggering === "concepts"} onTrigger={() => handleTriggerAnalysis("concepts")} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 사전 분析 리포트 Sheet (4.2/4.3) */}
      <Sheet open={scriptReportSheet.open} onOpenChange={o => setScriptReportSheet(prev => ({ ...prev, open: o }))}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <BarChart2 className="size-5 text-primary" />
              스크립트 분析 리포트
            </SheetTitle>
            <p className="text-sm text-muted-foreground truncate">{scriptReportSheet.scriptTitle}</p>
          </SheetHeader>
          {scriptReportSheet.loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin size-8 text-primary" /></div>
          ) : !scriptReportSheet.data ? (
            <div className="py-8 text-center text-muted-foreground text-sm">분析 결과를 불러올 수 없습니다.</div>
          ) : (
            <ScriptReportViewer data={scriptReportSheet.data} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ScriptReportViewer({ data }: { data: ScriptAnalysis }) {
  const [expandedSlide, setExpandedSlide] = useState<number | null>(null);

  const logicItem = data.analyses.find(a => a.analysisType === "logic");
  const termItem = data.analyses.find(a => a.analysisType === "terminology");
  const prereqItem = data.analyses.find(a => a.analysisType === "prerequisites");
  const diffItem = data.suggestions.find(s => s.suggestionType === "difficulty");

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* 종합 점수 */}
      {data.report && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">종합 점수</h3>
            <span className={`text-2xl font-bold ${scoreColor(data.report.overall_score)}`}>
              {data.report.overall_score}점
            </span>
          </div>
          {data.report.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{data.report.summary}</p>
          )}
          <Progress value={data.report.overall_score} className="mt-3 h-2" />
        </Card>
      )}

      {/* 논리 흐름 분析 */}
      {logicItem?.status === "completed" && logicItem.result && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500 inline-block" />
              논리 흐름 분析
            </h4>
            {logicItem.result.overallFlowScore != null && (
              <Badge variant="outline" className={scoreColor(logicItem.result.overallFlowScore)}>
                흐름 점수 {logicItem.result.overallFlowScore}
              </Badge>
            )}
          </div>
          {logicItem.result.gaps && logicItem.result.gaps.length > 0 ? (
            <div className="flex flex-col gap-2">
              {logicItem.result.gaps.map((gap, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={gap.severity === "HIGH" ? "destructive" : gap.severity === "MEDIUM" ? "secondary" : "outline"} className="text-xs">
                      {gap.severity === "HIGH" ? "심각" : gap.severity === "MEDIUM" ? "보통" : "낮음"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{gap.location}</span>
                  </div>
                  <p className="text-muted-foreground">{gap.issue}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">논리 흐름 문제가 감지되지 않았습니다. ✓</p>
          )}
        </Card>
      )}

      {/* 전문용어 미설명 */}
      {termItem?.status === "completed" && termItem.result && (
        <Card className="p-4">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <span className="size-2 rounded-full bg-amber-500 inline-block" />
            전문용어 미설명 탐지
            {termItem.result.undefined_terms && (
              <Badge variant="secondary" className="text-xs ml-auto">{termItem.result.undefined_terms.length}건</Badge>
            )}
          </h4>
          {termItem.result.undefined_terms && termItem.result.undefined_terms.length > 0 ? (
            <div className="flex flex-col gap-2">
              {termItem.result.undefined_terms.map((t, i) => (
                <div key={i} className="rounded-lg bg-amber-500/10 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-amber-700">{t.term}</span>
                    <span className="text-xs text-muted-foreground">{t.location}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">권장 정의: {t.recommended_definition}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">미설명 전문용어가 없습니다. ✓</p>
          )}
        </Card>
      )}

      {/* 전제지식 누락 */}
      {prereqItem?.status === "completed" && prereqItem.result && (
        <Card className="p-4">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <span className="size-2 rounded-full bg-orange-500 inline-block" />
            전제지식 누락 탐지
            {prereqItem.result.missing_prerequisites && (
              <Badge variant="secondary" className="text-xs ml-auto">{prereqItem.result.missing_prerequisites.length}건</Badge>
            )}
          </h4>
          {prereqItem.result.missing_prerequisites && prereqItem.result.missing_prerequisites.length > 0 ? (
            <div className="flex flex-col gap-2">
              {prereqItem.result.missing_prerequisites.map((p, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="font-medium mb-1">{p.concept}</p>
                  <p className="text-xs text-muted-foreground mb-1">필요 이유: {p.why_needed}</p>
                  <p className="text-xs text-blue-600">제안: {p.suggested_coverage}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">전제지식 누락이 없습니다. ✓</p>
          )}
        </Card>
      )}

      {/* 학습자 난이도 분析 & 개선 제안 */}
      {diffItem?.status === "completed" && diffItem.result && (
        <Card className="p-4">
          <h4 className="font-medium flex items-center gap-2 mb-3">
            <span className="size-2 rounded-full bg-purple-500 inline-block" />
            학습자 관점 난이도 분析
          </h4>
          {diffItem.result.difficulty_explanations && diffItem.result.difficulty_explanations.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {diffItem.result.difficulty_explanations.map((d, i) => (
                <div key={i} className="rounded-lg bg-purple-500/10 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{d.topic}</span>
                    <Badge variant="outline" className="text-xs">{d.student_level}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{d.why_difficult}</p>
                </div>
              ))}
            </div>
          )}
          {diffItem.result.improvement_suggestions && diffItem.result.improvement_suggestions.length > 0 && (
            <>
              <h5 className="text-sm font-medium mb-2 text-muted-foreground">개선 제안</h5>
              <div className="flex flex-col gap-2">
                {diffItem.result.improvement_suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">대상: {s.target}</p>
                    <p className="mb-1">{s.suggestion}</p>
                    {s.example && <p className="text-xs text-blue-600 italic">예시: {s.example}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* 슬라이드별 리포트 */}
      {data.report?.slides && data.report.slides.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-indigo-500 inline-block" />
            섹션별 분析 리포트
          </h4>
          <div className="flex flex-col gap-2">
            {data.report.slides.map((slide, i) => (
              <div key={i} className="rounded-lg border border-border/60 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedSlide(expandedSlide === i ? null : i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-sm font-semibold ${scoreColor(slide.score)}`}>{slide.score}점</span>
                    <span className="text-sm truncate">{slide.section}</span>
                  </div>
                  {expandedSlide === i ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                </button>
                {expandedSlide === i && (
                  <div className="px-3 pb-3 border-t border-border/40 pt-2 text-sm space-y-3">
                    {slide.issues.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-500 mb-1">문제점</p>
                        <ul className="space-y-1">
                          {slide.issues.map((issue, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex gap-2">
                              <span className="text-red-400 shrink-0">·</span>{issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {slide.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-600 mb-1">개선안</p>
                        <ul className="space-y-1">
                          {slide.suggestions.map((sug, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex gap-2">
                              <span className="text-blue-400 shrink-0">·</span>{sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PostAnalysisCard({ label, type, item, triggering, onTrigger }: { label: string; type: "structure" | "concepts"; item: PostAnalysisItem | null; triggering: boolean; onTrigger: () => void; }) {
  const isPending = item?.status === "pending" || item?.status === "processing";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">{label}</h4>
        {!item || item.status === "failed" ? (
          <Button size="sm" onClick={onTrigger} disabled={triggering}>{triggering ? "분석 중..." : "분석 시작"}</Button>
        ) : isPending ? <Badge variant="secondary">처리 중</Badge> : <Badge className="bg-emerald-500 text-white">완료</Badge>}
      </div>
      {item?.status === "completed" && item.result && (
        <div className="text-sm space-y-2">
          {item.result.overall_comment && <p className="text-muted-foreground">{item.result.overall_comment}</p>}
          {type === "structure" && item.result.structure_map?.map((p, i) => (
            <div key={i} className="bg-muted/50 p-2 rounded text-xs">
              <Badge variant="outline" className="mb-1">{p.phase}</Badge>
              <p>{p.description}</p>
            </div>
          ))}
          {type === "concepts" && item.result.covered_concepts?.map((c, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <Badge variant="outline">{c.coverage}</Badge>
              <span>{c.concept}: {c.note}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
