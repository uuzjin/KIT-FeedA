"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { TeacherMaterials } from "@/components/materials/teacher-materials";
import { StudentMaterials } from "@/components/materials/student-materials";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@/components/ui/spinner";

export default function MaterialsPage() {
  const { user, isLoading, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, isHydrated, router]);

  // Don't render until hydrated to prevent mismatch
  if (!isHydrated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">{"로딩 중..."}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      {user.role === "INSTRUCTOR" ? <TeacherMaterials /> : <StudentMaterials />}
    </AppShell>
  );
}
