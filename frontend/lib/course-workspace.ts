import {
  getCourseDetail,
  getCourseStudents,
  getCourseScripts,
  getCourseSchedules,
  getCourseMaterials,
} from "@/lib/api";

export async function loadCourseWorkspace(courseId: string) {
  const [course, enrollments, scriptsRes, schedulesRes, previewRes, reviewRes] =
    await Promise.all([
      getCourseDetail(courseId),
      getCourseStudents(courseId),
      getCourseScripts(courseId),
      getCourseSchedules(courseId),
      getCourseMaterials(courseId, "PREVIEW_GUIDE"),
      getCourseMaterials(courseId, "REVIEW_SUMMARY"),
    ]);

  const scheduleExtras = schedulesRes.schedules.map((s) => ({
    schedule: s,
    preview:
      previewRes.materials.find((m) => m.scheduleId === s.scheduleId) || null,
    review:
      reviewRes.materials.find((m) => m.scheduleId === s.scheduleId) || null,
  }));

  return {
    course,
    enrollments,
    scripts: scriptsRes.scripts,
    scheduleExtras,
  };
}
