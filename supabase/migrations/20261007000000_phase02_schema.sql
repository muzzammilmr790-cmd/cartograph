-- Phase 2 Migration: Initial Schema & Row-Level Security Policies

-- 1. Parent Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  repo_url text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Analyses Table
CREATE TABLE IF NOT EXISTS public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  commit_hash text,
  file_count integer DEFAULT 0 NOT NULL,
  edge_count integer DEFAULT 0 NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Files Table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  path text NOT NULL,
  extension text,
  size_bytes integer,
  fan_in integer DEFAULT 0 NOT NULL,
  fan_out integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Edges Table
CREATE TABLE IF NOT EXISTS public.edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  source_file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  target_file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  source_path text NOT NULL,
  target_path text NOT NULL,
  import_type text DEFAULT 'static' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 6. Routes Table
CREATE TABLE IF NOT EXISTS public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  path_pattern text NOT NULL,
  method text,
  framework text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 7. Explanations Table
CREATE TABLE IF NOT EXISTS public.explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  explanation_text text NOT NULL,
  prompt_hash text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 8. File Roles Table
CREATE TABLE IF NOT EXISTS public.file_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  confidence double precision,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 9. Insights Table
CREATE TABLE IF NOT EXISTS public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_analyses_org ON public.analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(organization_id);
CREATE INDEX IF NOT EXISTS idx_files_analysis ON public.files(analysis_id);
CREATE INDEX IF NOT EXISTS idx_edges_org ON public.edges(organization_id);
CREATE INDEX IF NOT EXISTS idx_edges_analysis ON public.edges(analysis_id);
CREATE INDEX IF NOT EXISTS idx_routes_org ON public.routes(organization_id);
CREATE INDEX IF NOT EXISTS idx_explanations_org ON public.explanations(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_roles_org ON public.file_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_insights_org ON public.insights(organization_id);

-- Enable Row-Level Security on all 9 tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Helper function to read active organization ID from Clerk JWT claims (supports org_id and o ->> id)
CREATE OR REPLACE FUNCTION public.requesting_org_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id'), '')::text;
$$;

-- Policies for Organizations
CREATE POLICY "org_select_policy" ON public.organizations FOR SELECT TO authenticated USING (id = public.requesting_org_id());
CREATE POLICY "org_insert_policy" ON public.organizations FOR INSERT TO authenticated WITH CHECK (id = public.requesting_org_id());
CREATE POLICY "org_update_policy" ON public.organizations FOR UPDATE TO authenticated USING (id = public.requesting_org_id()) WITH CHECK (id = public.requesting_org_id());
CREATE POLICY "org_delete_policy" ON public.organizations FOR DELETE TO authenticated USING (id = public.requesting_org_id());

-- Policies for Projects
CREATE POLICY "projects_select_policy" ON public.projects FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "projects_insert_policy" ON public.projects FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "projects_update_policy" ON public.projects FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "projects_delete_policy" ON public.projects FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Analyses
CREATE POLICY "analyses_select_policy" ON public.analyses FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "analyses_insert_policy" ON public.analyses FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "analyses_update_policy" ON public.analyses FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "analyses_delete_policy" ON public.analyses FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Files
CREATE POLICY "files_select_policy" ON public.files FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "files_insert_policy" ON public.files FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "files_update_policy" ON public.files FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "files_delete_policy" ON public.files FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Edges
CREATE POLICY "edges_select_policy" ON public.edges FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "edges_insert_policy" ON public.edges FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "edges_update_policy" ON public.edges FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "edges_delete_policy" ON public.edges FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Routes
CREATE POLICY "routes_select_policy" ON public.routes FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "routes_insert_policy" ON public.routes FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "routes_update_policy" ON public.routes FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "routes_delete_policy" ON public.routes FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Explanations
CREATE POLICY "explanations_select_policy" ON public.explanations FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "explanations_insert_policy" ON public.explanations FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "explanations_update_policy" ON public.explanations FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "explanations_delete_policy" ON public.explanations FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for File Roles
CREATE POLICY "file_roles_select_policy" ON public.file_roles FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "file_roles_insert_policy" ON public.file_roles FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "file_roles_update_policy" ON public.file_roles FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "file_roles_delete_policy" ON public.file_roles FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());

-- Policies for Insights
CREATE POLICY "insights_select_policy" ON public.insights FOR SELECT TO authenticated USING (organization_id = public.requesting_org_id());
CREATE POLICY "insights_insert_policy" ON public.insights FOR INSERT TO authenticated WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "insights_update_policy" ON public.insights FOR UPDATE TO authenticated USING (organization_id = public.requesting_org_id()) WITH CHECK (organization_id = public.requesting_org_id());
CREATE POLICY "insights_delete_policy" ON public.insights FOR DELETE TO authenticated USING (organization_id = public.requesting_org_id());
