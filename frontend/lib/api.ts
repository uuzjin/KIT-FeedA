import type {
  AnalysisReport,
  AudioConvertTask,
  CourseItem,
  DashboardSummary,
  QuizInfo
} from "@/types/dashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function requestPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getCourses(): Promise<CourseItem[]> {
  return request<CourseItem[]>("/api/courses");
}

export function createCourse(payload: {
  name: string;
  semester: string;
  studentCount: number;
}): Promise<{ course: CourseItem }> {
  return requestPost<{ course: CourseItem }>("/api/courses", payload);
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/dashboard/summary");
}

export function getAnalysisReport(): Promise<AnalysisReport> {
  return request<AnalysisReport>("/api/analysis/report");
}

export function getLatestQuiz(): Promise<QuizInfo> {
  return request<QuizInfo>("/api/quiz/latest");
}

export function generateQuiz(topic: string, difficulty: string): Promise<{ quiz: QuizInfo }> {
  return requestPost<{ quiz: QuizInfo }>("/api/quiz/generate", {
    topic,
    difficulty,
    question_count: 5
  });
}

export function createAudioConvertTask(fileName: string): Promise<AudioConvertTask> {
  return requestPost<AudioConvertTask>("/api/materials/audio-convert", {
    file_name: fileName,
    estimated_minutes: 1
  });
}

export function getAudioConvertTask(taskId: string): Promise<AudioConvertTask> {
  return request<AudioConvertTask>(`/api/materials/audio-convert/${taskId}`);
}
