-- Seed Data for Phase 2 Acceptance Testing

-- Seed Organizations
INSERT INTO public.organizations (id, name) VALUES
  ('org_demo_alpha', 'Alpha Team'),
  ('org_demo_beta', 'Beta Corp')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed Projects
INSERT INTO public.projects (id, organization_id, name, repo_url) VALUES
  ('00000000-0000-0000-0000-000000000001', 'org_demo_alpha', 'Cartograph Core', 'https://github.com/facebook/react'),
  ('00000000-0000-0000-0000-000000000002', 'org_demo_beta', 'Beta Microservices', 'https://github.com/expressjs/express')
ON CONFLICT (id) DO NOTHING;

-- Seed Analyses
INSERT INTO public.analyses (id, organization_id, project_id, repo_url, status, commit_hash, file_count, edge_count, error_message, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'org_demo_alpha', '00000000-0000-0000-0000-000000000001', 'https://github.com/facebook/react', 'completed', '7a8b9c0', 142, 389, NULL, NOW() - INTERVAL '2 hours'),
  ('11111111-1111-1111-1111-111111111112', 'org_demo_alpha', '00000000-0000-0000-0000-000000000001', 'https://github.com/vercel/next.js', 'parsing', '3f2e1d0', 85, 210, NULL, NOW() - INTERVAL '30 minutes'),
  ('22222222-2222-2222-2222-222222222221', 'org_demo_beta', '00000000-0000-0000-0000-000000000002', 'https://github.com/expressjs/express', 'completed', '9e8d7c6', 64, 152, NULL, NOW() - INTERVAL '1 day'),
  ('22222222-2222-2222-2222-222222222222', 'org_demo_beta', '00000000-0000-0000-0000-000000000002', 'https://github.com/trpc/trpc', 'failed', '1a2b3c4', 0, 0, 'Failed to resolve path alias @trpc/server/adapters', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Files
INSERT INTO public.files (id, organization_id, analysis_id, path, extension, size_bytes, fan_in, fan_out) VALUES
  ('33333333-3333-3333-3333-333333333331', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', 'packages/react/src/React.js', '.js', 4520, 12, 5),
  ('44444444-4444-4444-4444-444444444441', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', 'lib/express.js', '.js', 2180, 8, 3)
ON CONFLICT (id) DO NOTHING;

-- Seed Edges
INSERT INTO public.edges (id, organization_id, analysis_id, source_file_id, target_file_id, source_path, target_path, import_type) VALUES
  ('55555555-5555-5555-5555-555555555551', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', NULL, 'packages/react/src/React.js', 'packages/react/src/ReactElement.js', 'static'),
  ('66666666-6666-6666-6666-666666666661', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', '44444444-4444-4444-4444-444444444441', NULL, 'lib/express.js', 'lib/application.js', 'static')
ON CONFLICT (id) DO NOTHING;

-- Seed Routes
INSERT INTO public.routes (id, organization_id, analysis_id, file_id, path_pattern, method, framework) VALUES
  ('77777777-7777-7777-7777-777777777771', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', '/api/render', 'POST', 'Next.js'),
  ('88888888-8888-8888-8888-888888888881', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', '44444444-4444-4444-4444-444444444441', '/app/listen', 'GET', 'Express')
ON CONFLICT (id) DO NOTHING;

-- Seed Explanations
INSERT INTO public.explanations (id, organization_id, analysis_id, file_id, explanation_text, prompt_hash) VALUES
  ('99999999-9999-9999-9999-999999999991', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Core React entry point exporting top-level elements and hooks.', 'hash_alpha_1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', '44444444-4444-4444-4444-444444444441', 'Express application factory creating request router instance.', 'hash_beta_1')
ON CONFLICT (id) DO NOTHING;

-- Seed File Roles
INSERT INTO public.file_roles (id, organization_id, analysis_id, file_id, role_name, confidence) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Entrypoint', 0.98),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', '44444444-4444-4444-4444-444444444441', 'Server', 0.95)
ON CONFLICT (id) DO NOTHING;

-- Seed Insights
INSERT INTO public.insights (id, organization_id, analysis_id, insight_type, content) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'org_demo_alpha', '11111111-1111-1111-1111-111111111111', 'architecture', 'High fan-in detected on ReactElement module.'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'org_demo_beta', '22222222-2222-2222-2222-222222222221', 'warning', 'Circular dependency risk in router dispatchers.')
ON CONFLICT (id) DO NOTHING;
