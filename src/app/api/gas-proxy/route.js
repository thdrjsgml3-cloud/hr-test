export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gasUrl = searchParams.get('url');

  if (!gasUrl) {
    return Response.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    const res = await fetch(gasUrl, { redirect: 'follow' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain' } }); }
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
