const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const {
  coordinatorStatePath,
  homeLatchDir,
  canonicalWorkspaceFile,
  canonicalWorkspaceRoot,
} = require("../lib/paths");
const { loadRoom } = require("../lib/room");

const HTTP_TIMEOUT_MS = 2000;

function readState(workspacePath) {
  const files = [coordinatorStatePath(workspacePath), coordinatorStatePath(null)];
  for (const file of files) {
    try {
      const state = JSON.parse(fs.readFileSync(file, "utf8"));
      if (state.port || state.apiPort) return state;
    } catch {
      /* next */
    }
  }
  return null;
}

function readPort(workspacePath) {
  const state = readState(workspacePath);
  return state?.port ? Number(state.port) : null;
}

// The API server owns the same in-memory lock table the dashboard renders, and
// its port is fixed, so it is the one target that cannot go stale. The
// coordinator's port is ephemeral and its state file is trusted blindly by
// readPort — a `relay serve` that dies after binding the coordinator but before
// binding the API leaves a pointer to a dead port behind.
function apiPort(workspacePath) {
  if (process.env.LATCH_PORT || process.env.RELAY_PORT) return Number(process.env.LATCH_PORT || process.env.RELAY_PORT);
  const state = readState(workspacePath);
  return Number(state?.apiPort) || 3001;
}

// A room whose host has gone away (closed laptop, expired tunnel) otherwise
// costs every hook a full HTTP timeout on each of claim/heartbeat/release, which
// reads to the user as "the agent froze".
const ROOM_COOLDOWN_MS = 30_000;
const roomFailedAt = new Map();

// Only a guest talks to the room. The host *is* the coordinator: routing its own
// hooks out through its ngrok tunnel and back adds a full internet round trip to
// every claim, and stalls the agent whenever the tunnel hiccups.
function roomUsable(room) {
  if (!room?.url || room.role !== "guest") return false;
  const failed = roomFailedAt.get(room.url);
  return !failed || Date.now() - failed > ROOM_COOLDOWN_MS;
}

function markRoomDown(room) {
  if (room?.url) roomFailedAt.set(room.url, Date.now());
}

// The lock table namespaces every lock by absolute workspace path, so a guest
// claiming `src/auth.ts` under `D:\work\repo` and a host holding it under
// `/home/ana/repo` land in two different namespaces and never collide — the
// coordinator looks shared while arbitrating nothing. Rewriting the workspace to
// the host's path is what puts both users on one mutex.
// `path.resolve` alone is not enough on Windows: the same folder reaches us as
// both `C:\Users\PRAKRI~1\...` and `C:\Users\Prakrititz Borah\...` depending on
// who spawned the agent, and a mismatch here silently sends the claim to the
// guest's own namespace instead of the shared one.
function canonicalPath(value) {
  if (!value) return "";
  try {
    return fs.realpathSync.native(value).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  } catch {
    return path.resolve(String(value)).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  }
}

function roomPayload(room, workspacePath, payload) {
  if (room?.role !== "guest" || !room.hostWorkspacePath) return payload;
  const local = canonicalPath(room.projectPath);
  const here = canonicalPath(workspacePath);
  // Antigravity (and some other agents) report a cwd that is the same repo on
  // a different drive letter than the clone Relay joined. Still rewrite onto
  // the host path so both machines share one lock namespace. Skip only when
  // this is clearly a different folder with no room of its own.
  if (local && here && local !== here && !here.startsWith(`${local}/`)) {
    const hereRoom = loadRoom(workspacePath);
    if (!hereRoom?.url || hereRoom.url !== room.url) return payload;
  }
  return { ...payload, workspaceId: room.hostWorkspacePath, peerWorkspacePath: workspacePath };
}

