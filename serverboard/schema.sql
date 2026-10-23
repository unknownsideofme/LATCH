-- ============================================================================
-- Serverboard: Supabase Schema for Users and Render Managed Projects
-- ============================================================================

-- 1. Users Profile Table (links to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT NOT NULL,
    project_limit INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- 2. Projects Table (Render instances orchestrated via Inngest)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    repo_url TEXT,
    branch TEXT NOT NULL DEFAULT 'main',
    render_id TEXT,
    render_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'deploying' | 'running' | 'failed' | 'deleting'
    agent_limit INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_render_id ON public.projects(render_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- 3. Row Level Security (RLS) policies (idempotent re-runnable)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile and service role full access
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Allow users to read/manage their own projects
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
CREATE POLICY "Users can read own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

-- Note: When backend uses SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY, service_role bypasses RLS automatically.
DROP POLICY IF EXISTS "Allow service role full access to users" ON public.users;
CREATE POLICY "Allow service role full access to users" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access to projects" ON public.projects;
CREATE POLICY "Allow service role full access to projects" ON public.projects
    FOR ALL USING (auth.role() = 'service_role');

-- 4. Enable Supabase Realtime broadcast for live project updates in user dashboard (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  END IF;
END $$;


-- ============================================================================
-- 5. PayPal One-Time Orders & Entitlement Tracking
-- ============================================================================

-- A. One-Time Orders / Purchases Ledger
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    paypal_order_id TEXT UNIQUE NOT NULL,
    paypal_capture_id TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    seats INTEGER NOT NULL DEFAULT 1 CHECK (seats >= 1),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('CREATED', 'COMPLETED', 'FAILED', 'REFUNDED')),
    payer_email TEXT,
    paypal_payer_id TEXT,
    period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_period_end ON public.orders(period_end);

-- B. Idempotency & Webhook Audit Ledger
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    summary TEXT,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_events_event_id ON public.billing_events(event_id);

-- C. User Entitlement Columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seats_allocated INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Ensure default project limit (2) and agent limit (7) apply cleanly to existing schemas
ALTER TABLE public.users ALTER COLUMN project_limit SET DEFAULT 2;
ALTER TABLE public.projects ALTER COLUMN agent_limit SET DEFAULT 7;

-- D. RLS for Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
CREATE POLICY "Users can read own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow service role full access to orders" ON public.orders;
CREATE POLICY "Allow service role full access to orders" ON public.orders
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access to billing_events" ON public.billing_events;
CREATE POLICY "Allow service role full access to billing_events" ON public.billing_events
    FOR ALL USING (auth.role() = 'service_role');

-- E. Entitlement Check & Auto-Downgrade RPC Function
CREATE OR REPLACE FUNCTION public.check_user_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user public.users%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('planTier', 'free', 'projectLimit', 2, 'expired', false);
    END IF;

    -- If Pro 30-day period expired, automatically reset to free
    IF v_user.plan_tier = 'pro' AND (v_user.current_period_end IS NULL OR v_user.current_period_end < now()) THEN
        UPDATE public.users 
        SET plan_tier = 'free', project_limit = 2, seats_allocated = 1 
        WHERE id = p_user_id;
        RETURN jsonb_build_object('planTier', 'free', 'projectLimit', 2, 'expired', true);
    END IF;

    RETURN jsonb_build_object(
        'planTier', v_user.plan_tier, 
        'projectLimit', v_user.project_limit, 
        'seats', v_user.seats_allocated,
        'currentPeriodEnd', v_user.current_period_end,
        'expired', false
    );
END;
$$;
