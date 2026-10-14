export const API = process.env.NEXT_PUBLIC_LATCH_API || process.env.NEXT_PUBLIC_RELAY_API || "";

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return cleanPath;
  }
  return `${process.env.INTERNAL_API_URL || "http://127.0.0.1:3001"}${cleanPath}`;
}