function postJson(port, pathname, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw || "{}") });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getJson(port, pathname, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function leaseDirectory(workspacePath, agentId) {
  const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
  const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
  const ownerKey = `${workspaceKey}::${agentId}`;
  const ownerHash = crypto.createHash("sha256").update(ownerKey).digest("hex");
  const dir = path.join(homeLatchDir(), "leases", ownerHash);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function leasePath(workspacePath, agentId, file) {
  const canonicalFile = canonicalWorkspaceFile(workspacePath, file);
  if (!canonicalFile) return null;
  const hash = crypto.createHash("sha256").update(canonicalFile).digest("hex");
  return path.join(leaseDirectory(workspacePath, agentId), `${hash}.json`);
}

function readLease(workspacePath, agentId, file) {
  const target = leasePath(workspacePath, agentId, file);
  if (!target) return null;
  try {
    const lease = JSON.parse(fs.readFileSync(target, "utf8"));
    const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
    const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
    return lease.workspaceKey === workspaceKey && lease.agentId === agentId &&
      lease.filePath === canonicalWorkspaceFile(workspacePath, file) ? lease : null;
  } catch {
    return null;
  }
}

function saveLease(workspacePath, agentId, file, lease) {
  if (!lease?.ownershipToken || !Number.isSafeInteger(Number(lease.fencingToken))) return;
  const target = leasePath(workspacePath, agentId, file);
  if (!target) return;
  const temp = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
  const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
  fs.writeFileSync(
    temp,
    JSON.stringify({
      workspaceKey,
      agentId,
      filePath: canonicalWorkspaceFile(workspacePath, file),
      sessionId: lease.sessionId || "",
      ownershipToken: lease.ownershipToken,
      fencingToken: Number(lease.fencingToken),
    }),
    { mode: 0o600 }
  );
  fs.renameSync(temp, target);
}

function removeLease(workspacePath, agentId, file) {
  const target = leasePath(workspacePath, agentId, file);
  if (!target) return;
  try {
    fs.unlinkSync(target);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

function readLeases(workspacePath, agentId) {
  const dir = leaseDirectory(workspacePath, agentId);
  const leases = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const lease = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
      const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
      if (lease.workspaceKey === workspaceKey && lease.agentId === agentId) leases.push(lease);
    } catch {
      /* an incomplete local credential is not a usable lease */
    }
  }
  return leases;
}

async function postRemote(url, pathname, body, timeoutMs, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "relay",
        ...(token ? { "x-latch-room-token": token, "x-relay-room-token": token } : {}),
      },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } finally {
    clearTimeout(timer);
  }
}

