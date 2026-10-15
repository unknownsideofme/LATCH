"use client";

import { useEffect, useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import { apiUrl } from "@/lib/api";
import type { OpenRoom, Room } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCheck, IconCopy } from "@/components/ui/icons";
import ui from "@/styles/ui.module.css";

function inviteLabel(state: string) {
  if (state === "pending") return "waiting to join";
  if (state === "accepted") return "in the room";
  if (state === "revoked") return "revoked";
  return "expired";
}

function sameLogin(a?: string | null, b?: string | null) {
  return Boolean(a) && Boolean(b) && a!.toLowerCase() === b!.toLowerCase();
}

export function TeamPanel() {
  const { dashboard, sync, user } = useLatch();
  const [room, setRoom] = useState<Room | null>(dashboard?.room || null);
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>(dashboard?.openRooms || []);
  const [busy, setBusy] = useState(false);
  const [busyLogin, setBusyLogin] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [joinPath, setJoinPath] = useState("");
  const [seed, setSeed] = useState(true);
  const [hint, setHint] = useState("");
  const [inviteLogin, setInviteLogin] = useState("");
  const [issued, setIssued] = useState<{ login: string; link: string; warning?: string } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [copiedTunnel, setCopiedTunnel] = useState(false);

  useEffect(() => {
    setRoom(dashboard?.room || null);
    if (dashboard?.openRooms) setOpenRooms(dashboard.openRooms);
  }, [dashboard]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(apiUrl("/api/room/discover"));
        const body = await res.json();
        if (!cancelled && Array.isArray(body.rooms)) setOpenRooms(body.rooms);
      } catch {
        /* dashboard poll is the fallback */
      }
    }
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [dashboard?.project.id]);

  if (!dashboard) return null;

  const me = user?.login || "";
  const invites = dashboard.invites || [];
  const hosting = room?.role === "host";
  const guest = room?.role === "guest";
  const hostDown = guest && room?.hostReachable === false;

  async function invite(loginRaw: string) {
    const login = loginRaw.trim().replace(/^@/, "");
    if (!login) return;
    setBusy(true);
    setBusyLogin(login);
    setHint("");
    try {
      const res = await fetch(apiUrl("/api/room/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      const body = await res.json();
      if (body.ok) {
        if (body.room) setRoom(body.room);
        setIssued({
          login,
          link: body.link,
          warning:
            body.warning ||
            (body.collaborator?.verified && !body.collaborator?.allowed
              ? `@${login} is not currently a collaborator on this repo — they will be refused unless you add them on GitHub first.`
              : body.collaborator?.verified === false
                ? "Could not reach GitHub to confirm collaborators, so this invite alone will admit them."
                : undefined),
        });
        setInviteLogin("");
        await sync();
      } else setHint(body.hint || body.error || "Could not create the invite");
    } finally {
      setBusy(false);
      setBusyLogin("");
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/room/invites/${id}/revoke`), { method: "POST" });
      await sync();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(login: string) {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/room/kick"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      await sync();
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setHint("");
    try {
      const res = await fetch(apiUrl("/api/room/share"), { method: "POST" });
      const body = await res.json();
      if (body.ok) {
        setRoom(body.room);
        if (body.warning) setHint(body.warning);
      } else setHint(body.hint || body.error || "Could not start sharing");
    } finally {
      setBusy(false);
    }
  }

  async function join(payload: { url?: string; hostLogin?: string; roomId?: string; gistId?: string }) {
    if (!payload.url && !payload.hostLogin) return;
    setBusy(true);
    setHint("Connecting — copying the host's workspace can take a moment…");
    try {
      const res = await fetch(apiUrl("/api/room/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, path: joinPath || undefined, seed }),
      });
      const body = await res.json();
      if (body.ok) {
        setRoom(body.room);
        setJoinUrl("");
        const seeded = body.seeded;
        setHint(
          seeded?.error
            ? `Joined, but the workspace copy failed: ${seeded.error}`
            : seeded
              ? `Joined. Copied ${seeded.files} file${seeded.files === 1 ? "" : "s"} from the host${seeded.truncated ? " (large files skipped)" : ""}.`
              : "Joined."
        );
        await sync();
      } else setHint(body.detail || body.hint || body.error || "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  function pendingFor(login: string) {
    return invites.find((i) => sameLogin(i.login, login) && i.state === "pending");
  }

  function openRoomFor(login: string) {
    return openRooms.find((r) => sameLogin(r.hostLogin, login));
  }

  return (
    <>
      <article className={ui.card}>
        <h3>Team in {dashboard.project.name}</h3>
        <p style={{ color: "var(--muted)" }}>
          Everyone on this GitHub repo stays on this list. Invite puts them in the shared room; Remove only kicks
          them out of the room — they stay here, offline, ready to invite again.
        </p>
        {dashboard.collaborators.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            No collaborators found. Make sure this workspace&apos;s git remote points at a GitHub repo you have access to.
          </p>
        )}
        {dashboard.collaborators.map((c) => {
          const mine = sameLogin(c.login, me);
          const inRoom = Boolean(c.inRoom);
          const pending = pendingFor(c.login);
          const incoming = !guest && !hosting && !inRoom && !mine ? openRoomFor(c.login) : null;
          const canInvite = !guest && !mine && !inRoom;
          return (
            <div className={ui.lockRow} key={c.id}>
              <div className={ui.collabIdentity}>
                <span className={`${ui.avatarDot} ${c.online ? ui.avatarOnline : ""}`}>
                  {c.avatarUrl ? <img src={c.avatarUrl} alt={c.login} /> : c.login?.[0]?.toUpperCase()}
                </span>
                <span>
                  {c.name} <span style={{ color: "var(--muted)" }}>@{c.login}</span>
                  {c.role && inRoom ? <span style={{ color: "var(--faint)" }}> · {c.role}</span> : null}
                  {c.source === "room" ? <span style={{ color: "var(--faint)" }}> · guest</span> : null}
                </span>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: c.online ? "var(--green)" : "var(--faint)" }}>
                  {c.agentActive ? `${c.agentLabel} running` : c.online ? "online" : "offline"}
                </span>
                {incoming ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-2.5 font-semibold"
                    disabled={busy}
                    onClick={() => join({ hostLogin: incoming.hostLogin, roomId: incoming.roomId, gistId: incoming.gistId || undefined })}
                  >
                    {busyLogin === c.login ? "Joining…" : "Join"}
                  </Button>
                ) : null}
                {canInvite && !incoming ? (
                  pending ? (
                    <span style={{ color: "var(--faint)" }}>invited</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 font-semibold"
                      disabled={busy}
                      onClick={() => invite(c.login)}
                    >
                      {busyLogin === c.login ? "Inviting…" : "Invite"}
                    </Button>
                  )
                ) : null}
                {hosting && inRoom && !mine && c.role !== "host" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-[var(--red)] hover:bg-[var(--red-dim)]"
                    disabled={busy}
                    onClick={() => removeMember(c.login)}
                  >
                    Remove
                  </Button>
                ) : null}
              </span>
            </div>
          );
        })}
        {dashboard.peers?.length ? (
          <p style={{ color: "var(--muted)" }}>
            Sharing chat history with {dashboard.peers.map((p) => `@${p}`).join(", ")}.
          </p>
        ) : null}
      </article>
      <article className={ui.card}>
        <h3>Shared room</h3>
        {room ? (
          <>
            {hosting ? (
              <p className={ui.roomLive}>You are hosting — teammates reconnect automatically if the tunnel moves.</p>
            ) : hostDown ? (
              <p className={ui.roomWait}>Host is offline. Waiting to reconnect…</p>
            ) : (
              <p className={ui.roomLive}>
                Connected to @{room.hostLogin || "host"}
                {room.hostProjectName ? ` · ${room.hostProjectName}` : ""}
              </p>
            )}
            <p>
              You are the <strong>{room.role}</strong>
              {room.role === "guest" && room.hostProjectName ? (
                <span style={{ color: "var(--muted)" }}> in {room.hostProjectName}</span>
              ) : null}
            </p>
            {room.url ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  background: "var(--sunken)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "8px 12px",
                  margin: "12px 0",
                  maxWidth: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    Tunnel
                  </span>
                  <code
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {room.url}
                  </code>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(room.url);
                      setCopiedTunnel(true);
                      setTimeout(() => setCopiedTunnel(false), 2000);
                    }}
                  >
                    {copiedTunnel ? (
                      <>
                        <IconCheck size={14} /> Copied
                      </>
                    ) : (
                      <>
                        <IconCopy size={14} /> Copy tunnel
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await fetch(apiUrl("/api/room/leave"), { method: "POST" });
                      setRoom(null);
                      setIssued(null);
                      setBusy(false);
                      await sync();
                    }}
                  >
                    Leave room
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ margin: "10px 0" }}>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await fetch(apiUrl("/api/room/leave"), { method: "POST" });
                    setRoom(null);
                    setIssued(null);
                    setBusy(false);
                    await sync();
                  }}
                >
                  Leave room
                </Button>
              </div>
            )}
            {room.role === "guest" && room.projectPath ? (
              <p style={{ color: "var(--muted)", fontSize: 12, margin: "6px 0 12px" }}>
                Mirroring into <code>{room.projectPath}</code> — locks, patches and chat history are shared with the host.
              </p>
            ) : null}
            {hosting ? (
              <>
                <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "18px 0" }} />
                <h3 style={{ marginBottom: 4 }}>Invite someone who isn&apos;t listed</h3>
                <p style={{ color: "var(--muted)", margin: "0 0 10px", fontSize: 12.5 }}>
                  They still have to be a collaborator on this GitHub repo. After you invite, they just hit Join —
                  you do not need to send a link unless they are not running Latch yet.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 380 }}>
                  <Input
                    style={{ flex: 1 }}
                    value={inviteLogin}
                    onChange={(e) => setInviteLogin(e.target.value)}
                    placeholder="github-username"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") invite(inviteLogin);
                    }}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => invite(inviteLogin)}
                    disabled={busy || !inviteLogin.trim()}
                  >
                    {busyLogin === inviteLogin.trim() ? "Inviting…" : "Invite"}
                  </Button>
                </div>
                {issued ? (
                  <div className={ui.card} style={{ marginTop: 10 }}>
                    <p style={{ marginTop: 0 }}>
                      @{issued.login} can Join from their Team tab. A backup link is here if they need it:
                    </p>
                    <code style={{ wordBreak: "break-all" }}>{issued.link}</code>
                    <div className={ui.actions} style={{ justifyContent: "flex-start", marginTop: 8, gap: 8 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-semibold"
                        onClick={() => navigator.clipboard.writeText(issued.link)}
                      >
                        Copy invite link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIssued(null)}
                      >
                        Done
                      </Button>
                    </div>
                    {issued.warning ? <p style={{ color: "var(--amber)" }}>{issued.warning}</p> : null}
                  </div>
                ) : null}
                {invites.length ? (
                  <>
                    <h3 style={{ marginBottom: 4 }}>Invitations</h3>
                    {invites.map((i) => (
                      <div className={ui.lockRow} key={i.id}>
                        <span>
                          @{i.login} <span style={{ color: "var(--faint)" }}>· {inviteLabel(i.state)}</span>
                        </span>
                        {i.state === "pending" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-[var(--red)] hover:bg-[var(--red-dim)] px-2"
                            disabled={busy}
                            onClick={() => revoke(i.id)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", marginTop: 0 }}>
              Host from here, or Join when a teammate invites you. The tunnel can change — the room does not.
            </p>
            {openRooms.length ? (
              <div style={{ marginBottom: 12 }}>
                {openRooms.map((r) => (
                  <div className={ui.lockRow} key={`${r.hostLogin}:${r.roomId}`}>
                    <span>
                      @{r.hostLogin} is hosting{r.projectName ? ` ${r.projectName}` : ""}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs font-semibold"
                      disabled={busy}
                      onClick={() => join({ hostLogin: r.hostLogin, roomId: r.roomId, gistId: r.gistId || undefined })}
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Button variant="default" size="sm" className="h-8 text-xs font-semibold" onClick={share} disabled={busy}>
                {busy ? "Starting…" : "Share this workspace"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => setLinkOpen((v) => !v)}
              >
                {linkOpen ? "Hide invite link" : "Have an invite link?"}
              </Button>
            </div>
            {linkOpen ? (
              <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border)]">
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] block mb-1">Paste the invite link</label>
                  <Input
                    className="h-8 text-xs"
                    value={joinUrl}
                    onChange={(e) => setJoinUrl(e.target.value)}
                    placeholder="https://abc.ngrok-free.app/?latch_invite=…"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted)] block mb-1">Folder to mirror into (optional)</label>
                  <Input
                    className="h-8 text-xs"
                    value={joinPath}
                    onChange={(e) => setJoinPath(e.target.value)}
                    placeholder="Leave blank to use ~/Documents/Latch/<host repo>"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--text)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={seed}
                    onChange={(e) => setSeed(e.target.checked)}
                  />
                  Copy the host&apos;s codebase on join
                </label>
                <div className="pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => join({ url: joinUrl })}
                    disabled={busy || !joinUrl}
                  >
                    Join room
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
        {hint ? <p style={{ color: "var(--amber)" }}>{hint}</p> : null}
      </article>
    </>
  );
}
