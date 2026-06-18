import { NextResponse } from 'next/server';
import { VALID_TYPES, getData } from '@/lib/hrData';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const result = {};
    for (const type of VALID_TYPES) {
      result[type] = await getData(type);
    }
    return NextResponse.json(
      { createdAt: new Date().toISOString(), data: result },
      { headers: CORS }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
