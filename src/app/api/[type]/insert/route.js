import { NextResponse } from 'next/server';
import { VALID_TYPES, getData, setData, nextId } from '@/lib/hrData';

export async function POST(req, { params }) {
  const { type } = params;
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  try {
    const { row, refId, pos } = await req.json();
    const rows = await getData(type);
    const newRow = { ...row, id: nextId(rows) };
    const idx = rows.findIndex(r => r.id === refId);
    const insertAt = idx === -1 ? rows.length : (pos === 'above' ? idx : idx + 1);
    rows.splice(insertAt, 0, newRow);
    await setData(type, rows);
    return NextResponse.json(newRow);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
