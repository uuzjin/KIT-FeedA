"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  createAudioConvertTask,
  createCourse,
  generateQuiz,
  getAnalysisReport,
  getAudioConvertTask,
  getCourses,
  getDashboardSummary,
  getLatestQuiz
} from "@/lib/api";
import type {
  AnalysisReport,
  AudioConvertTask,
  CourseItem,
  DashboardSummary,
  MenuKey,
  QuizInfo
} from "@/types/dashboard";

const MENUS: { key: MenuKey; label: string }[] = [
  { key: "materials", label: "강의 자료" },
  { key: "analysis", label: "분석" },
  { key: "quiz", label: "퀴즈" },
  { key: "notices", label: "공지" }
];

const sectionDescriptions: Record<MenuKey, string> = {
  materials: "예습/복습 자료, 공지문 자동 생성을 관리합니다.",
  analysis: "스크립트 구조 분석, 전문용어/전제지식 누락 탐지를 확인합니다.",
  quiz: "AI 자동 출제, 익명 응시 결과, 문항별 오답률 리포트를 제공합니다.",
  notices: "마감 리마인더 및 알림 채널 설정을 관리합니다."
};

export default function HomePage() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("materials");
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [audioTask, setAudioTask] = useState<AudioConvertTask | null>(null);
  const [audioFileName, setAudioFileName] = useState("week6-lecture.mp3");
  const [quizTopic, setQuizTopic] = useState("Transformer");
  const [quizDifficulty, setQuizDifficulty] = useState("mixed");
  const [courseName, setCourseName] = useState("");
  const [courseSemester, setCourseSemester] = useState("2026-1");
  const [courseStudents, setCourseStudents] = useState("30");

  useEffect(() => {
    void getCourses().then(setCourses).catch(() => setCourses([]));
    void getDashboardSummary().then(setSummary).catch(() => setSummary(null));
    void getAnalysisReport().then(setAnalysis).catch(() => setAnalysis(null));
    void getLatestQuiz().then(setQuiz).catch(() => setQuiz(null));
  }, []);

  useEffect(() => {
    if (!audioTask || audioTask.status === "completed") return;
    const timer = setInterval(() => {
      void getAudioConvertTask(audioTask.task_id).then(setAudioTask).catch(() => undefined);
    }, 1500);
    return () => clearInterval(timer);
  }, [audioTask]);

  const uploadStatus = useMemo(() => {
    if (!summary) return "데이터를 불러오는 중";
    return `${summary.uploadedWeeks}/${summary.totalWeeks}주차 업로드 완료`;
  }, [summary]);

  const startAudioConvert = async () => {
    const task = await createAudioConvertTask(audioFileName.trim() || "lecture-audio.mp3");
    setAudioTask(task);
  };

  const createQuiz = async () => {
    const result = await generateQuiz(quizTopic.trim() || "기본 개념", quizDifficulty);
    setQuiz(result.quiz);
    setActiveMenu("quiz");
  };

  const addCourse = async () => {
    const name = courseName.trim();
    const studentCount = Number(courseStudents);
    if (!name || Number.isNaN(studentCount) || studentCount < 1) return;
    const result = await createCourse({
      name,
      semester: courseSemester.trim() || "2026-1",
      studentCount
    });
    setCourses((prev) => [...prev, result.course]);
    setCourseName("");
    setCourseStudents("30");
  };

  return (
    <main style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.profileCard}>
          <div style={styles.avatarCircle}>👤</div>
          <div style={styles.profileText}>프로필</div>
        </div>

        <section>
          <h2 style={styles.sidebarTitle}>강의목록</h2>
          <div style={styles.sidebarForm}>
            <input
              style={styles.input}
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="강의명"
            />
            <input
              style={styles.input}
              value={courseSemester}
              onChange={(e) => setCourseSemester(e.target.value)}
              placeholder="학기 (예: 2026-1)"
            />
            <input
              style={styles.input}
              value={courseStudents}
              onChange={(e) => setCourseStudents(e.target.value)}
              placeholder="수강인원"
            />
            <button style={styles.primaryButton} onClick={addCourse}>
              수업 추가
            </button>
          </div>
          <ul style={styles.courseList}>
            {courses.map((course) => (
              <li key={course.id} style={styles.courseItem}>
                <strong>{course.name}</strong>
                <span>
                  {course.semester} · {course.studentCount}명
                </span>
              </li>
            ))}
            {courses.length === 0 && <li style={styles.courseItem}>강의 데이터 없음</li>}
          </ul>
        </section>
      </aside>

      <section style={styles.content}>
        <nav style={styles.topMenu}>
          {MENUS.map((menu) => (
            <button
              key={menu.key}
              onClick={() => setActiveMenu(menu.key)}
              style={{
                ...styles.menuButton,
                ...(activeMenu === menu.key ? styles.menuButtonActive : {})
              }}
            >
              {menu.label}
            </button>
          ))}
        </nav>

        <section style={styles.panel}>
          <h1 style={styles.panelTitle}>{MENUS.find((m) => m.key === activeMenu)?.label}</h1>
          <p style={styles.panelDesc}>{sectionDescriptions[activeMenu]}</p>
          <div style={styles.cards}>
            <article style={styles.card}>
              <h3>자료 업로드 현황</h3>
              <p>{uploadStatus}</p>
            </article>
            <article style={styles.card}>
              <h3>평균 정답률</h3>
              <p>{summary ? `${summary.averageAccuracy}%` : "-"}</p>
            </article>
            <article style={styles.card}>
              <h3>취약 토픽 TOP</h3>
              <p>{summary?.weakTopics.join(", ") ?? "-"}</p>
            </article>
          </div>
          {activeMenu === "materials" && (
            <section style={styles.featureSection}>
              <h3>오디오 파일 변환 (6.5)</h3>
              <div style={styles.inlineControls}>
                <input
                  style={styles.input}
                  value={audioFileName}
                  onChange={(e) => setAudioFileName(e.target.value)}
                  placeholder="오디오 파일명 입력"
                />
                <button style={styles.primaryButton} onClick={startAudioConvert}>
                  변환 시작
                </button>
              </div>
              <div style={styles.progressWrap}>
                <div style={{ ...styles.progressBar, width: `${audioTask?.progress ?? 0}%` }} />
              </div>
              <p>
                상태: {audioTask ? `${audioTask.status} (${audioTask.progress}%)` : "대기 중"}
              </p>
              {audioTask?.transcript_preview && <p>{audioTask.transcript_preview}</p>}
            </section>
          )}

          {activeMenu === "analysis" && (
            <section style={styles.featureSection}>
              <h3>스크립트 분석 리포트</h3>
              <p>분석 파일: {analysis?.source_file ?? "-"}</p>
              <p>논리 흐름 끊김: {analysis?.logical_gaps ?? 0}건</p>
              <p>미설명 전문용어: {analysis?.missing_terms.join(", ") ?? "-"}</p>
              <p>누락 전제지식: {analysis?.missing_prerequisites.join(", ") ?? "-"}</p>
              <p>보완 제안: {analysis?.suggestions.join(" / ") ?? "-"}</p>
            </section>
          )}

          {activeMenu === "quiz" && (
            <section style={styles.featureSection}>
              <h3>퀴즈 자동 생성</h3>
              <div style={styles.inlineControls}>
                <input
                  style={styles.input}
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  placeholder="토픽"
                />
                <select
                  style={styles.input}
                  value={quizDifficulty}
                  onChange={(e) => setQuizDifficulty(e.target.value)}
                >
                  <option value="easy">easy</option>
                  <option value="mixed">mixed</option>
                  <option value="hard">hard</option>
                </select>
                <button style={styles.primaryButton} onClick={createQuiz}>
                  생성
                </button>
              </div>
              <p>제목: {quiz?.title ?? "-"}</p>
              <p>문항 수: {quiz?.questions ?? 0}</p>
              <p>익명 응시: {quiz?.anonymous_enabled ? "ON" : "OFF"}</p>
              <p>정답률: {quiz?.accuracy ?? 0}%</p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr"
  },
  sidebar: {
    background: "#d9dde4",
    padding: "24px 20px",
    borderRight: "1px solid #c6cedb"
  },
  profileCard: {
    background: "#fff",
    borderRadius: 4,
    padding: "14px 12px",
    display: "flex",
    gap: 10,
    alignItems: "center"
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "#dcd7ff",
    display: "grid",
    placeItems: "center"
  },
  profileText: {
    fontWeight: 600
  },
  sidebarTitle: {
    marginTop: 52,
    marginBottom: 16,
    fontSize: 40,
    lineHeight: 1.05
  },
  sidebarForm: {
    display: "grid",
    gap: 8,
    marginBottom: 14
  },
  courseList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: 12
  },
  courseItem: {
    background: "#eef2f7",
    border: "1px solid #bac7da",
    borderRadius: 8,
    padding: 10,
    display: "grid",
    gap: 4
  },
  content: {
    padding: 24
  },
  topMenu: {
    background: "#d4d4d4",
    display: "flex",
    gap: 8,
    padding: 14,
    minHeight: 110,
    alignItems: "flex-start",
    flexWrap: "wrap"
  },
  menuButton: {
    border: "1px solid transparent",
    background: "transparent",
    fontSize: 24,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 8
  },
  menuButtonActive: {
    background: "#2033ff",
    color: "#fff"
  },
  panel: {
    marginTop: 22,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #bac7da",
    padding: 22
  },
  panelTitle: {
    margin: 0,
    fontSize: 32,
    color: "#2033ff"
  },
  panelDesc: {
    marginTop: 10,
    color: "#394662"
  },
  cards: {
    marginTop: 16,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
  },
  card: {
    background: "#f6f9ff",
    border: "1px solid #d8e1f0",
    borderRadius: 10,
    padding: 14
  },
  featureSection: {
    marginTop: 18,
    borderTop: "1px dashed #bac7da",
    paddingTop: 14
  },
  inlineControls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10
  },
  input: {
    border: "1px solid #bac7da",
    borderRadius: 8,
    padding: "8px 10px",
    minWidth: 180
  },
  primaryButton: {
    background: "#2033ff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer"
  },
  progressWrap: {
    marginTop: 8,
    width: "100%",
    height: 12,
    background: "#dbe3f0",
    borderRadius: 999,
    overflow: "hidden"
  },
  progressBar: {
    height: "100%",
    background: "#b3ff3b",
    transition: "width 0.3s ease"
  }
};
