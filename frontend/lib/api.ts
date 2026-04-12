import { supabase } from "@/lib/supabase/client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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

  // 1. 헤더 병합 (authHeaders 위에 사용자 지정 init.headers를 덮어씀)
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(init?.headers as Record<string, string>),
  };

  if (init?.headers && typeof init.headers === "object") {
    const headerObj = init.headers as Record<string, string>;
    Object.keys(headerObj).forEach((key) => {
      if (typeof headerObj[key] === "string") {
        mergedHeaders[key] = headerObj[key];
      }
    });
  }

  // [디버깅] 프론트엔드 내부적으로는 토큰이 제대로 담겼는지 개발자 도구 콘솔에 출력
  if (!mergedHeaders.Authorization) {
    console.error("❌ [API Error] 인증 토큰이 없습니다. 다시 로그인 해주세요.");
    throw new Error("인증 토큰이 없습니다. 다시 로그인 해주세요.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: mergedHeaders,
    credentials: "include", // 쿠키 기반 인증 및 세션 유지를 위해 추가
  });

  if (!response.ok) {
    let backendMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      backendMessage = errorData.detail || errorData.message || backendMessage;
    } catch {
      // ignore parse error
    }

    if (response.status === 401) {
      console.error(
        `❌ [API Error] 401 Unauthorized - 백엔드 응답: ${backendMessage}`,
      );
    }
    throw new Error(backendMessage);
  }

  return response.json() as Promise<T>;
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
      const coursesResponse = await request<{ courses: Course[] }>(
        "/api/courses",
      );
      const allAnnouncements: Announcement[] = [];

      for (const course of coursesResponse.courses) {
        try {
          const announcements = await request<{
            announcements: Announcement[];
            totalCount: number;
          }>(`/api/courses/${course.courseId}/announcements`);
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

  const result = await request<{
    announcements: Announcement[];
    totalCount: number;
  }>(`/api/courses/${courseId}/announcements`);
  return result.announcements;
}

export async function getCourseAnnouncements(courseId: string) {
  return request<{ announcements: Announcement[]; totalCount: number }>(
    `/api/courses/${courseId}/announcements`,
  );
}

export async function getCourses(semester?: string) {
  const params = new URLSearchParams();
  if (semester) {
    params.append("semester", semester);
  }
  return request<{ courses: Course[]; totalCount: number }>(
    `/api/courses${params.toString() ? `?${params}` : ""}`,
  );
}

export async function getCourseDetail(courseId: string): Promise<
  Course & {
    instructor: { userId: string; name: string; email: string };
    currentStudents: number;
  }
> {
  return request(`/api/courses/${courseId}`);
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
  },
): Promise<Course> {
  return request(`/api/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourse(
  courseId: string,
): Promise<{ message: string }> {
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
  },
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
  },
): Promise<{ scheduleId: string }> {
  return request(`/api/courses/${courseId}/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourseSchedule(
  courseId: string,
  scheduleId: string,
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/schedules/${scheduleId}`, {
    method: "DELETE",
  });
}

export async function getCourseStudents(
  courseId: string,
  page?: number,
  size?: number,
): Promise<{
  students: Array<{
    userId: string;
    name: string;
    email: string;
    joinedAt: string;
  }>;
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (size) params.append("size", size.toString());
  return request(
    `/api/courses/${courseId}/students${params.toString() ? `?${params}` : ""}`,
  );
}

export async function addCourseStudents(
  courseId: string,
  payload: { file?: File; studentIds?: string[] },
): Promise<{
  addedCount: number;
  errors: Array<{ row: number; reason: string }>;
}> {
  const formData = new FormData();
  if (payload.file) {
    formData.append("file", payload.file);
  }
  if (payload.studentIds) {
    formData.append("studentIds", JSON.stringify(payload.studentIds));
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/courses/${courseId}/students`,
    {
      method: "POST",
      headers: {
        ...(authHeaders.Authorization
          ? { Authorization: authHeaders.Authorization }
          : {}),
      },
      body: formData,
    },
  );

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
  studentId: string,
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/students/${studentId}`, {
    method: "DELETE",
  });
}

export async function createCourseInvite(
  courseId: string,
  payload?: { expiresAt?: string },
): Promise<{ inviteToken: string; inviteLink: string; expiresAt: string }> {
  return request(`/api/courses/${courseId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function acceptCourseInvite(
  courseId: string,
  token: string,
): Promise<{ courseId: string; courseName: string; joinedAt: string }> {
  return request(`/api/courses/${courseId}/invites/${token}/accept`, {
    method: "POST",
  });
}

export async function getNoticeSettings() {
  return request<NoticeSettings>("/api/notices/settings");
}

export async function updateNoticeSettings(payload: NoticeSettings) {
  return request<{ message: string; settings: NoticeSettings }>(
    "/api/notices/settings",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getLatestQuiz() {
  return request<QuizLatest>("/api/quiz/latest");
}

export async function generateQuiz(payload: QuizGeneratePayload) {
  return request<{ message: string; quiz: QuizLatest; difficulty: string }>(
    "/api/quiz/generate",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createAudioConvertTask(payload: {
  file_name: string;
  estimated_minutes?: number;
}) {
  return request<AudioConvertTask>("/api/materials/audio-convert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAudioConvertTask(taskId: string) {
  return request<AudioConvertTask>(`/api/materials/audio-convert/${taskId}`);
}

export async function getAnalysisReport() {
  // 과거 UI 프로토타입용 모의(Mock) API 함수입니다.
  // 백엔드에 해당 엔드포인트가 없어 발생하는 404 에러를 방지하기 위해 더미 데이터를 반환합니다.
  // TODO: 이후 teacher-materials.tsx 컴포넌트를 수정하여 실제 API인 getScriptAnalysis()를 사용해야 합니다.
  return Promise.resolve<AnalysisReport>({
    source_file: "대기 중인 파일",
    logical_gaps: 0,
    missing_terms: [],
    missing_prerequisites: [],
    suggestions: ["백엔드 실제 API 연동이 필요합니다."],
  });
}

// User Profile APIs
export async function getUserProfile(userId: string): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${userId}/profile`);
}

export async function updateUserProfile(
  userId: string,
  payload: UpdateProfilePayload,
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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`, {
    method: "PUT",
    headers: {
      ...(authHeaders.Authorization
        ? { Authorization: authHeaders.Authorization }
        : {}),
    },
    body: formData,
  });

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

export async function deleteUserAccount(
  userId: string,
): Promise<{ message: string }> {
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
  }>(
    `/api/dashboard/students/quiz-history${params.toString() ? `?${params}` : ""}`,
  );
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
  }>(
    `/api/dashboard/students/materials${params.toString() ? `?${params}` : ""}`,
  );
}

// Dashboard APIs for Instructors
export async function getInstructorComprehensionTrends(
  courseId?: string,
): Promise<{
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
  }>(
    `/api/dashboard/instructors/comprehension-trends${params.toString() ? `?${params}` : ""}`,
  );
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
  }>(
    `/api/dashboard/instructors/weak-topics${params.toString() ? `?${params}` : ""}`,
  );
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
  }>(
    `/api/dashboard/instructors/upload-status${params.toString() ? `?${params}` : ""}`,
  );
}

// Quiz Types
export type Question = {
  questionId: string;
  orderNum: number;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  content: string;
  options?: string[];
  answer?: string;
};

export type Quiz = {
  quizId: string;
  courseId: string;
  scheduleId: string;
  status: "generating" | "DRAFT" | "PUBLISHED" | "CLOSED";
  difficultyLevel: string;
  anonymousEnabled: boolean;
  expiresAt?: string;
  questions: Question[];
  createdAt: string;
  updatedAt?: string;
};

export type QuizSubmission = {
  submissionId: string;
  quizId: string;
  studentId?: string;
  score: number;
  correctCount: number;
  totalCount: number;
  submittedAt: string;
};

export type ComprehensionReport = {
  quizId: string;
  comprehensionLevel: "GOOD" | "PARTIAL" | "INSUFFICIENT";
  averageScore: number;
  participationRate: number;
  questionAnalysis: Array<{
    questionId: string;
    correctRate: number;
    difficulty: string;
  }>;
};

// Quiz APIs
export async function createQuiz(
  courseId: string,
  payload: {
    scheduleId: string;
    questionCount?: number;
    questionTypes?: string[];
    difficultyLevel?: string;
  },
): Promise<{ quizId: string; status: string; message: string }> {
  return request(`/api/courses/${courseId}/quizzes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCourseQuizzes(
  courseId: string,
  status?: string,
): Promise<{ quizzes: Quiz[]; totalCount: number }> {
  const params = new URLSearchParams();
  if (status) {
    params.append("status", status);
  }
  return request(
    `/api/courses/${courseId}/quizzes${params.toString() ? `?${params}` : ""}`,
  );
}

export async function getQuizDetail(
  courseId: string,
  quizId: string,
): Promise<Quiz> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}`);
}

export async function updateQuizQuestions(
  courseId: string,
  quizId: string,
  payload: Question[],
): Promise<{ quizId: string; updatedAt: string }> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}`, {
    method: "PUT",
    body: JSON.stringify({ questions: payload }),
  });
}

export async function updateQuizSettings(
  courseId: string,
  quizId: string,
  payload: {
    difficultyLevel?: string;
    anonymousEnabled?: boolean;
    expiresAt?: string;
  },
): Promise<Quiz> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuiz(
  courseId: string,
  quizId: string,
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}`, {
    method: "DELETE",
  });
}

