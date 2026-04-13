"use client";

import Link from "next/link";
import {
  Menu,
  Settings,
  LogOut,
  User,
  Bell,
  Trash2,
  GraduationCap,
  BookOpen,
  Plus,
  Loader2,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { DeleteAccountDialog } from "@/components/profile/delete-account-dialog";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { type Course } from "@/lib/api";
import { useCourse } from "@/contexts/course-context";

function formatCourseSchedule(course: Course) {
  const days =
    course.dayOfWeek?.length > 0 ? course.dayOfWeek.join("/") : "요일 미정";
  const time =
    course.startTime && course.endTime
      ? `${course.startTime}–${course.endTime}`
      : "시간 미정";
  return { days, time };
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const {
    courses,
    selectedCourse,
    setSelectedCourse,
    isLoading: isCoursesLoading,
    error: coursesError,
  } = useCourse();
  const [notifications, setNotifications] = useState({
    quiz: true,
    material: true,
    deadline: true,
  });
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isTeacher = user?.role === "INSTRUCTOR";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur-sm supports-backdrop-filter:bg-card/80">
      <div className="flex h-14 items-center justify-between px-4">
        {/* 좌측: 햄버거 메뉴 */}
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-primary/10"
            >
              <Menu className="size-5 text-foreground" />
              <span className="sr-only">{"메뉴 열기"}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-75 p-0 sm:w-85">
            <SheetHeader className="border-b border-border/40 bg-primary/5 px-5 py-5">
              <SheetTitle className="flex items-center gap-2 text-left text-primary">
                {isTeacher ? (
                  <GraduationCap className="size-5" />
                ) : (
                  <BookOpen className="size-5" />
                )}
                {isTeacher ? "담당 강의" : "수강 중인 강의"}
              </SheetTitle>
              <SheetDescription className="text-left text-muted-foreground">
                {isTeacher
                  ? "강의를 선택하세요"
                  : "수강 중인 강의를 선택하세요"}
              </SheetDescription>
            </SheetHeader>
            {isTeacher && (
              <div className="border-b border-border/40 px-4 pb-4">
                <Button asChild className="w-full gap-2 shadow-sm">
                  <Link
                    href="/courses/create"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Plus className="size-4 shrink-0" />
                    강의 개설
                  </Link>
                </Button>
              </div>
            )}
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="flex flex-col gap-2 p-4">
                {isCoursesLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="text-sm">불러오는 중...</span>
                  </div>
                ) : coursesError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {coursesError}
                  </p>
                ) : courses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {isTeacher
                      ? "개설된 강의가 없습니다."
                      : "수강 중인 강의가 없습니다."}
                  </p>
                ) : (
                  courses.map((course) => {
                    const { days, time } = formatCourseSchedule(course);
                    const isSelected =
                      selectedCourse?.courseId === course.courseId;

                    return (
                      <button
                        key={course.courseId}
                        onClick={() => {
                          setSelectedCourse(course);
                          setIsMenuOpen(false);
                        }}
                        className={`group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                          isSelected
                            ? "border-primary/50 bg-primary/10 shadow-sm"
                            : "border-transparent bg-secondary/50 hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`font-semibold ${isSelected ? "text-primary" : "text-foreground group-hover:text-primary"}`}
                          >
                            {course.courseName}
                          </span>
                          {course.maxStudents != null && isTeacher && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                            >
                              정원 {course.maxStudents}명
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                            {course.semester}
                          </span>
                          <span>{days}</span>
                          <span className="text-muted-foreground/60">|</span>
                          <span>{time}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <Separator />
            <div className="bg-muted/30 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Settings className="size-4 text-primary" />
                <h4 className="font-semibold text-foreground">{"알림 설정"}</h4>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <Bell className="size-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{"퀴즈 알림"}</span>
                  </div>
                  <Switch
                    checked={notifications.quiz}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, quiz: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <Bell className="size-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{"자료 알림"}</span>
                  </div>
                  <Switch
                    checked={notifications.material}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        material: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <Bell className="size-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{"마감 알림"}</span>
                  </div>
                  <Switch
                    checked={notifications.deadline}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        deadline: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* 중앙: 로고 */}
        <div className="flex items-center">
          <div className="flex size-15 items-center justify-center">
            <img
              src="/logo.svg"
              alt="KIT FeedA"
              className="size-20 text-primary"
            />
          </div>
        </div>

        {/* 우측: 알림 + 프로필 */}
        <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/10" asChild>
          <Link href="/notifications">
            <Bell className="size-5 text-foreground" />
            <span className="sr-only">{"알림"}</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full hover:bg-primary/10"
            >
              <Avatar className="size-8 ring-2 ring-primary/20 ring-offset-2 ring-offset-background transition-all hover:ring-primary/40">
                <AvatarImage src="/placeholder-avatar.jpg" alt="프로필" />
                <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                  {user?.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">{"프로필 메뉴"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src="/placeholder-avatar.jpg" alt="프로필" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user?.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {user?.name || "사용자"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email || ""}
                  </span>
                  <Badge variant="outline" className="mt-1 w-fit text-xs">
                    {isTeacher ? "강사" : "학생"}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg p-3"
              onClick={() => setIsProfileModalOpen(true)}
            >
              <User className="mr-3 size-4 text-muted-foreground" />
              {"프로필 설정"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-lg p-3" asChild>
              <Link href="/notifications">
                <Bell className="mr-3 size-4 text-muted-foreground" />
                {"알림"}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-lg p-3" asChild>
              <Link href="/deadlines">
                <Calendar className="mr-3 size-4 text-muted-foreground" />
                {"마감일"}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-lg p-3" asChild>
              <Link href="/settings/reminders">
                <Settings className="mr-3 size-4 text-muted-foreground" />
                {"알림 설정"}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg p-3"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 size-4 text-muted-foreground" />
              {"로그아웃"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg p-3 text-destructive focus:text-destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-3 size-4" />
              {"회원 탈퇴"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      <EditProfileModal
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </header>
  );
}
