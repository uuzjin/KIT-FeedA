export type MenuKey = "materials" | "analysis" | "quiz" | "notices";

export interface CourseItem {
  id: number;
  name: string;
  semester: string;
  studentCount: number;
}

export interface DashboardSummary {
  averageAccuracy: number;
  weakTopics: string[];
  uploadedWeeks: number;
  totalWeeks: number;
}

export interface AnalysisReport {
  source_file: string;
  logical_gaps: number;
  missing_terms: string[];
  missing_prerequisites: string[];
  suggestions: string[];
}

export interface QuizInfo {
  title: string;
  questions: number;
  anonymous_enabled: boolean;
  accuracy: number;
  hard_questions: string[];
}

export interface AudioConvertTask {
  task_id: string;
  file_name: string;
  status: "processing" | "completed";
  progress: number;
  transcript_preview: string | null;
}
