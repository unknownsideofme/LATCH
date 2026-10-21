-- Latch Supabase schema: distributed locks and realtime sync.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.relay_locks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL DEFAULT '',
    ownership_token UUID NOT NULL DEFAULT gen_random_uuid(),
    fencing_token BIGINT NOT NULL DEFAULT 1,
    mode TEXT NOT NULL DEFAULT 'write',
    holder JSONB NOT NULL DEFAULT '{}'::jsonb,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_renewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ttl_ms INTEGER NOT NULL DEFAULT 15000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relay_locks ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.relay_locks ADD COLUMN IF NOT EXISTS ownership_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.relay_locks ADD COLUMN IF NOT EXISTS fencing_token BIGINT NOT NULL DEFAULT 1;
ALTER TABLE public.relay_locks ADD COLUMN IF NOT EXISTS last_renewed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.relay_locks ALTER COLUMN ownership_token SET NOT NULL;
ALTER TABLE public.relay_locks ALTER COLUMN last_renewed_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relay_locks_workspace ON public.relay_locks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_relay_locks_expires ON public.relay_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_relay_locks_fencing ON public.relay_locks(workspace_id, file_path, fencing_token);

CREATE TABLE IF NOT EXISTS public.relay_lock_fences (
    id TEXT PRIMARY KEY,
    fencing_token BIGINT NOT NULL
);

INSERT INTO public.relay_lock_fences (id, fencing_token)
SELECT id, fencing_token FROM public.relay_locks
WHERE true
ON CONFLICT (id) DO UPDATE
SET fencing_token = GREATEST(public.relay_lock_fences.fencing_token, EXCLUDED.fencing_token);

