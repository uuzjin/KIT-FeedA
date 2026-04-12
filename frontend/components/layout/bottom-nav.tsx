"use client";

import { HelpCircle, Bell, LayoutDashboard, Upload, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const teacherNavItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "강의",
  },
  {
    href: "/materials",
    icon: Upload,
    label: "강의 자료",
  },
  {
    href: "/quiz",
    icon: HelpCircle,
    label: "퀴즈 관리",
  },
  {
    href: "/announcements",
    icon: Bell,
    label: "공지사항",
  },
];

const studentNavItems = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "대시보드",
  },
  {
    href: "/materials",
    icon: BookOpen,
    label: "학습 자료",
  },
  {
    href: "/quiz",
    icon: HelpCircle,
    label: "퀴즈",
  },
  {
    href: "/announcements",
    icon: Bell,
    label: "공지사항",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = user?.role === "INSTRUCTOR" ? teacherNavItems : studentNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/dashboard" && pathname.startsWith("/courses"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {isActive && (
                <span className="absolute inset-x-3 -top-0.5 h-0.5 rounded-full bg-primary" />
              )}
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl transition-all duration-200",
                  isActive ? "bg-primary/10" : "hover:bg-muted"
                )}
              >
                <item.icon
                  className={cn(
                    "size-5 transition-all duration-200",
                    isActive && "scale-110"
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-all duration-200",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
