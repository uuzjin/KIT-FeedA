import { supabase } from "@/lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token && typeof session.access_token === "string") {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error("Failed to get auth session:", error);
  }

  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  
  // Safely merge headers
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
  };

  if (init?.headers && typeof init.headers === "object") {
    const headerObj = init.headers as Record<string, string>;
    Object.keys(headerObj).forEach((key) => {
      if (typeof headerObj[key] === "string") {
        mergedHeaders[key] = headerObj[key];
      }
    });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: mergedHeaders,
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

export type UserProfile = {
  userId: string;
  name: string;
  email: string;
  role: "INSTRUCTOR" | "STUDENT" | "ADMIN";
  profileImageUrl?: string;
  title?: string;
  createdAt: string;
};

export type UpdateProfilePayload = {
  name?: string;
  title?: string;
  profileImage?: File;
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

// User Profile APIs
export async function getUserProfile(userId: string): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${userId}/profile`);
}

export async function updateUserProfile(
  userId: string,
  payload: UpdateProfilePayload
): Promise<UserProfile> {
  const formData = new FormData();
  
  if (payload.name) {
    formData.append("name", payload.name);
  }
  if (payload.title) {
    formData.append("title", payload.title);
  }
  if (payload.profileImage) {
    formData.append("profileImage", payload.profileImage);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/profile`,
    {
      method: "PUT",
      headers: {
        ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    let message = `프로필 수정 실패 (${response.status})`;
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

  return (await response.json()) as UserProfile;
}

export async function deleteUserAccount(userId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/users/${userId}`, {
    method: "DELETE",
  });
}

// Dashboard APIs for Students
export type QuizHistory = {
  quizId: string;
  topic: string;
  course: string;
  score: number;
  totalQuestions: number;
  date: string;
};

export type StudentMaterial = {
  materialId: string;
  title: string;
  course: string;
  type: "예습" | "복습";
  uploadedAt: string;
  isNew: boolean;
};

export async function getStudentQuizHistory(courseId?: string): Promise<{
  quizzes: QuizHistory[];
  totalParticipated: number;
  averageScore: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    quizzes: QuizHistory[];
    totalParticipated: number;
    averageScore: number;
  }>(`/api/dashboard/students/quiz-history${params.toString() ? `?${params}` : ""}`);
}

export async function getStudentMaterials(courseId?: string): Promise<{
  materials: StudentMaterial[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    materials: StudentMaterial[];
    totalCount: number;
  }>(`/api/dashboard/students/materials${params.toString() ? `?${params}` : ""}`);
}

// Dashboard APIs for Instructors
export type ComprehensionTrend = {
  weekNumber: number;
  topic: string;
  averageScore: number;
  participationRate: number;
  quizId: string;
};

export type WeakTopic = {
  topic: string;
  averageScore: number;
  affectedStudents: number;
};

export type UploadStatusItem = {
  week: string;
  title: string;
  status: "completed" | "pending" | "upcoming";
};

export async function getInstructorComprehensionTrends(courseId?: string): Promise<{
  trends: ComprehensionTrend[];
  overallTrend: "IMPROVING" | "DECLINING" | "STABLE";
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    trends: ComprehensionTrend[];
    overallTrend: "IMPROVING" | "DECLINING" | "STABLE";
  }>(`/api/dashboard/instructors/comprehension-trends${params.toString() ? `?${params}` : ""}`);
}

export async function getInstructorWeakTopics(courseId?: string): Promise<{
  weakTopics: WeakTopic[];
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    weakTopics: WeakTopic[];
  }>(`/api/dashboard/instructors/weak-topics${params.toString() ? `?${params}` : ""}`);
}

export async function getInstructorUploadStatus(courseId?: string): Promise<{
  uploadedWeeks: UploadStatusItem[];
  completionRate: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    uploadedWeeks: UploadStatusItem[];
    completionRate: number;
  }>(`/api/dashboard/instructors/upload-status${params.toString() ? `?${params}` : ""}`);
}
