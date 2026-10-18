"use client";

import { useEffect, useRef, useMemo } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import { PipelineStage, AnalysisStatus } from "../pipeline/types";

let cachedBrowserClient: SupabaseClient | null = null;
let currentTokenRef: string | null = null;

export function getBrowserSupabase(token?: string | null): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  if (!cachedBrowserClient || currentTokenRef !== token) {
    currentTokenRef = token ?? null;
    cachedBrowserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    if (token) {
      cachedBrowserClient.realtime.setAuth(token);
    }
  }

  return cachedBrowserClient;
}

export interface AnalysisStageBroadcast {
  analysis_id: string;
  status: AnalysisStatus;
  stage: PipelineStage | null;
  message: string;
}

interface UseAnalysisRealtimeOptions {
  analysisId: string;
  onUpdate?: (payload: AnalysisStageBroadcast) => void;
  enabled?: boolean;
}

/**
 * React hook that subscribes to an analysis's private Realtime broadcast channel ('analysis:<id>').
 * Uses Clerk JWT authentication to comply with RLS policies on realtime.messages.
 */
export function useAnalysisRealtime({
  analysisId,
  onUpdate,
  enabled = true,
}: UseAnalysisRealtimeOptions) {
  const { getToken } = useAuth();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !analysisId) return;

    let isMounted = true;
    let channel: ReturnType<SupabaseClient["channel"]> | null = null;

    async function initSubscription() {
      try {
        const token = await getToken();
        if (!isMounted) return;

        const supabase = getBrowserSupabase(token);

        if (token) {
          await supabase.realtime.setAuth(token);
        }

        channel = supabase.channel(`analysis:${analysisId}`, {
          config: {
            private: true,
          },
        });

        channel
          .on("broadcast", { event: "stage_change" }, ({ payload }) => {
            if (isMounted && onUpdateRef.current) {
              onUpdateRef.current(payload as AnalysisStageBroadcast);
            }
          })
          .subscribe((status, error) => {
            if (status === "SUBSCRIBED") {
              // Successfully connected to analysis channel
            } else if (status === "CHANNEL_ERROR") {
              console.warn(
                `[Realtime] Channel subscription warning for analysis:${analysisId}:`,
                error
              );
            }
          });
      } catch (err) {
        console.warn("[Realtime] Initialization failed:", err);
      }
    }

    initSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [analysisId, enabled, getToken]);
}