export async function publishQuiz(
  courseId: string,
  quizId: string,
): Promise<{ quizId: string; status: string }> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}/publish`, {
    method: "PUT",
  });
}

export async function closeQuiz(
  courseId: string,
  quizId: string,
): Promise<{ quizId: string; status: string }> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}/close`, {
    method: "PUT",
  });
}

export async function submitQuiz(
  courseId: string,
  quizId: string,
  payload: { answers: Array<{ questionId: string; selectedOption: string }> },
): Promise<QuizSubmission> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQuizComprehension(
  courseId: string,
  quizId: string,
): Promise<ComprehensionReport> {
  return request(`/api/courses/${courseId}/quizzes/${quizId}/comprehension`);
}

// Script Types
export type ScriptAnalysis = {
  scriptId: string;
  fileName: string;
  status: "processing" | "completed" | "failed";
  logicalGaps: Array<{
    location: string;
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  missingTerms: string[];
  missingPrerequisites: string[];
  suggestions: string[];
  createdAt: string;
};

// Script APIs
export async function uploadScript(
  courseId: string,
  payload: {
    file: File;
    weekNumber?: number;
    topic?: string;
  },
): Promise<{ scriptId: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.weekNumber) {
    formData.append("weekNumber", payload.weekNumber.toString());
  }
  if (payload.topic) {
    formData.append("topic", payload.topic);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/courses/${courseId}/scripts`,
    {
      method: "POST",
      headers: {
        ...(authHeaders.Authorization
          ? { Authorization: authHeaders.Authorization }
          : {}),
      },
      body: formData,
    },
  );

  if (!response.ok) {
    let message = `스크립트 업로드 실패 (${response.status})`;
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
    scriptId: string;
    status: string;
    message: string;
  };
}

export async function getCourseScripts(
  courseId: string,
): Promise<{ scripts: ScriptAnalysis[] }> {
  return request(`/api/courses/${courseId}/scripts`);
}

export async function getScriptAnalysis(
  courseId: string,
  scriptId: string,
): Promise<ScriptAnalysis> {
  return request(`/api/courses/${courseId}/scripts/${scriptId}`);
}

// Materials Types
export type Material = {
  materialId: string;
  courseId: string;
  scheduleId?: string;
  type: "PREVIEW_GUIDE" | "REVIEW_SUMMARY" | "SCRIPT";
  title: string;
  content?: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt?: string;
};

// Materials APIs
export async function getCourseMaterials(
  courseId: string,
  type?: string,
): Promise<{ materials: Material[]; totalCount: number }> {
  const params = new URLSearchParams();
  if (type) {
    params.append("type", type);
  }
  return request(
    `/api/courses/${courseId}/materials${params.toString() ? `?${params}` : ""}`,
  );
}

export async function createPreviewGuide(
  courseId: string,
  payload: {
    scheduleId: string;
    title: string;
    content?: string;
  },
): Promise<Material> {
  return request(`/api/courses/${courseId}/materials/preview`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createReviewSummary(
  courseId: string,
  payload: {
    scheduleId: string;
    title: string;
    content?: string;
  },
): Promise<Material> {
  return request(`/api/courses/${courseId}/materials/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadMaterial(
  courseId: string,
  payload: {
    file: File;
    type: string;
    scheduleId?: string;
  },
): Promise<Material> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("type", payload.type);
  if (payload.scheduleId) {
    formData.append("scheduleId", payload.scheduleId);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/courses/${courseId}/materials`,
    {
      method: "POST",
      headers: {
        ...(authHeaders.Authorization
          ? { Authorization: authHeaders.Authorization }
          : {}),
      },
      body: formData,
    },
  );

  if (!response.ok) {
    let message = `자료 업로드 실패 (${response.status})`;
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

  return (await response.json()) as Material;
}

export async function deleteMaterial(
  courseId: string,
  materialId: string,
): Promise<{ message: string }> {
  return request(`/api/courses/${courseId}/materials/${materialId}`, {
    method: "DELETE",
  });
}

// Notifications Types
export type Notification = {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

export type NotificationPreferences = {
  userId: string;
  channels: string[]; // email, push, sms, etc
  quizNotifications: boolean;
  materialNotifications: boolean;
  deadlineNotifications: boolean;
  deadlineHoursBefore: number;
};

// Notifications APIs
export async function getNotifications(
  userId: string,
  unreadOnly?: boolean,
): Promise<{ notifications: Notification[]; totalCount: number }> {
  const params = new URLSearchParams();
  if (unreadOnly) {
    params.append("unreadOnly", "true");
  }
  return request(
    `/api/users/${userId}/notifications${params.toString() ? `?${params}` : ""}`,
  );
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<{ message: string }> {
  return request(`/api/users/${userId}/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  return request(`/api/users/${userId}/notification-preferences`);
}

export async function updateNotificationPreferences(
  userId: string,
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return request(`/api/users/${userId}/notification-preferences`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Reminders Types
export type Reminder = {
  reminderId: string;
  userId: string;
  courseId: string;
  type: string;
  title: string;
  description?: string;
  dueDate: string;
  status: "pending" | "sent" | "dismissed";
  createdAt: string;
};

// Reminders APIs
export async function getReminders(userId: string): Promise<{
  reminders: Reminder[];
  totalCount: number;
}> {
  return request(`/api/users/${userId}/reminders`);
}

export async function dismissReminder(
  userId: string,
  reminderId: string,
): Promise<{ message: string }> {
  return request(`/api/users/${userId}/reminders/${reminderId}/dismiss`, {
    method: "POST",
  });
}

// Course Additional APIs for Instructors
export async function assignCoursesToInstructor(
  userId: string,
  courseIds: string[],
): Promise<{
  assignedCourses: Array<{
    courseId: string;
    courseName: string;
    semester: string;
  }>;
  totalCount: number;
}> {
  return request(`/api/users/${userId}/courses`, {
    method: "POST",
    body: JSON.stringify({ courseIds }),
  });
}

export async function getInstructorCourses(
  userId: string,
  semester?: string,
): Promise<{
  courses: Course[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (semester) {
    params.append("semester", semester);
  }
  return request(
    `/api/users/${userId}/courses${params.toString() ? `?${params}` : ""}`,
  );
}

export async function updateUserRole(
  userId: string,
  role: "INSTRUCTOR" | "STUDENT" | "ADMIN",
): Promise<{ userId: string; role: string; updatedAt: string }> {
  return request(`/api/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

// Announcements APIs
export type AnnouncementDetail = {
  announcementId: string;
  courseId: string;
  scheduleId?: string;
  title: string;
  content: string;
  templateType?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
};

export async function createAnnouncement(
  courseId: string,
  payload: {
    scheduleId?: string;
    title: string;
    content: string;
    templateType?: string;
  },
): Promise<AnnouncementDetail> {
  return request(`/api/courses/${courseId}/announcements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishAnnouncement(
  courseId: string,
  announcementId: string,
): Promise<{ announcementId: string; status: string; publishedAt: string }> {
  return request(
    `/api/courses/${courseId}/announcements/${announcementId}/publish`,
    {
      method: "POST",
    },
  );
}
