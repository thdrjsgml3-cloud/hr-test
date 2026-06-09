import { NextResponse } from 'next/server';
import { VALID_TYPES, getData, setData, nextId } from '@/lib/hrData';

export async function GET(req, { params }) {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    return NextResponse.json(await getData(type));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    const body = await req.json();
    const supabase = createAdminClient();
    const { error } = await supabase.from('hr_data').upsert({ type, data: body });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    const body = await req.json();
    const rows = await getData(type);
    const row = { ...body, id: nextId(rows) };
    rows.push(row);
    await setData(type, rows);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
