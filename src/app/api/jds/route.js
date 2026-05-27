import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('hr_data').select('data').eq('type', 'jds');
    if (error) throw new Error(error.message);
    return NextResponse.json(data?.[0]?.data ?? []);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const rows = await req.json();
    const supabase = createAdminClient();
    const { error } = await supabase.from('hr_data').upsert({ type: 'jds', data: rows });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
