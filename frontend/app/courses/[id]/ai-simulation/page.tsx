"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  BarChart3,
  MessageSquare,
  FileText,
} from "lucide-react";
import {
  getCourseScripts,
  createAiSimContext,
  createAiSimSimulation,
  createAiSimAssessment,
  getAiSimAssessment,
  createAiSimAnswers,
  getAiSimAnswers,
  createAiSimGrades,
  getAiSimGrades,
  createAiSimQualityReport,
  getAiSimQualityReport,
  createAiSimQaPairs,
  getAiSimQaPairs,
  type CourseScriptListItem,
  type AiSimAssessment,
  type AiSimGrades,
  type AiSimQualityReport,
  type AiSimQaPairs,
} from "@/lib/api";

type Step = "select" | "running" | "results";

type SimState = {
  contextId: string | null;
  simulationId: string | null;
  assessmentId: string | null;
  assessment: AiSimAssessment | null;
  grades: AiSimGrades | null;
  qualityReport: AiSimQualityReport | null;
  qaPairs: AiSimQaPairs | null;
};

type StepStatus = "idle" | "loading" | "done" | "error";

type PipelineStep = {
  key: string;
  label: string;
  status: StepStatus;
  error?: string;
};

type PollableResult = {
  status: string;
  errorMessage?: string;
};

type TopicGap = {
  topic: string;
  reason?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function pollUntilDone<T extends PollableResult>(
  fetcher: () => Promise<T>,
  interval = 3000,
  maxAttempts = 40,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      try {
        const result = await fetcher();
        if (result.status === "completed") {
          resolve(result);
        } else if (result.status === "failed") {
          reject(new Error(result.errorMessage ?? "처리에 실패했습니다."));
        } else if (++attempts >= maxAttempts) {
          reject(new Error("시간이 초과되었습니다."));
        } else {
          setTimeout(tick, interval);
        }
      } catch (e) {
        reject(e);
      }
    };
    void tick();
  });
}