async function claimFile(workspacePath, agentId, file, ttlMs = 15000, opts = {}) {
  const started = Date.now();
  const room = loadRoom(workspacePath);
  const files = Array.isArray(opts.files) && opts.files.length ? opts.files : [file];
  const payload = {
    agentId,
    file,
    ttl: ttlMs,
    workspaceId: workspacePath,
    dependsOn: opts.dependsOn,
    files: opts.files,
    mode: opts.mode,
    keepAlive: opts.keepAlive === true,
    holder: opts.holder || null,
    annotation: typeof opts.annotation === "string" ? opts.annotation.slice(0, 140) : undefined,
    leases: files.map((item) => {
      const lease = readLease(workspacePath, agentId, item);
      return lease ? { ...lease, file: lease.filePath } : null;
    }).filter(Boolean),
  };
  // Local API owns the control-plane socket. Guests must not wait on ngrok HTTP
  // while chat snapshots are in flight — claims hop loopback, then a tiny WS.
  // A `degraded` answer means the daemon could not reach the host, so it is not
  // an answer at all — it must not short-circuit the ladder the way a real
  // verdict does. Before this, the daemon's local-table grant came back as a
  // plain `allowed: true` and stopped the search here, shadowing the room HTTP
  // rung below: a dead control socket with a perfectly healthy tunnel never
  // fell through to the wire that was still up.
  let degraded = null;
  try {
    const remaining = Math.max(80, 800 - (Date.now() - started));
    const { body } = await postJson(apiPort(workspacePath), "/api/coord/claim", roomPayload(room, workspacePath, payload), remaining);
    if (body?.degraded) degraded = { ...body, source: body.source || "local_fallback" };
    else if (body && typeof body.allowed === "boolean") {
      if (body.allowed) persistClaimLeases(workspacePath, agentId, body);
      return { ...body, source: body.source || "control" };
    }
  } catch {
    /* coordinator / remote fallback */
  }
  if (roomUsable(room)) {
    try {
      const { body } = await postRemote(room.url, "/api/coord/claim", roomPayload(room, workspacePath, payload), HTTP_TIMEOUT_MS, room.memberToken);
      if (typeof body.allowed === "boolean") {
        if (body.allowed) persistClaimLeases(workspacePath, agentId, body);
        return { ...body, source: body.source || "room" };
      }
      throw new Error("The room returned an invalid lock response.");
    } catch {
      markRoomDown(room);
    }
  }
  // Once the shared coordinator cannot answer, a local grant could overlap a
  // lock owned by another machine. Refuse rather than convert an unknown state
  // into a successful claim.
  if (degraded) {
    console.warn("[latch] HOST_UNREACHABLE — claim refused rather than granted locally");
    return degraded;
  }
  const port = readPort(workspacePath);
  if (port) {
    try {
      const remaining = Math.max(50, HTTP_TIMEOUT_MS - (Date.now() - started));
      const { body } = await postJson(port, "/claim", payload, remaining);
      if (typeof body.allowed === "boolean") {
        if (body.allowed) persistClaimLeases(workspacePath, agentId, body);
        return { ...body, source: body.source || "coordinator" };
      }
      throw new Error("The coordinator returned an invalid lock response.");
    } catch {
      /* fall through */
    }
  }

  // Direct Supabase fallback when coordinator daemon is offline
  try {
    const { isSupabaseConfigured } = require("../supabase/client");
    if (isSupabaseConfigured()) {
      const { SupabaseLockAdapter } = require("../supabase/SupabaseLockAdapter");
      const adapter = new SupabaseLockAdapter();
      if (adapter.enabled) {
        const canonical = canonicalWorkspaceFile(workspacePath, file) || file;
        const savedLease = readLease(workspacePath, agentId, canonical);
        const res = await adapter.claim({
          workspaceId: workspacePath,
          file: canonical,
          agentId,
          sessionId: opts.sessionId || (savedLease?.sessionId || ""),
          ownershipToken: savedLease?.ownershipToken,
          fencingToken: savedLease?.fencingToken,
          mode: opts.mode || "write",
          ttl: ttlMs,
          holder: opts.holder || {},
        });
        if (res && typeof res.allowed === "boolean") {
          if (res.allowed) persistClaimLeases(workspacePath, agentId, res);
          return { ...res, source: "supabase" };
        }
      }
    }
  } catch (err) {
    /* fallback to fail-open or coordinator error */
  }

  console.warn("[latch] COORDINATOR_UNAVAILABLE — write claim refused");
  return {
    allowed: false,
    degraded: true,
    source: "unavailable",
    code: "COORDINATOR_UNAVAILABLE",
    reason: "The shared coordinator could not verify this file lease.",
  };
}

function persistClaimLeases(workspacePath, agentId, result) {
  const locks = Array.isArray(result.locks) ? result.locks : result.lock ? [result.lock] : [result];
  for (const lock of locks) {
    const file = lock.filePath || lock.file || result.filePath || result.file;
    if (!file) continue;
    saveLease(workspacePath, agentId, file, lock);
  }
}

