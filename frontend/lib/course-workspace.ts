import {
  getCourseDetail,
  getCourseEnrollments,
  getCourseScripts,
  getCourseSchedules,
  getPreviewGuideForSchedule,
  getReviewSummaryForSchedule,
} from "@/lib/api";

export async function loadCourseWorkspace(courseId: string) {
  const [course, enrollments, scriptsRes, schedulesRes] = await Promise.all([
    getCourseDetail(courseId),
    getCourseEnrollments(courseId),
    getCourseScripts(courseId),
    getCourseSchedules(courseId),
  ]);

  const scheduleExtras = await Promise.all(
    schedulesRes.schedules.map(async (s) => ({
      schedule: s,
      preview: await getPreviewGuideForSchedule(courseId, s.scheduleId),
      review: await getReviewSummaryForSchedule(courseId, s.scheduleId),
    }))
  );

  return {
    course,
    enrollments,
    scripts: scriptsRes.scripts,
    scheduleExtras,
  };
}
