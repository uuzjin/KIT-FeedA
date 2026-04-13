import {
  getCourseDetail,
  getCourseStudents,
  getCourseScripts,
  getCourseSchedules,
  getPreviewGuide,
  getReviewSummary,
  type PreviewGuide,
  type ReviewSummary,
} from "@/lib/api";

export async function loadCourseWorkspace(courseId: string) {
  const [course, enrollments, scriptsRes, schedulesRes] = await Promise.all([
    getCourseDetail(courseId),
    getCourseStudents(courseId),
    getCourseScripts(courseId),
    getCourseSchedules(courseId),
  ]);

  // Fetch preview/review per-schedule (404 = not generated yet, treat as null)
  const scheduleExtras = await Promise.all(
    schedulesRes.schedules.map(async (s) => {
      const [preview, review] = await Promise.all([
        getPreviewGuide(courseId, s.scheduleId).catch(
          () => null as PreviewGuide | null,
        ),
        getReviewSummary(courseId, s.scheduleId).catch(
          () => null as ReviewSummary | null,
        ),
      ]);
      return { schedule: s, preview, review };
    }),
  );

  return {
    course,
    enrollments,
    scripts: scriptsRes.scripts,
    scheduleExtras,
  };
}
