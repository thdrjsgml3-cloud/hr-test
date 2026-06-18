import { NextResponse } from 'next/server';
import { setData } from '@/lib/hrData';

const SHEET_ID = '10xgEQgoBL9tp-jslIkEN-Y4UEPmYs_oece58qMZiJmw';

function cell(c) { return !c ? '' : c.f != null ? c.f : c.v != null ? String(c.v) : ''; }
function col(raw, i) { return !raw || !raw[i] ? '' : cell(raw[i]); }

function normDate(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = v.match(/Date\((\d+),(\d+),(\d+)/);
    if (m) return `${m[1]}-${String(+m[2]+1).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(v.trim())) return v.trim().replace(/\./g, '-');
    return v.trim();
  }
  return String(v).trim();
}

function mapYN(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (['O','o','완료','Y','y'].includes(s)) return '완료';
  if (['X','x','미완료','N','n'].includes(s)) return '미완료';
  return s;
}

function mapAtt(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (['O','참석','Y'].includes(s)) return '참석';
  if (['X','불참','N'].includes(s)) return '불참';
  return s;
}

function mapResult(v) {
  if (!v) return '대기';
  const s = String(v).trim();
  if (['수락','O','o','Y','y'].includes(s)) return '수락';
  if (['거절','X','x','N','n'].includes(s)) return '거절';
  return s || '대기';
}

async function fetchSheet(name) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(name)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`'${name}' 시트 로드 실패 (HTTP ${r.status})`);
  const t = await r.text();
  return JSON.parse(t.replace(/^[^(]*\((.*)\);?$/s, '$1')).table;
}

export async function POST() {
  try {
    const [iT, oT, pT] = await Promise.all([
      fetchSheet('면접일정'),
      fetchSheet('교육 및 입사자'),
      fetchSheet('O/B 채용'),
    ]);

    const interviews = iT.rows.map(r => ({ _raw: r.c })).filter(r => col(r._raw, 1) !== '')
      .map((r, i) => ({
        id: i + 1, name: col(r._raw, 8), contact: col(r._raw, 9), job: col(r._raw, 6),
        type: '지원자', platform: col(r._raw, 18) || '사람인',
        date: normDate(col(r._raw, 1)), time: col(r._raw, 2), interviewer: col(r._raw, 11),
        manager: col(r._raw, 12), attendance: col(r._raw, 13), passed: col(r._raw, 14),
        guided: col(r._raw, 15), startDate: normDate(col(r._raw, 16)), memo: col(r._raw, 17),
        status: '면접예정',
      }));

    const onboards = oT.rows.map(r => ({ _raw: r.c })).filter(r => col(r._raw, 8) !== '')
      .map((r, i) => ({
        id: i + 1, name: col(r._raw, 8), contact: col(r._raw, 9), job: col(r._raw, 6),
        date: normDate(col(r._raw, 3)), manager: col(r._raw, 12), status: '입사 예정',
        attendance: mapAtt(col(r._raw, 13)), emailCreated: mapYN(col(r._raw, 14)),
        flexJoined: mapYN(col(r._raw, 15)), contractSigned: mapYN(col(r._raw, 16)),
        memo: col(r._raw, 17),
      }));

    const proposals = pT.rows.map(r => ({ _raw: r.c })).filter(r => col(r._raw, 8) !== '')
      .map((r, i) => ({
        id: i + 1, name: col(r._raw, 8), contact: col(r._raw, 9), job: col(r._raw, 6),
        platform: col(r._raw, 2), manager: col(r._raw, 12),
        date: normDate(col(r._raw, 1)), result: mapResult(col(r._raw, 15)), memo: col(r._raw, 17),
      }));

    await Promise.all([
      setData('interviews', interviews),
      setData('onboards', onboards),
      setData('proposals', proposals),
    ]);

    return NextResponse.json({
      ok: true,
      counts: { interviews: interviews.length, onboards: onboards.length, proposals: proposals.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
