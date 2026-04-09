const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `API 요청 실패 (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) {
        message = body.detail;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export type LoginResponse = {
  message: string;
  access_token: string;
  email: string;
};

export type DashboardSummary = {
  averageAccuracy: number;
  weakTopics: string[];
  uploadedWeeks: number;
  totalWeeks: number;
};

export type Notice = {
  id: number;
  title: string;
  type: string;
};

export type NoticeSettings = {
  channels: string[];
  deadline_hours_before: number;
  quiz_notifications: boolean;
};

export type QuizLatest = {
  title: string;
  questions: number;
  anonymous_enabled: boolean;
  accuracy: number;
  hard_questions: string[];
};

export type QuizGeneratePayload = {
  topic: string;
  difficulty: string;
  question_count: number;
};

export type AudioConvertTask = {
  task_id: string;
  file_name: string;
  status: "processing" | "completed";
  progress: number;
  transcript_preview: string | null;
};

export type AnalysisReport = {
  source_file: string;
  logical_gaps: number;
  missing_terms: string[];
  missing_prerequisites: string[];
  suggestions: string[];
};

export async function login(payload: { email: string; password: string }) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDashboardSummary() {
  return request<DashboardSummary>("/api/dashboard/summary");
}

export async function getNotices() {
  return request<Notice[]>("/api/notices");
}

export async function getNoticeSettings() {
  return request<NoticeSettings>("/api/notices/settings");
}

export async function updateNoticeSettings(payload: NoticeSettings) {
  return request<{ message: string; settings: NoticeSettings }>("/api/notices/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLatestQuiz() {
  return request<QuizLatest>("/api/quiz/latest");
}

export async function generateQuiz(payload: QuizGeneratePayload) {
  return request<{ message: string; quiz: QuizLatest; difficulty: string }>("/api/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAudioConvertTask(payload: { file_name: string; estimated_minutes?: number }) {
  return request<AudioConvertTask>("/api/materials/audio-convert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAudioConvertTask(taskId: string) {
  return request<AudioConvertTask>(`/api/materials/audio-convert/${taskId}`);
}

export async function getAnalysisReport() {
  return request<AnalysisReport>("/api/analysis/report");
}