async function releaseFile(workspacePath, agentId, file) {
  const room = loadRoom(workspacePath);
  const lease = readLease(workspacePath, agentId, file);
  const payload = {
    agentId,
    file,
    workspaceId: workspacePath,
    ownershipToken: lease?.ownershipToken,
    fencingToken: lease?.fencingToken,
  };
  try {
    const { body } = await postJson(apiPort(workspacePath), "/api/coord/release", roomPayload(room, workspacePath, payload), 600);
    // A degraded release is already queued for replay by the daemon, but the
    // tunnel may still be up even when the control socket is not — try it, and
    // let the replay be a harmless no-op if this succeeds.
    if (body && !body.degraded) {
      if (body.released || body.released === false) removeLease(workspacePath, agentId, file);
      return body;
    }
  } catch {
    /* fallback */
  }
  if (roomUsable(room)) {
    try {
      const { body } = await postRemote(room.url, "/api/coord/release", roomPayload(room, workspacePath, payload), HTTP_TIMEOUT_MS, room.memberToken);
      if (body.released || body.released === false) removeLease(workspacePath, agentId, file);
      return body;
    } catch {
      markRoomDown(room);
    }
  }

  // Direct Supabase fallback
  try {
    const { isSupabaseConfigured } = require("../supabase/client");
    if (isSupabaseConfigured()) {
      const { SupabaseLockAdapter } = require("../supabase/SupabaseLockAdapter");
      const adapter = new SupabaseLockAdapter();
      if (adapter.enabled) {
        const canonical = canonicalWorkspaceFile(workspacePath, file) || file;
        const res = await adapter.release({
          workspaceId: workspacePath,
          file: canonical,
          agentId,
          sessionId: lease?.sessionId,
          ownershipToken: lease?.ownershipToken,
          fencingToken: lease?.fencingToken,
        });
        if (res?.released || res?.released === false) {
          removeLease(workspacePath, agentId, file);
          return res;
        }
      }
    }
  } catch (err) {
    /* fallback */
  }

  return { ok: false, degraded: true, reason: "coordinator_unavailable" };
}

async function status(workspacePath) {
  const port = readPort(workspacePath);
  if (!port) return { locks: {} };
  try {
    return await getJson(port, "/status", HTTP_TIMEOUT_MS);
  } catch {
    return { locks: {} };
  }
}

async function releaseAll(workspacePath, agentId) {
  const room = loadRoom(workspacePath);
  const leases = readLeases(workspacePath, agentId).map((lease) => ({
    file: lease.filePath,
    ownershipToken: lease.ownershipToken,
    fencingToken: lease.fencingToken,
  }));
  const payload = { agentId, workspaceId: workspacePath, leases };
  const finish = (body) => {
    const released = Array.isArray(body?.released) ? body.released : [];
    for (const file of released) removeLease(workspacePath, agentId, file);
    return body;
  };
  if (roomUsable(room)) {
    try {
      const { body } = await postRemote(room.url, "/api/coord/release-all", roomPayload(room, workspacePath, payload), HTTP_TIMEOUT_MS, room.memberToken);
      return finish(body);
    } catch {
      markRoomDown(room);
      /* local fallback */
    }
  }
  const port = readPort(workspacePath);
  if (port) {
    try {
      const { body } = await postJson(port, "/release-all", payload, HTTP_TIMEOUT_MS);
      return finish(body);
    } catch {
      /* ignore */
    }
  }
  try {
    const { body } = await postJson(apiPort(workspacePath), "/api/coord/release-all", payload, HTTP_TIMEOUT_MS);
    return finish(body);
  } catch {
    /* ignore */
  }
  return { released: [] };
}

async function heartbeat(workspacePath, agentId, file) {
  const room = loadRoom(workspacePath);
  const lease = readLease(workspacePath, agentId, file);
  const payload = {
    agentId,
    file,
    workspaceId: workspacePath,
    ownershipToken: lease?.ownershipToken,
    fencingToken: lease?.fencingToken,
  };
  try {
    const { body } = await postJson(apiPort(workspacePath), "/api/coord/heartbeat", roomPayload(room, workspacePath, payload), 400);
    if (body) return body;
  } catch {
    /* fallback */
  }
  if (roomUsable(room)) {
    try {
      const { body } = await postRemote(room.url, "/api/coord/heartbeat", roomPayload(room, workspacePath, payload), HTTP_TIMEOUT_MS, room.memberToken);
      return body;
    } catch {
      markRoomDown(room);
    }
  }
  return { ok: false, reason: "coordinator_unavailable" };
}

module.exports = { claimFile, releaseFile, releaseAll, status, readPort, heartbeat };
