"use client";

import { useCourse } from "@/contexts/course-context";
import { BookOpen, Calendar, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CourseInfoBanner() {
  const { selectedCourse, isLoading } = useCourse();

  if (isLoading)
    return (
      <div className="h-[88px] w-full animate-pulse rounded-xl bg-muted mb-5"></div>
    );
  if (!selectedCourse) return null;

  const days =
    selectedCourse.dayOfWeek?.length > 0
      ? selectedCourse.dayOfWeek.join(", ")
      : "요일 미정";
  const time =
    selectedCourse.startTime && selectedCourse.endTime
      ? `${selectedCourse.startTime} - ${selectedCourse.endTime}`
      : "시간 미정";

  return (
    <Card className="mb-2 border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 shadow-sm">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
            <BookOpen className="size-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/20 font-medium"
              >
                {selectedCourse.semester}
              </Badge>
              <h2 className="text-lg font-bold text-foreground">
                {selectedCourse.courseName}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" /> {days}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {time}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
