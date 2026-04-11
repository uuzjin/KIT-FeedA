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

// Course types
export type Course = {
  courseId: string;
  courseName: string;
  semester: string;
  dayOfWeek: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  description?: string;
  createdAt: string;
  updatedAt?: string;
};

// Announcement types
export type Announcement = {
  announcementId: string;
  courseId: string;
  scheduleId?: string;
  status: string;
  templateType: string;
  title?: string;
  content?: string;
  customMessage?: string;
  createdAt: string;
  completedAt?: string;
};

// Quiz types for dashboard
export type QuizSubmissionHistory = {
  submissionId: string;
  quizId: string;
  courseId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  submittedAt: string;
  wrongAnswers: Array<{
    questionId: string;
    content?: string;
    correctAnswer?: string;
    selectedOption?: string;
  }>;
};

export type ComprehensionTrendItem = {
  weekNumber: number;
  topic: string;
  averageScore: number;
  participationRate: number;
  quizId: string;
  courseId?: string;
};

export type WeakTopicItem = {
  rank?: number;
  topic: string;
  wrongRate: number;
  affectedStudents?: number;
};

export type UploadStatusItem = {
  weekNumber: number;
  topic: string;
  previewGuide: boolean;
  reviewSummary: boolean;
  script: boolean;
};

