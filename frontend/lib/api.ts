import { supabase } from "@/lib/supabase/client";

const FALLBACK_API_BASE_URL = "https://backend-production-9c858.up.railway.app";

function isLocalAddress(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configured) {
    return FALLBACK_API_BASE_URL;
  }

  try {
    const parsed = new URL(configured);
    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname;
      const currentProtocol = window.location.protocol;
      const runningInProductionLikeHost = !isLocalAddress(currentHost);
      const configuredIsLocal = isLocalAddress(parsed.hostname);
      const mixedContent =
        currentProtocol === "https:" && parsed.protocol === "http:";

      if (runningInProductionLikeHost && (configuredIsLocal || mixedContent)) {
        return FALLBACK_API_BASE_URL;
      }
    }
    return normalizeBaseUrl(parsed.toString());
  } catch {
    return FALLBACK_API_BASE_URL;
  }
}

type RequestOptions = RequestInit & {
  requiresAuth?: boolean;
};

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

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { requiresAuth = true, ...fetchInit } = init ?? {};
  const authHeaders = await getAuthHeaders();
  const requestUrl = `${resolveApiBaseUrl()}${path}`;

  // Safely merge headers
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(fetchInit.headers as Record<string, string>),
  };

  if (fetchInit.headers && typeof fetchInit.headers === "object") {
    const headerObj = fetchInit.headers as Record<string, string>;
    Object.keys(headerObj).forEach((key) => {
      if (typeof headerObj[key] === "string") {
        mergedHeaders[key] = headerObj[key];
      }
    });
  }

  // [디버깅] 프론트엔드 내부적으로는 토큰이 제대로 담겼는지 개발자 도구 콘솔에 출력
  if (requiresAuth && !mergedHeaders.Authorization) {
    throw new Error("인증 토큰이 없습니다. 다시 로그인해주세요.");
  }

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...fetchInit,
      headers: mergedHeaders,
      credentials: "include",
    });
  } catch {
    throw new Error(
      `API 서버에 연결할 수 없습니다. 요청 주소를 확인해주세요. (${requestUrl})`,
    );
  }

  if (!response.ok) {
    let backendMessage = `HTTP error! status: ${response.status}`;
    try {
      const errText = await response.text();
      if (errText.trim()) {
        const errorData = JSON.parse(errText) as {
          detail?: string;
          message?: string;
        };
        backendMessage =
          (typeof errorData.detail === "string"
            ? errorData.detail
            : undefined) ||
          (typeof errorData.message === "string"
            ? errorData.message
            : undefined) ||
          backendMessage;
      }
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

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("서버 응답을 해석할 수 없습니다.");
  }
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

// Course types
export type Course = {
  courseId: string;
  courseName: string;
  semester: string;
  dayOfWeek: string[];
  startTime: string | null;
  endTime: string | null;
  maxStudents?: number;
  description?: string | null;
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

export async function getNotices(courseId?: string) {
  if (!courseId) {
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
  startTime: string | null;
  endTime: string | null;
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
  await request<void>(`/api/courses/${courseId}`, {
    method: "DELETE",
  });
  return { message: "삭제되었습니다." };
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

export type CourseEnrollment = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
};

export async function getCourseStudents(
  courseId: string,
  page?: number,
  size?: number,
): Promise<{
  students: CourseEnrollment[];
  totalCount: number;
}> {
  const params = new URLSearchParams();
  if (page) params.append("page", page.toString());
  if (size) params.append("size", size.toString());
  const res = await request<{
    students: Array<{
      studentId: string;
      name: string | null;
      email: string | null;
      joinMethod: string;
      joinedAt: string;
    }>;
    totalCount: number;
  }>(
    `/api/courses/${courseId}/enrollments${params.toString() ? `?${params}` : ""}`,
  );
  return {
    students: (res.students ?? []).map((s) => ({
      userId: s.studentId,
      name: s.name ?? "",
      email: s.email ?? "",
      joinedAt: s.joinedAt,
    })),
    totalCount: res.totalCount ?? 0,
  };
}

export async function addCourseStudents(
  courseId: string,
  payload: { file?: File; studentIds?: string[] },
): Promise<{
  addedCount: number;
  notFoundEmails?: string[];
  errors: Array<{ row: number; reason: string }>;
}> {
  if (payload.file) {
    const formData = new FormData();
    formData.append("file", payload.file);

    const authHeaders = await getAuthHeaders();
    const res = await fetch(
      `${resolveApiBaseUrl()}/api/courses/${courseId}/enrollments/upload`,
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
    if (!res.ok) {
      let message = `파일 등록 실패 (${res.status})`;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) message = body.detail;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    const data = (await res.json()) as {
      enrolledCount: number;
      notFoundEmails?: string[];
    };
    return {
      addedCount: data.enrolledCount ?? 0,
      notFoundEmails: data.notFoundEmails ?? [],
      errors: [],
    };
  }

  if (!payload.studentIds?.length) {
    throw new Error("추가할 학생 ID가 없습니다.");
  }
  const res = await request<{ message?: string; enrolledCount: number }>(
    `/api/courses/${courseId}/enrollments`,
    {
      method: "POST",
      body: JSON.stringify({ studentIds: payload.studentIds }),
    },
  );
  return {
    addedCount: res.enrolledCount ?? 0,
    errors: [],
  };
}

export async function removeCourseStudent(
  courseId: string,
  studentId: string,
): Promise<{ message: string }> {
  await request<void>(`/api/courses/${courseId}/enrollments/${studentId}`, {
    method: "DELETE",
  });
  return { message: "삭제되었습니다." };
}

export type CourseInviteResponse = {
  courseId: string;
  inviteToken: string;
  inviteLink: string;
  expiresAt: string;
  createdAt: string;
};

export type CourseInvitePreview = {
  courseId: string;
  courseName: string;
  description: string | null;
  instructorName: string;
  expiresAt: string | null;
  isExpired: boolean;
};

export async function getInvitePreview(
  token: string,
): Promise<CourseInvitePreview> {
  return request<CourseInvitePreview>(`/api/courses/invites/${token}`, {
    method: "GET",
    requiresAuth: false,
  });
}

export async function createCourseInvite(
  courseId: string,
  payload?: { expiresAt?: string },
): Promise<CourseInviteResponse> {
  return request<CourseInviteResponse>(`/api/courses/${courseId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function joinCourseByInviteToken(token: string): Promise<{
  courseId: string;
  message: string;
  courseName?: string;
  joinedAt?: string;
}> {
  return request(`/api/courses/join`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export type LmsSyncRecord = {
  syncId: string;
  lmsType: string;
  lmsCourseId: string;
  syncedStudents: number;
  syncedAt: string;
};

export async function getLmsSyncHistory(courseId: string) {
  return request<{ syncs: LmsSyncRecord[]; totalCount: number }>(
    `/api/courses/${courseId}/lms-syncs`,
  );
}

export async function syncLmsStudents(
  courseId: string,
  payload: { lmsType: string; lmsCourseId: string; syncStudents?: boolean },
) {
  return request<{
    syncId: string | null;
    syncedStudents: number;
    lastSyncAt: string;
  }>(`/api/courses/${courseId}/lms-syncs`, {
    method: "POST",
    body: JSON.stringify({
      lmsType: payload.lmsType,
      lmsCourseId: payload.lmsCourseId,
      syncStudents: payload.syncStudents ?? true,
    }),
  });
}

export async function getNoticeSettings() {
  return request<NoticeSettings>("/api/notices/settings");
}

export async function updateNoticeSettings(payload: NoticeSettings) {
  return request<{ message: string; settings: NoticeSettings }>(
    "/api/notices/settings",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

// Audio — course-scoped
export type AudioItem = {
  audioId: string;
  courseId: string;
  fileName: string;
  status: string; // PENDING | PROCESSING | COMPLETED | FAILED
  transcriptPreview: string | null;
  createdAt: string;
};

export async function listAudios(courseId: string): Promise<{ audios: AudioItem[]; totalCount: number }> {
  const res = await request<any>(`/api/courses/${courseId}/audios`);
  const audios = (res.audios ?? []).map((a: any) => ({
    audioId: a.audioId,
    courseId,
    fileName: a.fileName,
    status: a.status,
    transcriptPreview: a.transcript ?? null,
    createdAt: a.uploadedAt,
  }));
  return { audios, totalCount: res.totalCount ?? audios.length };
}

export async function getAudio(courseId: string, audioId: string): Promise<AudioItem> {
  const res = await request<any>(`/api/courses/${courseId}/audios/${audioId}`);
  return {
    audioId: res.audioId,
    courseId: courseId,
    fileName: res.fileName,
    status: res.status,
    transcriptPreview: res.transcript ? res.transcript.substring(0, 200) : null,
    createdAt: res.uploadedAt,
  };
}

export async function uploadAudio(
  courseId: string,
  file: File,
  scheduleId?: string,
): Promise<{ audioId: string; status: string; fileName: string; transcriptPreview?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (scheduleId) {
    formData.append("schedule_id", scheduleId);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${resolveApiBaseUrl()}/api/courses/${courseId}/audios`,
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
    let message = `오디오 업로드 실패 (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) message = body.detail;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    audioId: data.audioId,
    status: data.status,
    fileName: data.fileName,
  };
}

export async function getAudioConvertTask(courseId: string, audioId: string) {
  const res = await request<any>(`/api/courses/${courseId}/audios/${audioId}`);
  return {
    audioId: res.audioId,
    status: res.status,
    transcript: res.transcript,
    transcriptPreview: res.transcript ? res.transcript.substring(0, 200) : null,
    completedAt: res.transcriptCompletedAt,
    fileName: res.fileName,
  };
}

// User Profile APIs
export async function getUserProfile(userId: string): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${userId}/profile`);
}

export async function updateUserProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  // 1. Update text fields via JSON PUT
  const textPayload: Record<string, string> = {};
  if (payload.name) textPayload.name = payload.name;
  if (payload.title !== undefined) textPayload.title = payload.title ?? "";

  let profile = await request<UserProfile>(`/api/users/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(textPayload),
  });

  // 2. If an image is provided, upload it separately and merge the result
  if (payload.profileImage) {
    const formData = new FormData();
    formData.append("file", payload.profileImage);

    const authHeaders = await getAuthHeaders();
    const imgRes = await fetch(
      `${resolveApiBaseUrl()}/api/users/${userId}/profile/image`,
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

    if (!imgRes.ok) {
      let message = `프로필 이미지 업로드 실패 (${imgRes.status})`;
      try {
        const body = (await imgRes.json()) as { detail?: string };
        if (body?.detail) message = body.detail;
      } catch { /* ignore */ }
      throw new Error(message);
    }

    const imgData = (await imgRes.json()) as { profileImageUrl: string };
    profile = { ...profile, profileImageUrl: imgData.profileImageUrl };
  }

  return profile;
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
    params.append("course_id", courseId);
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
    params.append("course_id", courseId);
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
    params.append("course_id", courseId);
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
    params.append("course_id", courseId);
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
    params.append("course_id", courseId);
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
  overallRate: number;
  level: "GOOD" | "PARTIAL" | "LOW";
  topicBreakdown: Array<{
    topic: string;
    rate: number;
    level: "GOOD" | "PARTIAL" | "LOW";
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

/** 목록/상세 공통: 백엔드 `scripts._format_script` 응답 */
export type CourseScriptListItem = {
  scriptId: string;
  courseId: string;
  scheduleId?: string | null;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  weekNumber?: number | null;
  uploadedAt: string;
  downloadUrl?: string;
  status?: string;
};

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
    title: string;
    weekNumber?: number;
    topic?: string;
    scheduleId?: string;
  },
): Promise<{ scriptId: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("title", payload.title);
  if (payload.weekNumber) {
    formData.append("week_number", payload.weekNumber.toString());
  }
  if (payload.topic) {
    formData.append("topic", payload.topic);
  }
  if (payload.scheduleId) {
    formData.append("schedule_id", payload.scheduleId);
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${resolveApiBaseUrl()}/api/courses/${courseId}/scripts`,
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
      if (body?.detail) message = body.detail;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return (await response.json()) as {
    scriptId: string;
    status: string;
    message: string;
  };
}

export async function updateScript(
  courseId: string,
  scriptId: string,
  payload: { title?: string; weekNumber?: number; scheduleId?: string | null },
): Promise<CourseScriptListItem> {
  return request(`/api/courses/${courseId}/scripts/${scriptId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCourseScripts(
  courseId: string,
): Promise<{ scripts: CourseScriptListItem[] }> {
  return request(`/api/courses/${courseId}/scripts`);
}

export async function getScriptAnalysis(
  courseId: string,
  scriptId: string,
): Promise<ScriptAnalysis> {
  return request(`/api/courses/${courseId}/scripts/${scriptId}/analysis`);
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

// Content Generation Types
export type PreviewGuide = {
  previewGuideId: string;
  courseId: string;
  scheduleId: string;
  title: string;
  status: "generating" | "completed" | "failed";
  keyConcepts: string[];
  readingMaterials?: unknown;
  summary?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
};

export type ReviewSummary = {
  reviewSummaryId: string;
  courseId: string;
  scheduleId: string;
  title: string;
  status: "generating" | "completed" | "failed";
  content?: string;
  keyPoints: string[];
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
};

// GET /api/courses/{courseId}/schedules/{scheduleId}/preview-guides
export async function getPreviewGuide(
  courseId: string,
  scheduleId: string,
): Promise<PreviewGuide> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/preview-guides`,
  );
}

// POST /api/courses/{courseId}/schedules/{scheduleId}/preview-guides → 202
export async function createPreviewGuide(
  courseId: string,
  scheduleId: string,
): Promise<{ previewGuideId: string; scheduleId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/preview-guides`,
    { method: "POST" },
  );
}

// GET /api/courses/{courseId}/schedules/{scheduleId}/review-summaries
export async function getReviewSummary(
  courseId: string,
  scheduleId: string,
): Promise<ReviewSummary> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/review-summaries`,
  );
}

// POST /api/courses/{courseId}/schedules/{scheduleId}/review-summaries → 202
export async function createReviewSummary(
  courseId: string,
  scheduleId: string,
): Promise<{ reviewSummaryId: string; scheduleId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/review-summaries`,
    { method: "POST" },
  );
}

export async function generatePreviewGuide(
  courseId: string,
  scheduleId: string,
): Promise<any> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/preview-guides`,
    {
      method: "POST",
    },
  );
}

export async function generateReviewSummary(
  courseId: string,
  scheduleId: string,
): Promise<any> {
  return request(
    `/api/courses/${courseId}/schedules/${scheduleId}/review-summaries`,
    {
      method: "POST",
    },
  );
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
    `${resolveApiBaseUrl()}/api/courses/${courseId}/materials`,
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
      if (body?.detail) message = body.detail;
    } catch { /* ignore */ }
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
  channels: string[];
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

// ── 수업 사후 분석 (Post-Analysis) ────────────────────────────────────────────

export type PostAnalysisItem = {
  id: string;
  analysisType: "structure" | "concepts";
  status: "pending" | "processing" | "completed" | "failed";
  result: {
    // structure 결과
    structure_map?: Array<{
      phase: string;
      description: string;
      strength: string;
      weakness: string | null;
    }>;
    flow_score?: number;
    overall_comment?: string;
    // concepts 결과
    covered_concepts?: Array<{
      concept: string;
      coverage: "충분" | "부족" | "누락";
      note: string;
    }>;
    missing_concepts?: string[];
    coverage_score?: number;
  } | null;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

export async function getPostAnalyses(
  courseId: string,
  scriptId: string,
): Promise<{ scriptId: string; postAnalyses: PostAnalysisItem[] }> {
  return request(
    `/api/courses/${courseId}/scripts/${scriptId}/post-analyses`,
  );
}

export async function triggerStructureAnalysis(
  courseId: string,
  scriptId: string,
): Promise<{ scriptId: string; analysisType: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/scripts/${scriptId}/post-analyses/structure`,
    { method: "POST" },
  );
}

export async function triggerConceptsAnalysis(
  courseId: string,
  scriptId: string,
): Promise<{ scriptId: string; analysisType: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/scripts/${scriptId}/post-analyses/concepts`,
    { method: "POST" },
  );
}

// ── AI 학생 시뮬레이션 ────────────────────────────────────────────────────────

export type AiSimContext = {
  contextId: string;
  scriptIds: string[];
  loadedDocuments: number;
  totalTokens: number;
  model: string;
  createdAt: string;
};

export type AiSimAssessment = {
  assessmentId: string;
  contextId: string;
  status: "pending" | "processing" | "completed" | "failed";
  questionTypes: string[];
  count: number;
  questions: Array<{
    type: string;
    question: string;
    answer?: string;
    options?: string[];
  }>;
  errorMessage?: string;
  completedAt?: string;
};

export type AiSimAnswers = {
  answerId: string;
  assessmentId: string;
  simulationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  answers: Array<{
    questionIndex: number;
    answer: string;
    reasoning?: string;
  }>;
  errorMessage?: string;
  completedAt?: string;
};

export type AiSimGrades = {
  gradeId: string;
  assessmentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalScore: number;
  grades: Array<{
    questionIndex: number;
    score: number;
    feedback: string;
    isCorrect?: boolean;
  }>;
  strengths: string[];
  weaknesses: string[];
  errorMessage?: string;
  completedAt?: string;
};

export type AiSimQualityReport = {
  reportId: string;
  assessmentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  coverageRate: number;
  sufficientTopics: string[];
  insufficientTopics: Array<{ topic: string; reason: string }>;
  errorMessage?: string;
  completedAt?: string;
};

export type AiSimQaPairs = {
  qaPairId: string;
  assessmentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  qaPairs: Array<{ question: string; answer: string }>;
  errorMessage?: string;
  completedAt?: string;
};

export async function createAiSimContext(
  courseId: string,
  payload: { scriptIds: string[]; model?: string },
): Promise<AiSimContext> {
  return request(`/api/courses/${courseId}/ai-student/contexts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAiSimSimulation(
  courseId: string,
  payload: { contextId: string },
): Promise<{ simulationId: string; contextId: string; status: string; knowledgeScope: string; createdAt: string }> {
  return request(`/api/courses/${courseId}/ai-student/simulations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAiSimAssessment(
  courseId: string,
  payload: { contextId: string; questionTypes?: string[]; count?: number },
): Promise<{ assessmentId: string; status: string; message: string }> {
  return request(`/api/courses/${courseId}/ai-student/assessments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAiSimAssessment(
  courseId: string,
  assessmentId: string,
): Promise<AiSimAssessment> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}`,
  );
}

export async function createAiSimAnswers(
  courseId: string,
  assessmentId: string,
  payload: { simulationId: string },
): Promise<{ answerId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/answers`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function getAiSimAnswers(
  courseId: string,
  assessmentId: string,
): Promise<AiSimAnswers> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/answers`,
  );
}

export async function createAiSimGrades(
  courseId: string,
  assessmentId: string,
): Promise<{ gradeId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/grades`,
    { method: "POST" },
  );
}

export async function getAiSimGrades(
  courseId: string,
  assessmentId: string,
): Promise<AiSimGrades> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/grades`,
  );
}

export async function createAiSimQualityReport(
  courseId: string,
  assessmentId: string,
): Promise<{ reportId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/quality-reports`,
    { method: "POST" },
  );
}

export async function getAiSimQualityReport(
  courseId: string,
  assessmentId: string,
): Promise<AiSimQualityReport> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/quality-reports`,
  );
}

export async function createAiSimQaPairs(
  courseId: string,
  assessmentId: string,
  payload: { simulationId: string },
): Promise<{ qaPairId: string; status: string; message: string }> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/qa-pairs`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function getAiSimQaPairs(
  courseId: string,
  assessmentId: string,
): Promise<AiSimQaPairs> {
  return request(
    `/api/courses/${courseId}/ai-student/assessments/${assessmentId}/qa-pairs`,
  );
}
