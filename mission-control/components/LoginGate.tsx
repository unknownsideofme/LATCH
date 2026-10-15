"use client";

import { useLatch } from "@/lib/LatchContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LoginGate() {
  const { users, login } = useLatch();
  return (
    <div className="h-screen w-screen grid place-items-center bg-[var(--bg,#F2EEE8)] p-4">
      <Card className="w-full max-w-[400px] shadow-lg border-[var(--border,#DDD3C9)] bg-[var(--card,#FFFCF8)]">
        <CardHeader className="text-center pb-4">
          <div className="text-[14px] font-bold tracking-tight text-[var(--accent,#7A3438)] font-[var(--font-display)] mb-1">
            ./latch
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight font-[var(--font)] text-[var(--text,#302925)]">
            Sign in
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-[var(--muted,#776F67)] font-[var(--font-warm)] pt-1">
            Run <code className="font-[var(--mono)] text-[var(--accent)] font-semibold bg-[var(--elev)] px-1.5 py-0.5 rounded text-[11.5px]">latch login</code> (uses GitHub CLI). Continue with GitHub needs{" "}
            <code className="font-[var(--mono)] text-[var(--accent)] font-semibold bg-[var(--elev)] px-1.5 py-0.5 rounded text-[11.5px]">GITHUB_CLIENT_ID</code>. The names below only impersonate a teammate on this machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <a href="/api/auth/github" className="block w-full">
            <Button className="w-full" variant="default" size="default">
              Continue with GitHub
            </Button>
          </a>
          {users.map((u) => (
            <Button
              key={u.id}
              variant="outline"
              size="default"
              className="w-full text-[13px] font-medium"
              onClick={() => login(u.login)}
            >
              Continue as {u.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