export type StudentMaterialItem = {
  type: "PREVIEW" | "REVIEW";
  id: string;
  courseId: string;
  title: string;
  createdAt: string;
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

export async function getNotices(courseId?: string) {
  if (!courseId) {
    // 사용자의 모든 강의 조회 후 공지 병합
    try {
      const coursesResponse = await request<{ courses: Course[] }>("/api/courses");
      const allAnnouncements: Announcement[] = [];
      
      for (const course of coursesResponse.courses) {
        try {
          const announcements = await request<{ announcements: Announcement[]; totalCount: number }>(
            `/api/courses/${course.courseId}/announcements`
          );
          allAnnouncements.push(...announcements.announcements);
        } catch {
          // 특정 강의 공지 조회 실패 시 무시
        }
      }
      
      return allAnnouncements;
    } catch {
      // 강의 조회 실패 시 빈 배열 반환
      return [];
    }
  }
  
  const result = await request<{ announcements: Announcement[]; totalCount: number }>(
    `/api/courses/${courseId}/announcements`
  );
  return result.announcements;
}

export async function getCourseAnnouncements(courseId: string) {
  return request<{ announcements: Announcement[]; totalCount: number }>(
    `/api/courses/${courseId}/announcements`
  );
}

export async function getCourses(semester?: string) {
  const params = new URLSearchParams();
  if (semester) {
    params.append("semester", semester);
  }
  return request<{ courses: Course[]; totalCount: number }>(
    `/api/courses${params.toString() ? `?${params}` : ""}`
  );
}

export async function getCourseDetail(courseId: string): Promise<Course & { instructor: { userId: string; name: string; email: string }; currentStudents: number }> {
  return request(
    `/api/courses/${courseId}`
  );
}

export async function createCourse(payload: {
  courseName: string;
  semester: string;
  dayOfWeek: string[];
  startTime: string;
  endTime: string;
  maxStudents?: number;
  description?: string;
}): Promise<Course> {
  return request("/api/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCourse(
  courseId: string,
  payload: {
    courseName?: string;
    dayOfWeek?: string[];
    startTime?: string;
    endTime?: string;
    maxStudents?: number;
    description?: string;
  }
): Promise<Course> {
  return request(`/api/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourse(courseId: string): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}`, {
    method: "DELETE",
  });
}

export async function getCourseSchedules(courseId: string): Promise<{
  schedules: Array<{
    scheduleId: string;
    weekNumber: number;
    topic: string;
    date: string;
    description?: string;
  }>;
}> {
  return request(`/api/courses/${courseId}/schedules`);
}

export async function createCourseSchedule(
  courseId: string,
  payload: {
    weekNumber: number;
    topic: string;
    date: string;
    description?: string;
  }
): Promise<{ scheduleId: string }> {
  return request(`/api/courses/${courseId}/schedules`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCourseSchedule(
  courseId: string,
  scheduleId: string,
  payload: {
    topic?: string;
    date?: string;
    description?: string;
  }
): Promise<{ scheduleId: string }> {
  return request(`/api/courses/${courseId}/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourseSchedule(
  courseId: string,
  scheduleId: string
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/schedules/${scheduleId}`, {
    method: "DELETE",
  });
}

export async function getCourseStudents(courseId: string, page?: number, size?: number): Promise<{
  students: Array<{ userId: string; name: string; email: string; joinedAt: string }>;
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (size) params.append("size", size.toString());
  return request(`/api/courses/${courseId}/students${params.toString() ? `?${params}` : ""}`);
}

export async function addCourseStudents(
  courseId: string,
  payload: { file?: File; studentIds?: string[] }
): Promise<{ addedCount: number; errors: Array<{ row: number; reason: string }> }> {
  const formData = new FormData();
  if (payload.file) {
    formData.append("file", payload.file);
  }
  if (payload.studentIds) {
    formData.append("studentIds", JSON.stringify(payload.studentIds));
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/students`, {
    method: "POST",
    headers: {
      ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `학생 추가 실패 (${response.status})`;
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

  return (await response.json()) as {
    addedCount: number;
    errors: Array<{ row: number; reason: string }>;
  };
}

export async function removeCourseStudent(
  courseId: string,
  studentId: string
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/students/${studentId}`, {
    method: "DELETE",
  });
}

export async function createCourseInvite(
  courseId: string,
  payload?: { expiresAt?: string }
): Promise<{ inviteToken: string; inviteLink: string; expiresAt: string }> {
  return request(`/api/courses/${courseId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function acceptCourseInvite(
  courseId: string,
  token: string
): Promise<{ courseId: string; courseName: string; joinedAt: string }> {
  return request(`/api/courses/${courseId}/invites/${token}/accept`, {
    method: "POST",
  });
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
export async function getStudentQuizHistory(courseId?: string): Promise<{
  history: QuizSubmissionHistory[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    history: QuizSubmissionHistory[];
    totalCount: number;
  }>(`/api/dashboard/students/quiz-history${params.toString() ? `?${params}` : ""}`);
}

export async function getStudentMaterials(courseId?: string): Promise<{
  materials: StudentMaterialItem[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    materials: StudentMaterialItem[];
    totalCount: number;
  }>(`/api/dashboard/students/materials${params.toString() ? `?${params}` : ""}`);
}

// Dashboard APIs for Instructors
export async function getInstructorComprehensionTrends(courseId?: string): Promise<{
  trends: ComprehensionTrendItem[];
  overallTrend: "IMPROVING" | "DECLINING" | "STABLE";
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    trends: ComprehensionTrendItem[];
    overallTrend: "IMPROVING" | "DECLINING" | "STABLE";
  }>(`/api/dashboard/instructors/comprehension-trends${params.toString() ? `?${params}` : ""}`);
}

export async function getInstructorWeakTopics(courseId?: string): Promise<{
  weakTopics: WeakTopicItem[];
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    weakTopics: WeakTopicItem[];
  }>(`/api/dashboard/instructors/weak-topics${params.toString() ? `?${params}` : ""}`);
}

export async function getInstructorUploadStatus(courseId?: string): Promise<{
  uploadStatus: UploadStatusItem[];
  completionRate: number;
}> {
  const params = new URLSearchParams();
  if (courseId) {
    params.append("courseId", courseId);
  }
  return request<{
    uploadStatus: UploadStatusItem[];
    completionRate: number;
  }>(`/api/dashboard/instructors/upload-status${params.toString() ? `?${params}` : ""}`);
}
