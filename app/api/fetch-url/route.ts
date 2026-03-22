import { fetchUrlContent } from "@/lib/server/content-fetcher";

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url: string };

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const result = await fetchUrlContent(url);
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
