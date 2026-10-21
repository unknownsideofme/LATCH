import { NextResponse } from "next/server";

/**
 * Return a 307 redirect to the request origin concatenated with the `next` query value.
 * Missing or empty `next` values default to `/dashboard`.
 * URL parsing and redirect validation errors reject the promise.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") || "/dashboard";
  return NextResponse.redirect(`${origin}${next}`);
}
