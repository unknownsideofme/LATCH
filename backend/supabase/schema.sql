-- ============================================================================
-- Latch: Supabase Schema for Distributed Locks and Realtime Sync
-- ============================================================================

-- 1. Distributed Locks Table
CREATE TABLE IF NOT EXISTS public.latch_locks (
    id TEXT PRIMARY KEY, -- format: <workspace_id>::<file_path>
    workspace_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'write', -- 'write' or 'read'
    holder JSONB DEFAULT '{}'::jsonb, -- { label, login, host }
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ttl_ms INTEGER NOT NULL DEFAULT 15000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_latch_locks_workspace ON public.latch_locks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_latch_locks_expires ON public.latch_locks(expires_at);

-- 2. Live Patches Table
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

-- 3. Atomic Stored Procedure: Claim Lock
CREATE OR REPLACE FUNCTION public.latch_claim_lock(
    p_workspace_id TEXT,
    p_file_path TEXT,
    p_agent_id TEXT,
    p_mode TEXT DEFAULT 'write',
    p_ttl_ms INTEGER DEFAULT 15000,
    p_holder JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_id TEXT;
    v_now TIMESTAMPTZ := now();
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_ms || ' milliseconds')::interval;
    v_existing public.latch_locks%ROWTYPE;
BEGIN
    v_lock_id := lower(trim(p_workspace_id)) || '::' || lower(trim(p_file_path));

    -- Lock the row if it exists
    SELECT * INTO v_existing FROM public.latch_locks WHERE id = v_lock_id FOR UPDATE;

    IF FOUND THEN
        -- Case A: Lock has expired -> take over
        IF v_existing.expires_at <= v_now THEN
            UPDATE public.latch_locks
            SET agent_id = p_agent_id,
                mode = p_mode,
                holder = p_holder,
                claimed_at = v_now,
                expires_at = v_expires_at,
                ttl_ms = p_ttl_ms
            WHERE id = v_lock_id;

            RETURN jsonb_build_object(
                'allowed', true,
                'file', p_file_path,
                'agentId', p_agent_id,
                'holder', p_holder,
                'expiresAt', v_expires_at,
                'ttlMs', p_ttl_ms,
                'overwritten', true
            );
        END IF;

        -- Case B: Same owner -> renew
        IF v_existing.agent_id = p_agent_id THEN
            UPDATE public.latch_locks
            SET expires_at = v_expires_at,
                ttl_ms = p_ttl_ms,
                holder = p_holder
            WHERE id = v_lock_id;

            RETURN jsonb_build_object(
                'allowed', true,
                'file', p_file_path,
                'agentId', p_agent_id,
                'holder', p_holder,
                'expiresAt', v_expires_at,
                'ttlMs', p_ttl_ms,
                'renewed', true
            );
        END IF;

        -- Case C: Held by another agent -> reject
        RETURN jsonb_build_object(
            'allowed', false,
            'file', p_file_path,
            'agentId', p_agent_id,
            'holder', v_existing.holder,
            'heldBy', v_existing.agent_id,
            'expiresAt', v_existing.expires_at,
            'reason', 'held_by_other'
        );
    ELSE
        -- Insert fresh lock
        INSERT INTO public.latch_locks (
            id, workspace_id, file_path, agent_id, mode, holder, claimed_at, expires_at, ttl_ms
        ) VALUES (
            v_lock_id, p_workspace_id, p_file_path, p_agent_id, p_mode, p_holder, v_now, v_expires_at, p_ttl_ms
        );

        RETURN jsonb_build_object(
            'allowed', true,
            'file', p_file_path,
            'agentId', p_agent_id,
            'holder', p_holder,
            'expiresAt', v_expires_at,
            'ttlMs', p_ttl_ms
        );
    END IF;
END;
$$;

-- 4. Atomic Stored Procedure: Release Lock
CREATE OR REPLACE FUNCTION public.latch_release_lock(
    p_workspace_id TEXT,
    p_file_path TEXT,
    p_agent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_id TEXT;
    v_deleted INTEGER;
BEGIN
    v_lock_id := lower(trim(p_workspace_id)) || '::' || lower(trim(p_file_path));

    DELETE FROM public.latch_locks
    WHERE id = v_lock_id AND (agent_id = p_agent_id OR expires_at <= now());

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'released', v_deleted > 0
    );
END;
$$;

-- 5. Backward compatibility for Relay
CREATE OR REPLACE FUNCTION public.relay_claim_lock(
    p_workspace_id TEXT,
    p_file_path TEXT,
    p_agent_id TEXT,
    p_mode TEXT DEFAULT 'write',
    p_ttl_ms INTEGER DEFAULT 15000,
    p_holder JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $
    SELECT public.latch_claim_lock(p_workspace_id, p_file_path, p_agent_id, p_mode, p_ttl_ms, p_holder);
$;

CREATE OR REPLACE FUNCTION public.relay_release_lock(
    p_workspace_id TEXT,
    p_file_path TEXT,
    p_agent_id TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $
    SELECT public.latch_release_lock(p_workspace_id, p_file_path, p_agent_id);
$;

-- 6. Enable Supabase Realtime for instant lock & patch broadcasts
ALTER PUBLICATION supabase_realtime ADD TABLE public.latch_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.latch_patches;
