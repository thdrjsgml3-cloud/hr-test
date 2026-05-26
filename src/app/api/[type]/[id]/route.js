import { NextResponse } from 'next/server';
import { VALID_TYPES, getData, setData } from '@/lib/hrData';

export async function PUT(req, { params }) {
  const { type, id } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    const numId = Number(id);
    const body = await req.json();
    const rows = await getData(type);
    const i = rows.findIndex(r => r.id === numId);
    if (i === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    rows[i] = { ...rows[i], ...body, id: numId };
    await setData(type, rows);
    return NextResponse.json(rows[i]);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { type, id } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    const numId = Number(id);
    const rows = await getData(type);
    await setData(type, rows.filter(r => r.id !== numId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