export default function AiSimulationPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>("select");
  const [scripts, setScripts] = useState<CourseScriptListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingScripts, setLoadingScripts] = useState(true);

  const [simState, setSimState] = useState<SimState>({
    contextId: null,
    simulationId: null,
    assessmentId: null,
    assessment: null,
    grades: null,
    qualityReport: null,
    qaPairs: null,
  });

  const [pipeline, setPipeline] = useState<PipelineStep[]>([
    { key: "context", label: "강의 자료 컨텍스트 생성", status: "idle" },
    { key: "simulation", label: "학생 AI 환경 구성", status: "idle" },
    { key: "assessment", label: "평가 문항 생성", status: "idle" },
    { key: "answers", label: "AI 학생 답변 생성", status: "idle" },
    { key: "grades", label: "채점 및 분석", status: "idle" },
    { key: "quality", label: "자료 품질 진단", status: "idle" },
    { key: "qa", label: "핵심 Q&A 생성", status: "idle" },
  ]);

  const [resultsTab, setResultsTab] = useState<"grades" | "quality" | "qa">("grades");

  useEffect(() => {
    if (!courseId) return;
    setLoadingScripts(true);
    getCourseScripts(courseId)
      .then((res) => setScripts(res.scripts.filter((s) => s.status === "completed")))
      .catch(() => {})
      .finally(() => setLoadingScripts(false));
  }, [courseId]);

  const setStepStatus = (key: string, status: StepStatus, error?: string) => {
    setPipeline((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, error } : s)),
    );
  };

  const handleRun = useCallback(async () => {
    if (selectedIds.size === 0 || !courseId) return;
    setStep("running");

    try {
      // 1. Context
      setStepStatus("context", "loading");
      const ctx = await createAiSimContext(courseId, { scriptIds: Array.from(selectedIds) });
      setSimState((prev) => ({ ...prev, contextId: ctx.contextId }));
      setStepStatus("context", "done");

      // 2. Simulation
      setStepStatus("simulation", "loading");
      const sim = await createAiSimSimulation(courseId, { contextId: ctx.contextId });
      setSimState((prev) => ({ ...prev, simulationId: sim.simulationId }));
      setStepStatus("simulation", "done");

      // 3. Assessment (async) — 202 응답에서 assessmentId 수신
      setStepStatus("assessment", "loading");
      const assessmentRes = await createAiSimAssessment(courseId, { contextId: ctx.contextId, count: 10 });
      const assessmentId: string | null = assessmentRes.assessmentId ?? null;

      if (!assessmentId) throw new Error("평가 ID를 받지 못했습니다.");
      setSimState((prev) => ({ ...prev, assessmentId }));

      const assessment = await pollUntilDone(() => getAiSimAssessment(courseId, assessmentId!));
      setSimState((prev) => ({ ...prev, assessment }));
      setStepStatus("assessment", "done");

      // 4. Answers (async)
      setStepStatus("answers", "loading");
      await createAiSimAnswers(courseId, assessmentId, { simulationId: sim.simulationId });
      await pollUntilDone(() => getAiSimAnswers(courseId, assessmentId!));
      setStepStatus("answers", "done");

      // 5. Grades + Quality + QA (parallel)
      setStepStatus("grades", "loading");
      setStepStatus("quality", "loading");
      setStepStatus("qa", "loading");

      const [gradesRes, qualityRes, qaRes] = await Promise.allSettled([
        (async () => {
          await createAiSimGrades(courseId, assessmentId!);
          const g = await pollUntilDone(() => getAiSimGrades(courseId, assessmentId!));
          setSimState((prev) => ({ ...prev, grades: g }));
          setStepStatus("grades", "done");
          return g;
        })(),
        (async () => {
          await createAiSimQualityReport(courseId, assessmentId!);
          const q = await pollUntilDone(() => getAiSimQualityReport(courseId, assessmentId!));
          setSimState((prev) => ({ ...prev, qualityReport: q }));
          setStepStatus("quality", "done");
          return q;
        })(),
        (async () => {
          await createAiSimQaPairs(courseId, assessmentId!, { simulationId: sim.simulationId });
          const qa = await pollUntilDone(() => getAiSimQaPairs(courseId, assessmentId!));
          setSimState((prev) => ({ ...prev, qaPairs: qa }));
          setStepStatus("qa", "done");
          return qa;
        })(),
      ]);

      if (gradesRes.status === "rejected") setStepStatus("grades", "error", String(gradesRes.reason));
      if (qualityRes.status === "rejected") setStepStatus("quality", "error", String(qualityRes.reason));
      if (qaRes.status === "rejected") setStepStatus("qa", "error", String(qaRes.reason));

      setStep("results");
    } catch (e) {
      const msg = getErrorMessage(e, "알 수 없는 오류");
      // Mark remaining idle/loading steps as error
      setPipeline((prev) =>
        prev.map((s) =>
          s.status === "loading" || s.status === "idle" ? { ...s, status: "error", error: msg } : s,
        ),
      );
    }
  }, [selectedIds, courseId]);

  const toggleScript = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Select Step ────────────────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="flex flex-col gap-5 p-4 pb-24">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{"AI 학생 시뮬레이션"}</h1>
            <p className="text-sm text-muted-foreground">{"강의 자료로 AI 학생을 훈련하고 이해도를 진단합니다"}</p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Bot className="size-8 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{"① 강의 자료를 선택합니다."}</p>
                <p>{"② AI가 자료만 학습한 학생을 시뮬레이션합니다."}</p>
                <p>{"③ 평가 문항에 AI가 답변하고, 채점·품질 진단·Q&A를 생성합니다."}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 font-semibold text-foreground">{"분석할 강의 자료 선택"}</h2>
          {loadingScripts && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {!loadingScripts && scripts.length === 0 && (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <FileText className="size-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{"분석 완료된 강의 자료가 없습니다."}</p>
                <p className="text-xs text-muted-foreground mt-1">{"자료 탭에서 스크립트를 먼저 업로드하세요."}</p>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-col gap-2">
            {scripts.map((script) => (
              <Card
                key={script.scriptId}
                className={`border-border/40 cursor-pointer transition-colors ${
                  selectedIds.has(script.scriptId) ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => toggleScript(script.scriptId)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.has(script.scriptId)}
                      onCheckedChange={() => toggleScript(script.scriptId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{script.title || script.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {script.fileName.split(".").pop()?.toUpperCase()}
                        </Badge>
                        {script.weekNumber && (
                          <span className="text-xs text-muted-foreground">{script.weekNumber}주차</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Button
          className="w-full gap-2"
          size="lg"
          disabled={selectedIds.size === 0}
          onClick={handleRun}
        >
          <Sparkles className="size-4" />
          {`${selectedIds.size}개 자료로 시뮬레이션 시작`}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    );
  }

  // ── Running Step ───────────────────────────────────────────────────────────
  if (step === "running") {
    const done = pipeline.filter((s) => s.status === "done").length;
    const total = pipeline.length;
    return (
      <div className="flex flex-col gap-5 p-4 pb-24">
        <div className="flex items-center gap-3">
          <Bot className="size-6 text-primary" />
          <h1 className="text-xl font-bold">{"시뮬레이션 진행 중"}</h1>
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{"전체 진행률"}</p>
              <p className="text-sm text-primary font-bold">{done}/{total}</p>
            </div>
            <Progress value={(done / total) * 100} className="h-2" />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          {pipeline.map((s) => (
            <div key={s.key} className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
              <div className="shrink-0">
                {s.status === "done" && <CheckCircle className="size-5 text-emerald-500" />}
                {s.status === "loading" && <Loader2 className="size-5 animate-spin text-primary" />}
                {s.status === "error" && <AlertTriangle className="size-5 text-destructive" />}
                {s.status === "idle" && <div className="size-5 rounded-full border-2 border-border" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  s.status === "done" ? "text-foreground" :
                  s.status === "loading" ? "text-primary" :
                  s.status === "error" ? "text-destructive" :
                  "text-muted-foreground"
                }`}>{s.label}</p>
                {s.error && <p className="text-xs text-destructive mt-0.5">{s.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Results Step ───────────────────────────────────────────────────────────
  const { grades, qualityReport, qaPairs, assessment } = simState;

  return (
    <div className="flex flex-col gap-5 p-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{"시뮬레이션 결과"}</h1>
          <p className="text-sm text-muted-foreground">{`${selectedIds.size}개 자료 기반`}</p>
        </div>
      </div>

      {/* 총점 요약 */}
      {grades && (
        <Card className={`border-0 ${
          (grades.totalScore ?? 0) >= 80 ? "bg-emerald-500/10" :
          (grades.totalScore ?? 0) >= 60 ? "bg-amber-500/10" : "bg-destructive/10"
        }`}>
          <CardContent className="p-4 flex items-center gap-4">
            <Bot className="size-10 text-primary shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">{"AI 학생 총점"}</p>
              <p className={`text-4xl font-bold ${
                (grades.totalScore ?? 0) >= 80 ? "text-emerald-600" :
                (grades.totalScore ?? 0) >= 60 ? "text-amber-600" : "text-destructive"
              }`}>
                {grades.totalScore?.toFixed(1) ?? "-"}
                <span className="text-lg font-normal">{"/100"}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 탭 */}
      <div className="flex gap-2">
        {(["grades", "quality", "qa"] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={resultsTab === tab ? "default" : "outline"}
            onClick={() => setResultsTab(tab)}
            className="gap-1.5"
          >
            {tab === "grades" && <><BarChart3 className="size-3.5" />{"채점 결과"}</>}
            {tab === "quality" && <><BookOpen className="size-3.5" />{"자료 품질"}</>}
            {tab === "qa" && <><MessageSquare className="size-3.5" />{"핵심 Q&A"}</>}
          </Button>
        ))}
      </div>

      {/* 채점 결과 */}
      {resultsTab === "grades" && grades && (
        <div className="flex flex-col gap-3">
          {grades.strengths.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-emerald-700">{"강점"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ul className="space-y-1">
                  {grades.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-1.5">
                      <span className="text-emerald-500 shrink-0">{"✓"}</span>{s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {grades.weaknesses.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-amber-700">{"보완이 필요한 부분"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ul className="space-y-1">
                  {grades.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-1.5">
                      <span className="text-amber-500 shrink-0">{"△"}</span>{w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {grades.grades.map((g, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{"Q"}{i + 1}</p>
                  <Badge variant={g.score >= 7 ? "default" : "secondary"} className={g.score >= 7 ? "bg-emerald-500" : ""}>
                    {g.score}{"점"}
                  </Badge>
                </div>
                {assessment?.questions[i] && (
                  <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                    {assessment.questions[i].question}
                  </p>
                )}
                <p className="text-xs text-foreground">{g.feedback}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 자료 품질 */}
      {resultsTab === "quality" && qualityReport && (
        <div className="flex flex-col gap-3">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{"자료 커버리지"}</p>
                <p className="text-lg font-bold text-primary">{qualityReport.coverageRate?.toFixed(1)}%</p>
              </div>
              <Progress value={qualityReport.coverageRate ?? 0} className="h-2" />
            </CardContent>
          </Card>
          {qualityReport.sufficientTopics.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-emerald-700">{"충분히 다룬 주제"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {qualityReport.sufficientTopics.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-emerald-600">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {qualityReport.insufficientTopics.length > 0 && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-destructive">{"보완이 필요한 주제"}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-col gap-2">
                  {qualityReport.insufficientTopics.map((t, i) => {
                    const topic = t as TopicGap;
                    return (
                      <div key={i} className="rounded bg-background p-2">
                        <p className="text-sm font-medium text-foreground">{topic.topic}</p>
                        {topic.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">{topic.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 핵심 Q&A */}
      {resultsTab === "qa" && qaPairs && (
        <div className="flex flex-col gap-3">
          {qaPairs.qaPairs.map((pair, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-2">
                  <span className="text-primary font-bold mr-1">{"Q."}</span>
                  {pair.question}
                </p>
                <p className="text-sm text-muted-foreground border-t border-border/40 pt-2">
                  <span className="text-emerald-600 font-bold mr-1">{"A."}</span>
                  {pair.answer}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setStep("select");
          setSelectedIds(new Set());
          setSimState({ contextId: null, simulationId: null, assessmentId: null, assessment: null, grades: null, qualityReport: null, qaPairs: null });
          setPipeline((prev) => prev.map((s) => ({ ...s, status: "idle", error: undefined })));
        }}
      >
        {"새 시뮬레이션 시작"}
      </Button>
    </div>
  );
}
