-- ============================================================================
-- Serverboard: Supabase Schema for Users and Render Managed Projects
-- ============================================================================

-- 1. Users Profile Table (links to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT NOT NULL,
    project_limit INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- 2. Projects Table (Render instances orchestrated via Inngest)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    render_id TEXT,
    render_url TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'creating' | 'deploying' | 'active' | 'failed' | 'deleting' | 'deleted'
    agent_limit INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_render_id ON public.projects(render_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- 3. Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile and service role full access
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Allow users to read/manage their own projects
CREATE POLICY "Users can read own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

-- Note: When backend uses SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY, service_role bypasses RLS automatically.
-- If using anon key during development, allow authenticated users full access to their rows:
CREATE POLICY "Allow service role full access to users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to projects" ON public.projects
    FOR ALL USING (auth.role() = 'service_role');

-- 4. Enable Supabase Realtime broadcast for live project updates in user dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
