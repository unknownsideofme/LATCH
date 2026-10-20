import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const providerToken = session.provider_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: "no_github_token", message: "User is not authenticated with GitHub OAuth" },
        { status: 403 }
      );
    }

    // Fetch user repos from GitHub API
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${providerToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Latch-Agent-Coordinator",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: "github_api_failed", details: errBody },
        { status: res.status }
      );
    }

    const repos = await res.json();
    return NextResponse.json({ repos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch repositories" }, { status: 500 });
  }
}
