-- Phase 7 Migration: Pipeline Stage Tracking, Realtime Channels & Policies

-- 1. Extend analyses table with pipeline stages, live messages and coverage report
ALTER TABLE public.analyses 
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS stage_message text,
  ADD COLUMN IF NOT EXISTS coverage jsonb;

-- 2. Enforce one analysis per repository per organization
-- Submitting a URL that has already been analysed takes you to the existing analysis.
CREATE UNIQUE INDEX IF NOT EXISTS idx_analyses_org_repo 
  ON public.analyses(organization_id, repo_url);

-- 3. Database Trigger: Broadcast stage and message updates via Supabase Realtime
-- Live progress is driven from the database, not browser polling.
-- Triggers on our table, publishes stage and message (not the whole row).
CREATE OR REPLACE FUNCTION public.notify_analysis_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (
    TG_OP = 'INSERT' OR
    NEW.stage IS DISTINCT FROM OLD.stage OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.stage_message IS DISTINCT FROM OLD.stage_message
  ) THEN
    BEGIN
      PERFORM realtime.send(
        json_build_object(
          'analysis_id', NEW.id,
          'status', NEW.status,
          'stage', NEW.stage,
          'message', NEW.stage_message
        )::jsonb,
        'stage_change',
        'analysis:' || NEW.id::text,
        true
      );
    EXCEPTION WHEN OTHERS THEN
      -- Gracefully handle cases where realtime schema or partition is not yet mounted
      RAISE NOTICE 'Realtime broadcast skipped or failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_analysis_stage_change ON public.analyses;
CREATE TRIGGER tr_analysis_stage_change
AFTER UPDATE OR INSERT ON public.analyses
FOR EACH ROW
EXECUTE FUNCTION public.notify_analysis_stage_change();

-- 4. Realtime Channel Subscription Policy
-- Who may subscribe is also a policy: another organization's analysis channel is not subscribable.
-- The pattern for per-analysis channels ('analysis:<uuid>') is secured via RLS on realtime.messages.
-- Note: realtime.messages is owned by supabase_realtime_admin and RLS is already enabled by default.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'realtime' AND table_name = 'messages') THEN
    DROP POLICY IF EXISTS "analysis_channel_subscribe_policy" ON realtime.messages;
    CREATE POLICY "analysis_channel_subscribe_policy"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.analyses
        WHERE analyses.id::text = split_part(realtime.topic(), ':', 2)
          AND analyses.organization_id = (SELECT auth.jwt() ->> 'org_id')
      )
    );
  END IF;
END $$;
