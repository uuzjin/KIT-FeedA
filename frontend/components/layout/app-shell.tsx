"use client";

import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
