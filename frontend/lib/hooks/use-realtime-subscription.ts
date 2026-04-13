"use client";

/**
 * Supabase Realtime 채널 구독 훅.
 *
 * 사용 예:
 *   useRealtimeSubscription({
 *     table: "scripts",
 *     filter: `course_id=eq.${courseId}`,
 *     event: "UPDATE",
 *     onUpdate: (payload) => { ... },
 *     enabled: !!courseId,
 *   });
 */

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export interface RealtimeSubscriptionOptions {
  /** Supabase public 테이블명 */
  table: string;
  /** PostgREST 필터 문자열 (e.g. "course_id=eq.abc") — 없으면 전체 테이블 구독 */
  filter?: string;
  /** 구독할 이벤트 종류 (기본: UPDATE) */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  /** 변경 감지 시 호출될 콜백 */
  onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void;
  /** false이면 구독하지 않음 (조건부 구독에 사용) */
  enabled?: boolean;
}

export function useRealtimeSubscription({
  table,
  filter,
  event = "UPDATE",
  onUpdate,
  enabled = true,
}: RealtimeSubscriptionOptions) {
  // onUpdate가 매 렌더에 새 참조를 만들어도 재구독이 일어나지 않도록 ref로 래핑
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    const channelName = filter
      ? `rt:${table}:${filter}`
      : `rt:${table}`;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          onUpdateRef.current(payload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  // filter와 table이 바뀌면 재구독, onUpdate 변경에는 재구독하지 않음
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, event, enabled]);
}
