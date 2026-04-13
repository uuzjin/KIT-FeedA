"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getCourses, type Course } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface CourseContextType {
  courses: Course[];
  selectedCourse: Course | null;
  setSelectedCourse: (course: Course) => void;
  isLoading: boolean;
  error: string | null;
  refreshCourses: () => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCourses = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await getCourses();
      setCourses(res.courses);

      // 기존에 선택된 강의가 새 목록에도 있으면 유지하고, 없으면 첫 번째 강의로 덮어씀
      if (res.courses.length > 0) {
        setSelectedCourse((prev) => {
          if (prev && res.courses.some((c) => c.courseId === prev.courseId)) {
            return prev;
          }
          return res.courses[0];
        });
      } else {
        setSelectedCourse(null);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "과목 목록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCourses();
  }, [user]);

  return (
    <CourseContext.Provider
      value={{
        courses,
        selectedCourse,
        setSelectedCourse,
        isLoading,
        error,
        refreshCourses,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error("useCourse must be used within a CourseProvider");
  }
  return context;
}
