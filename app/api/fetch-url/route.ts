export async function POST(req: Request) {
  const { url } = await req.json() as { url: string };

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoodEnglish/1.0)',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `Failed to fetch: ${response.status}` }, { status: 502 });
    }

    const html = await response.text();

    // Basic HTML to text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    return Response.json({ content: text, url });
  } catch (error) {
    return Response.json(
      { error: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 502 },
    );
  }
}
