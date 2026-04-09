"use client";

import {
  Menu,
  Settings,
  LogOut,
  User,
  Bell,
  Trash2,
  GraduationCap,
  BookOpen,
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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

import logo from "@/assets/logo.svg";

const teacherCourses = [
  {
    id: 1,
    name: "데이터베이스 개론",
    semester: "2024-1",
    day: "월/수",
    time: "10:00-11:30",
    students: 45,
  },
  {
    id: 2,
    name: "운영체제",
    semester: "2024-1",
    day: "화/목",
    time: "13:00-14:30",
    students: 38,
  },
  {
    id: 3,
    name: "컴퓨터 네트워크",
    semester: "2024-1",
    day: "월/수",
    time: "14:00-15:30",
    students: 42,
  },
  {
    id: 4,
    name: "소프트웨어 공학",
    semester: "2024-1",
    day: "금",
    time: "10:00-13:00",
    students: 31,
  },
];

const studentCourses = [
  {
    id: 1,
    name: "데이터베이스 개론",
    semester: "2024-1",
    day: "월/수",
    time: "10:00-11:30",
    professor: "김교수",
  },
  {
    id: 2,
    name: "운영체제",
    semester: "2024-1",
    day: "화/목",
    time: "13:00-14:30",
    professor: "박교수",
  },
  {
    id: 3,
    name: "컴퓨터 네트워크",
    semester: "2024-1",
    day: "월/수",
    time: "14:00-15:30",
    professor: "이교수",
  },
  {
    id: 4,
    name: "소프트웨어 공학",
    semester: "2024-1",
    day: "금",
    time: "10:00-13:00",
    professor: "최교수",
  },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    quiz: true,
    material: true,
    deadline: true,
  });
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const courses = user?.role === "teacher" ? teacherCourses : studentCourses;
  const isTeacher = user?.role === "teacher";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
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
          <SheetContent side="left" className="w-[300px] p-0 sm:w-[340px]">
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
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="flex flex-col gap-2 p-4">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    className="group flex flex-col gap-2 rounded-xl border border-transparent bg-secondary/50 p-4 text-left transition-all hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-foreground group-hover:text-primary">
                        {course.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {isTeacher && "students" in course
                          ? `${course.students}명`
                          : "professor" in course
                            ? course.professor
                            : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {course.semester}
                      </span>
                      <span>{course.day}</span>
                      <span className="text-muted-foreground/60">|</span>
                      <span>{course.time}</span>
                    </div>
                  </button>
                ))}
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

        {/* 우측: 프로필 */}
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
            <DropdownMenuItem className="cursor-pointer rounded-lg p-3">
              <User className="mr-3 size-4 text-muted-foreground" />
              {"프로필 설정"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-lg p-3">
              <Settings className="mr-3 size-4 text-muted-foreground" />
              {"계정 설정"}
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
              variant="destructive"
              className="cursor-pointer rounded-lg p-3"
            >
              <Trash2 className="mr-3 size-4" />
              {"회원 탈퇴"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