CREATE TABLE IF NOT EXISTS public.latch_patches (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    agent TEXT NOT NULL,
    owner_login TEXT NOT NULL,
    diff TEXT,
    sha256 TEXT,
    lamport BIGINT NOT NULL DEFAULT 0,
    is_binary BOOLEAN NOT NULL DEFAULT false,
    origin_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_latch_patches_workspace ON public.latch_patches(workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.latch_claim_lock(
    p_workspace_id TEXT,
    p_file_path TEXT,
    p_agent_id TEXT,
    p_session_id TEXT DEFAULT '',
    p_ownership_token UUID DEFAULT NULL,
    p_fencing_token BIGINT DEFAULT NULL,
    p_mode TEXT DEFAULT 'write',
    p_ttl_ms INTEGER DEFAULT 15000,
    p_holder JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_id TEXT := lower(trim(p_workspace_id)) || '::' || lower(trim(p_file_path));
    v_now TIMESTAMPTZ := now();
    v_ttl_ms INTEGER := LEAST(300000, GREATEST(5000, COALESCE(p_ttl_ms, 15000)));
    v_expires_at TIMESTAMPTZ := v_now + (LEAST(300000, GREATEST(5000, COALESCE(p_ttl_ms, 15000))) || ' milliseconds')::interval;
    v_existing public.relay_locks%ROWTYPE;
    v_token UUID;
    v_fence BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_id, 0));
    SELECT * INTO v_existing FROM public.relay_locks WHERE id = v_lock_id FOR UPDATE;

    IF FOUND AND v_existing.expires_at > v_now THEN
        IF v_existing.agent_id = p_agent_id
           AND v_existing.session_id = p_session_id
           AND p_ownership_token IS NOT NULL
           AND v_existing.ownership_token = p_ownership_token
           AND (p_fencing_token IS NULL OR v_existing.fencing_token = p_fencing_token) THEN
            UPDATE public.relay_locks
           SET expires_at = v_expires_at, last_renewed_at = v_now, ttl_ms = v_ttl_ms, holder = p_holder
            WHERE id = v_lock_id;
            RETURN jsonb_build_object('allowed', true, 'renewed', true, 'file', p_file_path,
                'agentId', p_agent_id, 'sessionId', p_session_id,
                'ownershipToken', v_existing.ownership_token, 'fencingToken', v_existing.fencing_token,
                'expiresAt', v_expires_at, 'ttlMs', v_ttl_ms);
        END IF;
        RETURN jsonb_build_object('allowed', false, 'status', 'DENIED', 'code', 'FILE_LOCKED',
            'file', p_file_path, 'canonicalPath', p_file_path,
            'owner', jsonb_build_object('agentId', v_existing.agent_id, 'sessionId', v_existing.session_id),
            'agentId', p_agent_id, 'holder', v_existing.holder, 'heldBy', v_existing.agent_id,
            'expiresInMs', GREATEST(0, (EXTRACT(EPOCH FROM (v_existing.expires_at - v_now)) * 1000)::BIGINT),
            'fencingToken', v_existing.fencing_token, 'expiresAt', v_existing.expires_at,
            'retryable', true, 'reason', 'held_by_other',
            'message', 'FILE_LOCKED: ' || p_file_path || ' is locked by ' || v_existing.agent_id || '.');
    END IF;

    SELECT fencing_token INTO v_fence
    FROM public.relay_lock_fences
    WHERE id = v_lock_id
    FOR UPDATE;
    IF FOUND THEN
        v_fence := GREATEST(v_fence, COALESCE(v_existing.fencing_token, 0)) + 1;
        UPDATE public.relay_lock_fences SET fencing_token = v_fence WHERE id = v_lock_id;
    ELSE
        v_fence := COALESCE(v_existing.fencing_token, 0) + 1;
        INSERT INTO public.relay_lock_fences (id, fencing_token) VALUES (v_lock_id, v_fence);
    END IF;
    v_token := gen_random_uuid();
    INSERT INTO public.relay_locks (
        id, workspace_id, file_path, agent_id, session_id, ownership_token, fencing_token,
        mode, holder, claimed_at, last_renewed_at, expires_at, ttl_ms
    ) VALUES (
        v_lock_id, p_workspace_id, p_file_path, p_agent_id, p_session_id, v_token, v_fence,
        p_mode, p_holder, v_now, v_now, v_expires_at, v_ttl_ms
    )
    ON CONFLICT (id) DO UPDATE SET
        agent_id = EXCLUDED.agent_id, session_id = EXCLUDED.session_id,
        ownership_token = EXCLUDED.ownership_token, fencing_token = EXCLUDED.fencing_token,
        mode = EXCLUDED.mode, holder = EXCLUDED.holder, claimed_at = EXCLUDED.claimed_at,
        last_renewed_at = EXCLUDED.last_renewed_at, expires_at = EXCLUDED.expires_at, ttl_ms = EXCLUDED.ttl_ms;

    RETURN jsonb_build_object('allowed', true, 'file', p_file_path, 'agentId', p_agent_id,
        'sessionId', p_session_id, 'ownershipToken', v_token, 'fencingToken', v_fence,
        'holder', p_holder, 'expiresAt', v_expires_at, 'ttlMs', v_ttl_ms);
END;
$$;

CREATE OR REPLACE FUNCTION public.latch_heartbeat_lock(
    p_workspace_id TEXT, p_file_path TEXT, p_agent_id TEXT, p_session_id TEXT,
    p_ownership_token UUID, p_fencing_token BIGINT, p_ttl_ms INTEGER DEFAULT 15000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_ttl_ms INTEGER := LEAST(300000, GREATEST(5000, COALESCE(p_ttl_ms, 15000)));
    v_expires_at TIMESTAMPTZ := v_now + (LEAST(300000, GREATEST(5000, COALESCE(p_ttl_ms, 15000))) || ' milliseconds')::interval;
    v_updated INTEGER;
BEGIN
    UPDATE public.relay_locks
    SET expires_at = v_expires_at, last_renewed_at = v_now, ttl_ms = v_ttl_ms
    WHERE id = lower(trim(p_workspace_id)) || '::' || lower(trim(p_file_path))
      AND agent_id = p_agent_id AND session_id = p_session_id
      AND ownership_token = p_ownership_token AND fencing_token = p_fencing_token
      AND expires_at > v_now;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('ok', v_updated > 0, 'renewed', v_updated > 0, 'expiresAt', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.latch_release_lock(
    p_workspace_id TEXT, p_file_path TEXT, p_agent_id TEXT,
    p_session_id TEXT, p_ownership_token UUID, p_fencing_token BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_deleted INTEGER;
BEGIN
    DELETE FROM public.relay_locks
    WHERE id = lower(trim(p_workspace_id)) || '::' || lower(trim(p_file_path))
      AND agent_id = p_agent_id AND session_id = p_session_id
      AND ownership_token = p_ownership_token AND fencing_token = p_fencing_token;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'released', v_deleted > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.latch_release_all_locks(p_agent_id TEXT, p_session_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Agent/session identity alone cannot authorize releasing active leases.
    RETURN jsonb_build_object('ok', false, 'released', 0, 'reason', 'lease_credentials_required');
END;
$$;

CREATE OR REPLACE FUNCTION public.relay_claim_lock(
    p_workspace_id TEXT, p_file_path TEXT, p_agent_id TEXT, p_session_id TEXT DEFAULT '',
    p_ownership_token UUID DEFAULT NULL, p_fencing_token BIGINT DEFAULT NULL,
    p_mode TEXT DEFAULT 'write', p_ttl_ms INTEGER DEFAULT 15000, p_holder JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.latch_claim_lock(p_workspace_id, p_file_path, p_agent_id, p_session_id,
        p_ownership_token, p_fencing_token, p_mode, p_ttl_ms, p_holder);
$$;

CREATE OR REPLACE FUNCTION public.relay_heartbeat_lock(
    p_workspace_id TEXT, p_file_path TEXT, p_agent_id TEXT, p_session_id TEXT,
    p_ownership_token UUID, p_fencing_token BIGINT, p_ttl_ms INTEGER DEFAULT 15000
)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.latch_heartbeat_lock(p_workspace_id, p_file_path, p_agent_id, p_session_id,
        p_ownership_token, p_fencing_token, p_ttl_ms);
$$;

CREATE OR REPLACE FUNCTION public.relay_release_lock(
    p_workspace_id TEXT, p_file_path TEXT, p_agent_id TEXT, p_session_id TEXT,
    p_ownership_token UUID, p_fencing_token BIGINT
)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.latch_release_lock(p_workspace_id, p_file_path, p_agent_id, p_session_id,
        p_ownership_token, p_fencing_token);
$$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'relay_locks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relay_locks;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime'
          AND n.nspname = 'public'
          AND c.relname = 'latch_patches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.latch_patches;
    END IF;
END
$$;
-- ============================================================================
-- LATCH BILLING & PAYPAL SUBSCRIPTIONS
-- ============================================================================

-- 1. Dedicated Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID,
    paypal_subscription_id TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'APPROVAL_PENDING',
        'APPROVED',
        'ACTIVE',
        'SUSPENDED',
        'CANCELLED',
        'EXPIRED'
    )),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN (
        'unpaid',
        'pending',
        'paid',
        'failed'
    )),
    seats INTEGER NOT NULL DEFAULT 1 CHECK (seats >= 1),
    payer_email TEXT,
    paypal_payer_id TEXT,
    start_time TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    grace_period_until TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON public.subscriptions(status, current_period_end);

-- 2. Transactional Webhook Audit & Idempotency Table
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    summary TEXT,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
        'received',
        'processing',
        'processed',
        'failed'
    )),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_events_event_id ON public.billing_events(event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_resource ON public.billing_events(resource_id);

-- 3. Entitlement Tracking on Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    username TEXT,
    project_limit INTEGER NOT NULL DEFAULT 3,
    plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro')),
    active_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    seats_allocated INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seats_allocated INTEGER NOT NULL DEFAULT 1;

-- 4. Atomic Subscription Expiry & User Downgrade RPC Function
CREATE OR REPLACE FUNCTION public.reconcile_expired_subscriptions()
RETURNS TABLE (
    subscription_id UUID,
    user_id UUID,
    organization_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH expired_candidates AS (
        SELECT s.id, s.user_id, s.organization_id
        FROM public.subscriptions s
        WHERE s.status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')
          AND COALESCE(s.grace_period_until, s.current_period_end) < now()
        FOR UPDATE SKIP LOCKED
    ),
    updated_subs AS (
        UPDATE public.subscriptions s
        SET status = 'EXPIRED', updated_at = now()
        FROM expired_candidates c
        WHERE s.id = c.id
        RETURNING s.id, s.user_id, s.organization_id
    ),
    downgraded_users AS (
        UPDATE public.users u
        SET plan_tier = 'free',
            project_limit = 3,
            seats_allocated = 1,
            active_subscription_id = NULL
        FROM updated_subs us
        WHERE u.id = us.user_id
          AND NOT EXISTS (
              SELECT 1 FROM public.subscriptions other
              WHERE other.user_id = u.id
                AND other.id != us.id
                AND other.status = 'ACTIVE'
                AND other.current_period_end > now()
          )
        RETURNING u.id
    )
    SELECT us.id AS subscription_id, us.user_id, us.organization_id
    FROM updated_subs us;
END;
$$;
