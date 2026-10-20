import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Upsert into users table based on the provided schema:
      // users: id (uuid), username (text), name (text), email (text), project_limit (int4), created_at (timestamptz)
      const user = data.user;
      const metadata = user.user_metadata || {};
      const username = metadata.user_name || metadata.preferred_username || user.email?.split("@")[0] || "operator";
      const name = metadata.full_name || metadata.name || username;

      await supabase.from("users").upsert(
        {
          id: user.id,
          username,
          name,
          email: user.email,
          project_limit: 10,
        },
        { onConflict: "id" }
      );

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to login with an error if code exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
