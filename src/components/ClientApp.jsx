'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { Chart, registerables } from 'chart.js';
import { LayoutDashboard, CalendarCheck, UserCheck, Send, Menu, Plus, Sun, Moon, Search, Settings, Receipt } from 'lucide-react';
import { STATUS_COLORS, CHART_COLORS, DEFAULT_INTERVIEWS, DEFAULT_ONBOARDS, DEFAULT_PROPOSALS } from '@/lib/constants';
import { today, getHighlightDate } from '@/lib/utils';
import { loadData, apiUpdate, apiAdd, apiInsert, apiDelete, apiSync } from '@/lib/sheets';

Chart.register(...registerables);

// ── 월 관련 헬퍼 ──
function generateMonths() {
  const result = [];
  const now = new Date();
  let y = 2025, m = 5;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    result.push(`${y}-${String(m).padStart(2,'0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return result;
}
function fmtMonth(k) {
  if (!k || k === 'none') return '날짜 없음';
  const [y, m] = k.split('-');
  return `${y}년 ${parseInt(m)}월`;
}
function fmtMonthShort(k) {
  if (!k || k === 'none') return '-';
  const [y, m] = k.split('-');
  return `${String(y).slice(-2)}.${m}`;
}
function categorizeJob(job, settings) {
  if (!job) return '본사';
  if (settings.sales.some(k => job.includes(k))) return '영업';
  if (settings.fnb.some(k => job.includes(k))) return 'F&B';
  return '본사';
}

const DEFAULT_APP_SETTINGS = {
  sales: ['광고 영업', '광고영업'],
  fnb: ['육지', '교도리', '코브', '그랑디르', 'PZPZ'],
  managers: ['정제원', '송건희', '김대현', '전고은'],
  applicantPlatforms: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬', '지인소개'],
  proposalPlatforms: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬'],
  costVendors: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬', '기타'],
  costNotes: ['퍼플페퍼', '땡큐'],
};

function fmtAmount(n) {
  if (!n) return '0원';
  return Number(n).toLocaleString('ko-KR') + '원';
}

function groupByMonth(rows) {
  const groups = {};
  rows.forEach(r => { const k = r.date?.slice(0,7)||'none'; (groups[k]=groups[k]||[]).push(r); });
  return Object.entries(groups).sort((a,b) => b[0]==='none'?-1 : a[0]==='none'?1 : b[0].localeCompare(a[0]));
}

/* ── Badge ── */
function Badge({ text, cls }) {
  return <span className={`badge ${cls || STATUS_COLORS[text] || 'badge-gray'}`}>{text}</span>;
}

/* ── Inline text input (uncontrolled → saves on blur only) ── */
function InlineText({ value, onSave, placeholder }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = value || ''; }, [value]);
  return <input ref={ref} className="inline-input" defaultValue={value || ''} placeholder={placeholder || '-'} onBlur={e => onSave(e.target.value)} />;
}

/* ── 금액 입력 (실시간 세자리 쉼표) ── */
function AmountInput({ value, onSave }) {
  const ref = useRef(null);
  const fmt = n => (n ? Number(n).toLocaleString('ko-KR') : '');
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = fmt(value); }, [value]);
  return (
    <input ref={ref} className="inline-input" style={{textAlign:'right'}}
      defaultValue={fmt(value)} placeholder="0"
      onFocus={e => { e.target.value = value ? String(value) : ''; e.target.select(); }}
      onInput={e => { const d = e.target.value.replace(/[^0-9]/g,''); e.target.value = d ? Number(d).toLocaleString('ko-KR') : ''; }}
      onBlur={e => { const n = Number(e.target.value.replace(/[^0-9]/g,''))||0; onSave(n); e.target.value = fmt(n); }}
    />
  );
}

/* ── 날짜 입력 (텍스트, 포커스 시 전체 선택 → 연도 입력하면 월/일 초기화 없이 덮어씀) ── */
function DateInput({ value, onSave }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = value || ''; }, [value]);
  return (
    <input ref={ref} className="inline-input" defaultValue={value||''} placeholder="YYYY-MM-DD" maxLength={10}
      onFocus={e => e.target.select()}
      onBlur={e => {
        const v = e.target.value.trim();
        if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) { onSave(v); }
        else { e.target.value = value || ''; }
      }}
    />
  );
}

/* ── 열 너비 드래그 조정 ── */
function useColResize(init) {
  const tbRef = useRef(null);
  const saved = useRef([...init]);
  const totalW = () => saved.current.reduce((a,b)=>a+b,0);
  useEffect(() => { if (tbRef.current) tbRef.current.style.width = totalW()+'px'; }, []);
  const grab = useCallback((idx, e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = saved.current[idx];
    const mv = ev => {
      const w = Math.max(32, w0 + ev.clientX - x0);
      saved.current[idx] = w;
      const table = tbRef.current;
      if (!table) return;
      const col = table.querySelectorAll('col')[idx];
      if (col) col.style.width = w + 'px';
      table.style.width = totalW() + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  }, []);
  return { tbRef, grab, init };
}

/* ── Chart wrapper ── */
function ChartBox({ type, data, options, onChartClick }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const mergedOptions = onChartClick
      ? { ...options, onClick: (_, elements) => { if (elements.length > 0) onChartClick(elements[0].index); } }
      : options;
    chartRef.current = new Chart(canvasRef.current, { type, data, options: mergedOptions });
    return () => chartRef.current?.destroy();
  });
  return <div className="chart-canvas-wrap"><canvas ref={canvasRef} /></div>;
}

/* ═══════════════════════════════════════════
   DASHBOARD PAGE
═══════════════════════════════════════════ */
const ALL_MONTHS = generateMonths();

const DashboardPage = React.memo(function DashboardPage({ interviews, onboards, proposals, costs, sheetStatus, theme, appSettings, onNavigate }) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#888785' : '#6b6b6b';
  const borderColor = isDark ? '#1c1b19' : '#ffffff';
  const gridColor = isDark ? '#2a2927' : '#eee';

  // 부서 필터
  const [deptFilter, setDeptFilter] = useState('전체');
  // 월 필터
  const [selMonths, setSelMonths] = useState(() => new Set(ALL_MONTHS));
  const toggleMonth = m => setSelMonths(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const toggleAll = () => setSelMonths(p => p.size===ALL_MONTHS.length ? new Set() : new Set(ALL_MONTHS));

  const applyFilters = useCallback((rows) => {
    let r = deptFilter === '전체' ? rows : rows.filter(row => categorizeJob(row.job, appSettings) === deptFilter);
    return r.filter(row => row.date && selMonths.has(row.date.slice(0,7)));
  }, [deptFilter, appSettings, selMonths]);

  const fi = useMemo(() => applyFilters(interviews), [interviews, applyFilters]);
  const fo = useMemo(() => applyFilters(onboards), [onboards, applyFilters]);
  const fp = useMemo(() => applyFilters(proposals), [proposals, applyFilters]);
  const fc = useMemo(() => costs.filter(r => r.date && selMonths.has(r.date.slice(0,7))), [costs, selMonths]);

  // 채용 퍼넬 (KPI에서도 사용)
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const totalInt = fi.length;
  const attended = fi.filter(r=>r.attendance==='참석').length;
  const passed   = fi.filter(r=>r.passed==='합격').length;
  const failed   = fi.filter(r=>r.passed==='불합격').length;
  const iNames = new Set(fi.map(r=>r.name).filter(Boolean));
  const finalHired = fo.filter(r=>r.name && iNames.has(r.name)).length;

  // 비용
  const totalCost = fc.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const costPerHire = finalHired > 0 ? Math.round(totalCost/finalHired) : 0;
  const vendorCosts = {};
  fc.forEach(r => { if(r.vendor) vendorCosts[r.vendor] = (vendorCosts[r.vendor]||0)+(Number(r.amount)||0); });

  const responded = fp.filter(r=>r.result==='수락'||r.result==='거절').length;
  const accepted  = fp.filter(r=>r.result==='수락').length;
  const kpis = [
    { label:'면접자',     value:`${fi.length}명`,  sub:'선택 기간 면접', color:'var(--color-blue-light)',    ic:'var(--color-blue)' },
    { label:'입사 예정',  value:`${fo.length}명`,  sub:'교육/입사 예정', color:'var(--color-success-light)', ic:'var(--color-success)' },
    { label:'포지션 제안',value:`${fp.length}건`,  sub:'총 발송',        color:'var(--color-primary-light)', ic:'var(--color-primary)' },
    { label:'제안 응답률',value:fp.length?`${responded} (${Math.round(responded/fp.length*100)}%)`:'0 (0%)', sub:'수락+거절 응답', color:'var(--color-gold-light)',   ic:'var(--color-gold)' },
    { label:'제안 수락률',value:fp.length?`${accepted} (${Math.round(accepted/fp.length*100)}%)`:'0 (0%)',   sub:'수락 인원',     color:'var(--color-orange-light)', ic:'var(--color-orange)' },
    { label:'면접 합격',  value:`${passed}명`, sub:'합격자 수', color:'var(--color-success-light)', ic:'var(--color-success)' },
    { label:'최종 입사율',value:`${finalHired}명 (${pct(finalHired,totalInt)}%)`, sub:'면접자 → 최종입사', color:'var(--color-purple-light)', ic:'var(--color-purple)' },
  ];

  // 면접 플랫폼별 (알려진 플랫폼만 집계 — 대면/화상 등 제외)
  const platCounts = {};
  appSettings.applicantPlatforms.forEach(p => { platCounts[p] = 0; });
  fi.forEach(r => { if(r.platform && Object.prototype.hasOwnProperty.call(platCounts, r.platform)) platCounts[r.platform]++; });
  const platLabels = appSettings.applicantPlatforms.filter(k => platCounts[k] > 0);
  const platTotal = platLabels.reduce((s,k) => s + platCounts[k], 0);

  // 포지션 제안 플랫폼별
  const ppCounts = {};
  appSettings.proposalPlatforms.forEach(p => ppCounts[p]=0);
  fp.forEach(r => { if(ppCounts[r.platform]!=null) ppCounts[r.platform]++; });
  const ppLabels = appSettings.proposalPlatforms.filter(k=>ppCounts[k]>0);
  const ppTotal = ppLabels.reduce((s,k) => s + ppCounts[k], 0);

  // 담당자별 포지션 제안 횟수
  const mgrPropCounts = {};
  appSettings.managers.forEach(m => mgrPropCounts[m]=0);
  fp.forEach(r => { if(mgrPropCounts[r.manager]!=null) mgrPropCounts[r.manager]++; });

  const scaleOpts = { y:{beginAtZero:true,ticks:{stepSize:1,color:textColor},grid:{color:gridColor}}, x:{ticks:{color:textColor},grid:{display:false}} };
  const empty1 = platLabels.length===0, empty2 = ppLabels.length===0;

  return (
    <div>
      <div className="page-header"><div><div className="page-title">채용 현황 대시보드</div><div className="page-desc">월을 클릭하면 해당 기간 데이터만 반영됩니다</div></div></div>
      {sheetStatus && <div className={`sheet-status ${sheetStatus.level}`}>{sheetStatus.msg}</div>}

      {/* 부서 필터 */}
      <div className="dept-filter-bar">
        {['전체','본사','영업','F&B'].map(d=>(
          <button key={d} className={`dept-btn${deptFilter===d?' active':''}`} onClick={()=>setDeptFilter(d)}>{d}</button>
        ))}
      </div>

      {/* 월 필터 */}
      <div className="card" style={{marginBottom:16,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:'var(--text-sm)',fontWeight:600,color:'var(--color-text-muted)'}}>기간 선택</span>
          <button className="btn btn-secondary" style={{fontSize:11,padding:'2px 8px'}} onClick={toggleAll}>
            {selMonths.size===ALL_MONTHS.length?'전체 해제':'전체 선택'}
          </button>
          <span style={{fontSize:11,color:'var(--color-text-faint)'}}>({selMonths.size}개월 선택)</span>
        </div>
        <div className="month-filter-bar">
          {ALL_MONTHS.map(m=>(
            <button key={m} className={`month-btn${selMonths.has(m)?' active':''}`} onClick={()=>toggleMonth(m)}>{fmtMonthShort(m)}</button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}<span className="kpi-icon" style={{background:k.color,color:k.ic,float:'right'}}/></div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">면접 대상자 플랫폼별 현황</div>
          {empty1
            ? <div style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0',fontSize:'var(--text-sm)'}}>데이터 없음</div>
            : <>
                <ChartBox type="doughnut" data={{labels:platLabels,datasets:[{data:platLabels.map(k=>platCounts[k]),backgroundColor:CHART_COLORS,borderWidth:2,borderColor}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}} onChartClick={(idx)=>onNavigate('interview',{platform:platLabels[idx]})}/>
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
                  {platLabels.map((k,i)=>(
                    <div key={k} onClick={()=>onNavigate('interview',{platform:k})} style={{display:'flex',alignItems:'center',gap:8,fontSize:'var(--text-sm)',cursor:'pointer',borderRadius:4,padding:'2px 4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{flex:1}}>{k}</span>
                      <span style={{fontWeight:600}}>{platCounts[k]}건</span>
                      <span style={{color:'var(--color-text-muted)',minWidth:40,textAlign:'right'}}>{pct(platCounts[k],platTotal)}%</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid var(--color-divider)',marginTop:2,paddingTop:4,display:'flex',justifyContent:'space-between',fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>
                    <span>합계</span><span style={{fontWeight:600}}>{platTotal}건</span>
                  </div>
                </div>
              </>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">포지션 제안 플랫폼별 현황</div>
          {empty2
            ? <div style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0',fontSize:'var(--text-sm)'}}>데이터 없음</div>
            : <>
                <ChartBox type="doughnut" data={{labels:ppLabels,datasets:[{data:ppLabels.map(k=>ppCounts[k]),backgroundColor:CHART_COLORS,borderWidth:2,borderColor}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}} onChartClick={(idx)=>onNavigate('proposal',{platform:ppLabels[idx]})}/>
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
                  {ppLabels.map((k,i)=>(
                    <div key={k} onClick={()=>onNavigate('proposal',{platform:k})} style={{display:'flex',alignItems:'center',gap:8,fontSize:'var(--text-sm)',cursor:'pointer',borderRadius:4,padding:'2px 4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{flex:1}}>{k}</span>
                      <span style={{fontWeight:600}}>{ppCounts[k]}건</span>
                      <span style={{color:'var(--color-text-muted)',minWidth:40,textAlign:'right'}}>{pct(ppCounts[k],ppTotal)}%</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid var(--color-divider)',marginTop:2,paddingTop:4,display:'flex',justifyContent:'space-between',fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>
                    <span>합계</span><span style={{fontWeight:600}}>{ppTotal}건</span>
                  </div>
                </div>
              </>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">담당자별 포지션 제안 횟수</div>
          <ChartBox type="bar" data={{labels:Object.keys(mgrPropCounts),datasets:[{data:Object.values(mgrPropCounts),backgroundColor:CHART_COLORS.slice(0,4),borderRadius:6,borderWidth:0}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:scaleOpts}} onChartClick={(idx)=>onNavigate('proposal',{manager:Object.keys(mgrPropCounts)[idx]})}/>
        </div>
        <div className="chart-card">
          <div className="chart-title">채용 현황</div>
          <div className="funnel-grid">
            {[
              {label:'면접자',    val:totalInt,   base:totalInt,  color:'var(--color-blue)',    nav:()=>onNavigate('interview',{})},
              {label:'면접 참여', val:attended,   base:totalInt,  color:'var(--color-primary)', nav:()=>onNavigate('interview',{attendance:'참석'})},
              {label:'합격',      val:passed,     base:attended,  color:'var(--color-success)', nav:()=>onNavigate('interview',{passed:'합격'})},
              {label:'불합격',    val:failed,     base:attended,  color:'var(--color-error)',   nav:()=>onNavigate('interview',{passed:'불합격'})},
              {label:'최종 입사', val:finalHired, base:passed,    color:'var(--color-gold)',    nav:()=>onNavigate('onboard',{})},
            ].map(item=>(
              <div key={item.label} className="funnel-item" onClick={item.nav} style={{cursor:'pointer',borderRadius:6,padding:'4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div className="funnel-label">{item.label}</div>
                <div className="funnel-bar-wrap"><div className="funnel-bar-fill" style={{width:pct(item.val,item.base)+'%',background:item.color}}/></div>
                <div className="funnel-stats">{item.val}명 <span className="funnel-pct">({pct(item.val,item.base)}%)</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 채용 비용 */}
      <div className="chart-card" style={{marginTop:'var(--space-5)'}}>
        <div className="chart-title">채용 비용 현황</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div className="kpi-card">
            <div className="kpi-label">총 채용 비용</div>
            <div className="kpi-value" style={{fontSize:'var(--text-lg)'}}>{fmtAmount(totalCost)}</div>
            <div className="kpi-sub">선택 기간 합계</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">1인당 채용 비용</div>
            <div className="kpi-value" style={{fontSize:'var(--text-lg)'}}>{finalHired > 0 ? fmtAmount(costPerHire) : '-'}</div>
            <div className="kpi-sub">비용 ÷ 최종 입사자 {finalHired}명</div>
          </div>
        </div>
        {Object.keys(vendorCosts).length > 0
          ? <ChartBox type="bar"
              data={{labels:Object.keys(vendorCosts),datasets:[{data:Object.values(vendorCosts),backgroundColor:CHART_COLORS.slice(0,Object.keys(vendorCosts).length),borderRadius:6,borderWidth:0}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{color:textColor,callback:v=>v>=10000?(v/10000).toFixed(0)+'만':v},grid:{color:gridColor}},x:{ticks:{color:textColor},grid:{display:false}}}}}
            />
          : <div style={{textAlign:'center',color:'var(--color-text-faint)',fontSize:'var(--text-sm)',padding:'32px 0'}}>채용 비용 탭에서 비용을 입력하면 여기에 표시됩니다</div>
        }
      </div>

    </div>
  );
});

/* ═══════════════════════════════════════════
   INTERVIEW PAGE
═══════════════════════════════════════════ */
const InterviewPage = React.memo(function InterviewPage({ data, filter, setFilter, onUpdate, onUpdateType, onAdd, onShowMenu, appSettings }) {
  const [typeTab, setTypeTab] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneI = useRef(false);
  useEffect(() => {
    if (initDoneI.current || data.length === 0) return;
    initDoneI.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: iTbRef, grab: iGrab, init: iW } = useColResize([28,130,120,160,105,100,118,112,110,88,76,72,80,118,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.platform || r.platform === filter.platform) &&
      (!filter.attendance || r.attendance === filter.attendance) &&
      (!filter.passed || r.passed === filter.passed) &&
      (!typeTab || r.type === typeTab)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter, typeTab]
  );
  const hl = getHighlightDate(filtered);
  const hasActiveFilter = filter.platform || filter.attendance || filter.passed || filter.manager || filter.search;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">면접 일정</div><div className="page-desc">면접 예정자 목록 및 일정 관리</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="tabs">
        {[['','전체'],['지원자','지원자'],['포지션 제안자','포지션 제안자']].map(([v,label]) => (
          <button key={v} className={`tab-btn ${typeTab===v?'active':''}`} onClick={()=>setTypeTab(v)}>{label}</button>
        ))}
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/>
          <input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/>
        </div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}>
          <option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}
        </select>
        <span className="filter-label">플랫폼</span>
        <select className="filter-select" value={filter.platform||''} onChange={e=>setFilter(f=>({...f,platform:e.target.value}))}>
          <option value="">전체</option>{appSettings.applicantPlatforms.map(p=><option key={p}>{p}</option>)}
        </select>
        <span className="filter-label">참석</span>
        <select className="filter-select" value={filter.attendance||''} onChange={e=>setFilter(f=>({...f,attendance:e.target.value}))}>
          <option value="">전체</option><option>참석</option><option>참석확인</option><option>불참</option><option>확인중</option>
        </select>
        <span className="filter-label">합격</span>
        <select className="filter-select" value={filter.passed||''} onChange={e=>setFilter(f=>({...f,passed:e.target.value}))}>
          <option value="">전체</option><option>합격</option><option>불합격</option>
        </select>
        {hasActiveFilter && (
          <button className="btn btn-secondary" style={{marginLeft:4}} onClick={()=>setFilter({search:'',manager:'',platform:'',attendance:'',passed:''})}>필터 초기화</button>
        )}
      </div>
      <div className="table-wrap">
        <table ref={iTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{iW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','유형','플랫폼','면접일','면접시간','면접관','담당자','참석여부','합격여부','안내여부','입사예정일','비고'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>iGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={14}><div className="empty-state"><p>등록된 면접 일정이 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={15} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => {
                    const plats = r.type==='포지션 제안자' ? appSettings.proposalPlatforms : appSettings.applicantPlatforms;
                    return (
                      <tr key={r.id} className={r.date===hl?'row-today':''}>
                        <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'interview')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                        <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                        <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                        <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                        <td><select className="inline-select" value={r.type} onChange={e=>onUpdateType(r.id,e.target.value)}><option value="">선택</option><option>지원자</option><option>포지션 제안자</option></select></td>
                        <td><select className="inline-select" value={r.platform} onChange={e=>onUpdate(r.id,'platform',e.target.value)}>{plats.map(p=><option key={p}>{p}</option>)}</select></td>
                        <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                        <td><input className="inline-input" type="time" value={r.time||''} onChange={e=>onUpdate(r.id,'time',e.target.value)}/></td>
                        <td><InlineText value={r.interviewer} onSave={v=>onUpdate(r.id,'interviewer',v)}/></td>
                        <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                        <td><select className="inline-select" value={r.attendance||''} onChange={e=>onUpdate(r.id,'attendance',e.target.value)}><option value="">-</option><option>확인중</option><option>불참</option><option>참석확인</option><option>참석</option></select></td>
                        <td><select className="inline-select" value={r.passed||''} onChange={e=>onUpdate(r.id,'passed',e.target.value)}><option value="">-</option><option>불합격</option><option>합격</option></select></td>
                        <td><select className="inline-select" value={r.guided||''} onChange={e=>onUpdate(r.id,'guided',e.target.value)}><option value="">-</option><option>안내완료</option><option>미안내</option></select></td>
                        <td><input className="inline-input" type="date" value={r.startDate||''} onChange={e=>onUpdate(r.id,'startDate',e.target.value)}/></td>
                        <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   ONBOARD PAGE
═══════════════════════════════════════════ */
const OnboardPage = React.memo(function OnboardPage({ data, filter, setFilter, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneO = useRef(false);
  useEffect(() => {
    if (initDoneO.current || data.length === 0) return;
    initDoneO.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: oTbRef, grab: oGrab, init: oW } = useColResize([28,130,120,160,118,88,90,72,84,80,76,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.status || r.status === filter.status)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter]
  );
  const hl = getHighlightDate(filtered);
  const yesNoSel = (val, field, id) => (
    <select className="inline-select" value={val||''} onChange={e=>onUpdate(id,field,e.target.value)}>
      <option value="">-</option><option>완료</option><option>미완료</option>
    </select>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">교육 및 입사자</div><div className="page-desc">합격자 입사 일정 및 교육 현황</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/><input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/></div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}><option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select>
        <span className="filter-label">상태</span>
        <select className="filter-select" value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}><option value="">전체</option><option>입사 예정</option><option>교육 중</option><option>입사 완료</option><option>입사 취소</option></select>
      </div>
      <div className="table-wrap">
        <table ref={oTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{oW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','입사예정일','담당자','상태','참석여부','이메일생성','FLEX가입','계약서','비고'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>oGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={11}><div className="empty-state"><p>등록된 입사자가 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={12} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => (
                    <tr key={r.id} className={r.date===hl?'row-today':''}>
                      <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'onboard')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                      <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                      <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                      <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                      <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                      <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                      <td><select className="inline-select" value={r.status} onChange={e=>onUpdate(r.id,'status',e.target.value)}>{['입사 예정','교육 중','입사 완료','입사 취소'].map(s=><option key={s}>{s}</option>)}</select></td>
                      <td><select className="inline-select" value={r.attendance||''} onChange={e=>onUpdate(r.id,'attendance',e.target.value)}><option value="">-</option><option>참석</option><option>불참</option></select></td>
                      <td>{yesNoSel(r.emailCreated,'emailCreated',r.id)}</td>
                      <td>{yesNoSel(r.flexJoined,'flexJoined',r.id)}</td>
                      <td>{yesNoSel(r.contractSigned,'contractSigned',r.id)}</td>
                      <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   PROPOSAL PAGE
═══════════════════════════════════════════ */
const ProposalPage = React.memo(function ProposalPage({ data, filter, setFilter, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneP = useRef(false);
  useEffect(() => {
    if (initDoneP.current || data.length === 0) return;
    initDoneP.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: pTbRef, grab: pGrab, init: pW } = useColResize([28,130,120,160,100,88,118,80,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.platform || r.platform === filter.platform) &&
      (!filter.result || r.result === filter.result)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter]
  );
  const hl = getHighlightDate(filtered);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">포지션 제안 O/B 현황</div><div className="page-desc">담당자별 포지션 제안 내역 관리</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/><input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/></div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}><option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select>
        <span className="filter-label">플랫폼</span>
        <select className="filter-select" value={filter.platform} onChange={e=>setFilter(f=>({...f,platform:e.target.value}))}><option value="">전체</option>{appSettings.proposalPlatforms.map(p=><option key={p}>{p}</option>)}</select>
        <span className="filter-label">결과</span>
        <select className="filter-select" value={filter.result} onChange={e=>setFilter(f=>({...f,result:e.target.value}))}><option value="">전체</option><option>대기</option><option>응답</option><option>미응답</option><option>거절</option><option>면접진행</option></select>
      </div>
      <div className="table-wrap">
        <table ref={pTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{pW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','플랫폼','담당자','제안일','결과','메모'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>pGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={8}><div className="empty-state"><p>등록된 포지션 제안이 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={9} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => (
                    <tr key={r.id} className={r.date===hl?'row-today':''}>
                      <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'proposal')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                      <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                      <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                      <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                      <td><select className="inline-select" value={r.platform} onChange={e=>onUpdate(r.id,'platform',e.target.value)}>{appSettings.proposalPlatforms.map(p=><option key={p}>{p}</option>)}</select></td>
                      <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                      <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                      <td><select className="inline-select" value={r.result} onChange={e=>onUpdate(r.id,'result',e.target.value)}>{['대기','수락','거절','면접진행'].map(s=><option key={s}>{s}</option>)}</select></td>
                      <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════ */
const SettingsPage = React.memo(function SettingsPage({ settings, onUpdate }) {
  const [inputs, setInputs] = useState({});
  const setInput = (cat, val) => setInputs(p => ({...p, [cat]: val}));
  const addItem = (cat) => {
    const w = (inputs[cat]||'').trim();
    if (!w || (settings[cat]||[]).includes(w)) return;
    onUpdate({ ...settings, [cat]: [...(settings[cat]||[]), w] });
    setInput(cat, '');
  };
  const removeItem = (cat, idx) => onUpdate({ ...settings, [cat]: (settings[cat]||[]).filter((_,i)=>i!==idx) });

  const Section = ({ cat, label, emoji, tagCls, placeholder }) => (
    <div className="card" style={{marginBottom:12}}>
      <div className="card-title">{emoji} {label}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10,minHeight:28}}>
        {(settings[cat]||[]).map((k,i)=>(
          <span key={i} className={`dept-tag ${tagCls||'dept-hq'}`}>{k}
            <button onClick={()=>removeItem(cat,i)} style={{marginLeft:4,opacity:.6,fontSize:12}}>×</button>
          </span>
        ))}
        {(settings[cat]||[]).length===0 && <span style={{fontSize:'var(--text-sm)',color:'var(--color-text-faint)'}}>항목 없음</span>}
      </div>
      <div style={{display:'flex',gap:8}}>
        <input className="search-input" style={{flex:1}} value={inputs[cat]||''}
          onChange={e=>setInput(cat,e.target.value)}
          placeholder={placeholder||'항목 입력 후 Enter...'}
          onKeyDown={e=>e.key==='Enter'&&addItem(cat)}/>
        <button className="btn btn-secondary" onClick={()=>addItem(cat)}>추가</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">설정</div><div className="page-desc">드롭다운 항목 및 부서 분류 키워드를 관리합니다</div></div>
      </div>

      <div className="settings-section-label">부서 분류 키워드</div>
      <Section cat="sales" label="영업 — 직무 포함 키워드" emoji="🏪" tagCls="dept-sales" placeholder="키워드 입력 후 Enter..."/>
      <Section cat="fnb"   label="F&B — 직무 포함 키워드"  emoji="🍽️" tagCls="dept-fnb"  placeholder="키워드 입력 후 Enter..."/>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-title">🏢 본사</div>
        <p style={{fontSize:'var(--text-sm)',color:'var(--color-text-muted)'}}>영업 / F&B 키워드에 해당하지 않는 모든 직무는 자동으로 본사로 분류됩니다.</p>
      </div>

      <div className="settings-section-label">드롭다운 항목 관리</div>
      <Section cat="managers"          label="담당자 목록"    emoji="👤"/>
      <Section cat="applicantPlatforms" label="지원자 플랫폼"  emoji="📋"/>
      <Section cat="proposalPlatforms"  label="제안 플랫폼"    emoji="📤"/>
      <Section cat="costVendors"        label="채용 비용 업체" emoji="💳"/>
      <Section cat="costNotes"          label="채용 비용 비고 (사업장)" emoji="📝" placeholder="사업장명 입력 후 Enter..."/>
    </div>
  );
});

/* ═══════════════════════════════════════════
   COST PAGE
═══════════════════════════════════════════ */
const COST_PLAT_TABS = ['전체', '사람인', '잡코리아', '원티드', '리멤버', '알바몬'];

const CostPage = React.memo(function CostPage({ data, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [vendorTab, setVendorTab] = useState('전체');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { tbRef: cTbRef, grab: cGrab, init: cW } = useColResize([28, 80, 110, 110, 130, 200, 100, 110, 170]);
  const isAll = vendorTab === '전체';

  const filtered = useMemo(() => {
    let rows = [...data];
    if (!isAll) rows = rows.filter(r => r.vendor === vendorTab);
    if (dateFrom) rows = rows.filter(r => r.date >= dateFrom);
    if (dateTo) rows = rows.filter(r => r.date <= dateTo);
    return rows.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [data, vendorTab, isAll, dateFrom, dateTo]);

  const totalAmount = filtered.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const vendorTotals = {};
  if (isAll) filtered.forEach(r => { if(r.vendor) vendorTotals[r.vendor] = (vendorTotals[r.vendor]||0)+(Number(r.amount)||0); });

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">채용 비용</div><div className="page-desc">플랫폼별 채용 광고 비용 관리</div></div>
        {!isAll && <button className="btn btn-primary" onClick={()=>onAdd(vendorTab)}><Plus size={14}/> 행 추가</button>}
      </div>

      <div className="tabs">
        {COST_PLAT_TABS.map(tab=>(
          <button key={tab} className={`tab-btn ${vendorTab===tab?'active':''}`} onClick={()=>setVendorTab(tab)}>{tab}</button>
        ))}
      </div>

      <div className={`cost-notice${isAll?'':' editable'}`}>
        {isAll
          ? '전체 보기입니다. 내용을 수정하려면 각 플랫폼 탭을 선택하세요.'
          : `${vendorTab} 탭 — 행 추가 및 수정이 가능합니다.`}
      </div>

      <div className="cost-summary-bar">
        <div className="cost-summary-card cost-summary-total">
          <span className="cost-summary-label">합계</span>
          <span className="cost-summary-value">{fmtAmount(totalAmount)}</span>
        </div>
        {isAll && Object.entries(vendorTotals).sort((a,b)=>b[1]-a[1]).map(([v,amt])=>(
          <div key={v} className="cost-summary-card">
            <span className="cost-summary-label">{v}</span>
            <span className="cost-summary-value">{fmtAmount(amt)}</span>
          </div>
        ))}
      </div>

      <div className="table-toolbar">
        <span className="filter-label">결제일</span>
        <input className="filter-select" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:130}}/>
        <span style={{color:'var(--color-text-muted)',fontSize:'var(--text-sm)'}}>~</span>
        <input className="filter-select" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:130}}/>
        {(dateFrom||dateTo) && <button className="btn btn-secondary" onClick={()=>{setDateFrom('');setDateTo('');}}>초기화</button>}
        <span style={{marginLeft:'auto',fontSize:'var(--text-sm)',color:'var(--color-text-muted)'}}>{filtered.length}건</span>
      </div>

      <div className="table-wrap">
        <table ref={cTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{cW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['구분','업체명','분류','금액','구매 내용','비고','결제일','유료 진행기간'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>cGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={9}><div className="empty-state"><p>등록된 비용 내역이 없습니다</p></div></td></tr>
              : filtered.map(r=>(
                <tr key={r.id}>
                  <td className="row-handle-cell">
                    {!isAll && <div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'cost')} onMouseLeave={()=>onShowMenu(null)}>⋮</div>}
                  </td>
                  {isAll ? (
                    <>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.category||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.vendor||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.classification||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px',textAlign:'right'}}>{r.amount?Number(r.amount).toLocaleString('ko-KR'):'0'}원</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.description||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.note||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.date||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.period||'-'}</td>
                    </>
                  ) : (
                    <>
                      <td><InlineText value={r.category} onSave={v=>onUpdate(r.id,'category',v)} placeholder="채용"/></td>
                      <td>
                        <select className="inline-select" value={r.vendor||''} onChange={e=>onUpdate(r.id,'vendor',e.target.value)}>
                          <option value="">선택</option>
                          {appSettings.costVendors.map(p=><option key={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="inline-select" value={r.classification||''} onChange={e=>onUpdate(r.id,'classification',e.target.value)}>
                          <option value="">선택</option>
                          <option>포지션 제안</option>
                          <option>유료 채용 공고</option>
                          <option>기타</option>
                        </select>
                      </td>
                      <td><AmountInput value={r.amount} onSave={v=>onUpdate(r.id,'amount',v)}/></td>
                      <td><InlineText value={r.description} onSave={v=>onUpdate(r.id,'description',v)} placeholder="구매 내용"/></td>
                      <td>
                        <select className="inline-select" value={r.note||''} onChange={e=>onUpdate(r.id,'note',e.target.value)}>
                          <option value="">-</option>
                          {(appSettings.costNotes||[]).map(n=><option key={n}>{n}</option>)}
                        </select>
                      </td>
                      <td><DateInput value={r.date||''} onSave={v=>onUpdate(r.id,'date',v)}/></td>
                      <td><InlineText value={r.period} onSave={v=>onUpdate(r.id,'period',v)} placeholder="2025-06-01~2025-06-30"/></td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{background:'var(--color-surface-offset)',fontWeight:600}}>
                <td colSpan={4} style={{textAlign:'right',fontSize:12,padding:'6px 12px',color:'var(--color-text-muted)'}}>합계</td>
                <td style={{fontSize:12,padding:'6px 12px',textAlign:'right'}}>{fmtAmount(totalAmount)}</td>
                <td colSpan={4}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function ClientApp() {
  const [interviews, setInterviews] = useState(DEFAULT_INTERVIEWS);
  const [onboards, setOnboards] = useState(DEFAULT_ONBOARDS);
  const [proposals, setProposals] = useState(DEFAULT_PROPOSALS);
  const [costs, setCosts] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('appSettings'));
      if (saved) return { ...DEFAULT_APP_SETTINGS, ...saved };
      const old = JSON.parse(localStorage.getItem('deptSettings'));
      if (old) return { ...DEFAULT_APP_SETTINGS, sales: old.sales||DEFAULT_APP_SETTINGS.sales, fnb: old.fnb||DEFAULT_APP_SETTINGS.fnb };
    } catch {}
    return DEFAULT_APP_SETTINGS;
  });
  const updateAppSettings = useCallback(s => { setAppSettings(s); localStorage.setItem('appSettings', JSON.stringify(s)); }, []);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, id, type }
  const menuTimerRef = useRef(null);
  const [, startTransition] = useTransition();
  const [filterI, setFilterI] = useState({ search:'', manager:'', platform:'', attendance:'', passed:'' });
  const [filterO, setFilterO] = useState({ search:'', manager:'', status:'' });
  const [filterP, setFilterP] = useState({ search:'', manager:'', platform:'', result:'' });

  // 현재 state의 최신값을 insertRow에서 참조하기 위한 ref
  const stateRef = useRef({ interviews: DEFAULT_INTERVIEWS, onboards: DEFAULT_ONBOARDS, proposals: DEFAULT_PROPOSALS, costs: [] });
  useEffect(() => { stateRef.current = { interviews, onboards, proposals, costs }; }, [interviews, onboards, proposals, costs]);

  // 서버에서 데이터 로드 — 실패 시 2초 간격으로 최대 8회 재시도
  useEffect(() => {
    let cancelled = false;
    const tryLoad = async (attempt = 0) => {
      try {
        const { interviews: i, onboards: o, proposals: p, costs: c } = await loadData();
        if (cancelled) return;
        startTransition(() => {
          setInterviews(i);
          setOnboards(o);
          setProposals(p);
          if (c) setCosts(c);
        });
        setSheetStatus({ msg: '서버에서 데이터를 불러왔습니다.', level: 'success' });
      } catch (err) {
        if (cancelled) return;
        if (attempt < 8) {
          setSheetStatus({ msg: `서버 연결 중... (${attempt + 1}/8)`, level: 'info' });
          setTimeout(() => tryLoad(attempt + 1), 2000);
        } else {
          setSheetStatus({ msg: `서버 연결 실패: ${err.message}`, level: 'error' });
        }
      }
    };
    tryLoad();
    return () => { cancelled = true; };
  }, []);

  // Theme
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Close context menu on click
  useEffect(() => {
    const close = () => { setContextMenu(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Update (낙관적 업데이트: UI 즉시 반영 후 서버 저장) ──
  const updateInterview = useCallback((id, field, value) => {
    setInterviews(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('interviews', id, { [field]: value }).catch(console.error);
  }, []);
  const updateInterviewType = useCallback((id, type) => {
    const platform = (type==='포지션 제안자' ? appSettings.proposalPlatforms : appSettings.applicantPlatforms)[0] || '사람인';
    setInterviews(p => p.map(r => r.id===id ? {...r, type, platform} : r));
    apiUpdate('interviews', id, { type, platform }).catch(console.error);
  }, [appSettings]);
  const updateOnboard = useCallback((id, field, value) => {
    setOnboards(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('onboards', id, { [field]: value }).catch(console.error);
  }, []);
  const updateProposal = useCallback((id, field, value) => {
    setProposals(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('proposals', id, { [field]: value }).catch(console.error);
  }, []);
  const updateCost = useCallback((id, field, value) => {
    setCosts(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('costs', id, { [field]: value }).catch(console.error);
  }, []);

  // ── Add row (낙관적: 즉시 표시 → 서버 ID로 교체는 startTransition) ──
  const addInterviewRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',type:'지원자',platform:'사람인',date:today(),time:'',interviewer:'',manager:'',status:'면접예정',guided:'',startDate:'',memo:'',attendance:'',passed:''};
    setInterviews(p => [row, ...p]);
    const saved = await apiAdd('interviews', row).catch(console.error);
    if (saved) startTransition(() => setInterviews(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addOnboardRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',date:today(),manager:'',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:''};
    setOnboards(p => [row, ...p]);
    const saved = await apiAdd('onboards', row).catch(console.error);
    if (saved) startTransition(() => setOnboards(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addProposalRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',platform:'사람인',manager:'',date:today(),result:'대기',memo:''};
    setProposals(p => [row, ...p]);
    const saved = await apiAdd('proposals', row).catch(console.error);
    if (saved) startTransition(() => setProposals(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addCostRow = useCallback(async (vendor='') => {
    const tid = -Date.now();
    const row = {id:tid,category:'채용',vendor:vendor||'',classification:'',amount:0,description:'',note:'',date:today(),period:''};
    setCosts(p => [row, ...p]);
    const saved = await apiAdd('costs', row).catch(console.error);
    if (saved) startTransition(() => setCosts(p => p.map(r => r.id===tid ? saved : r)));
  }, []);

  // ── Context menu ──
  const showMenu = useCallback((e, id, type) => {
    clearTimeout(menuTimerRef.current);
    if (!e) {
      menuTimerRef.current = setTimeout(() => setContextMenu(null), 180);
      return;
    }
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.right+4, y: rect.top-4, id, type });
  }, []);

  const insertRow = useCallback(async (type, refId, pos) => {
    setContextMenu(null);
    const { interviews: iArr, onboards: oArr, proposals: pArr, costs: cArr } = stateRef.current;
    const tid = -Date.now();
    let row, apiType, setter;
    if (type==='interview') {
      const ref = iArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',type:'지원자',platform:'사람인',date:ref?.date||today(),time:'',interviewer:'',manager:ref?.manager||'',status:'면접예정',guided:'',startDate:'',memo:'',attendance:'',passed:''};
      apiType = 'interviews'; setter = setInterviews;
    } else if (type==='onboard') {
      const ref = oArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',date:ref?.date||today(),manager:ref?.manager||'',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:''};
      apiType = 'onboards'; setter = setOnboards;
    } else if (type==='cost') {
      const ref = cArr.find(r=>r.id===refId);
      row = {id:tid,category:ref?.category||'채용',vendor:ref?.vendor||'',classification:ref?.classification||'',amount:0,description:'',note:ref?.note||'',date:ref?.date||today(),period:''};
      apiType = 'costs'; setter = setCosts;
    } else {
      const ref = pArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',platform:ref?.platform||'사람인',manager:ref?.manager||'',date:ref?.date||today(),result:'대기',memo:''};
      apiType = 'proposals'; setter = setProposals;
    }
    setter(p => { const idx=p.findIndex(r=>r.id===refId); const next=[...p]; next.splice(pos==='above'?idx:idx+1,0,row); return next; });
    const saved = await apiInsert(apiType, row, refId, pos).catch(console.error);
    if (saved) startTransition(() => setter(p => p.map(r => r.id===tid ? saved : r)));
  }, []);

  const copyRow = useCallback((type, id) => {
    setContextMenu(null);
    const { interviews: iArr, onboards: oArr, proposals: pArr, costs: cArr } = stateRef.current;
    const arr = type==='interview'?iArr : type==='onboard'?oArr : type==='cost'?cArr : pArr;
    const setter = type==='interview'?setInterviews : type==='onboard'?setOnboards : type==='cost'?setCosts : setProposals;
    const apiType = type==='interview'?'interviews' : type==='onboard'?'onboards' : type==='cost'?'costs' : 'proposals';
    const ref = arr.find(r=>r.id===id);
    if (!ref) return;
    const tid = -Date.now();
    const { id:_, ...rest } = ref;
    const newRow = {...rest, id:tid};
    setter(p => { const n=[...p]; n.splice(n.findIndex(r=>r.id===id)+1,0,newRow); return n; });
    apiInsert(apiType, rest, id, 'below')
      .then(saved => { if (saved) startTransition(()=>setter(p=>p.map(r=>r.id===tid?saved:r))); })
      .catch(console.error);
  }, []);

  const deleteRow = useCallback((type, id) => {
    setContextMenu(null);
    const setter = type==='interview'?setInterviews : type==='onboard'?setOnboards : type==='cost'?setCosts : setProposals;
    setter(p=>p.filter(r=>r.id!==id));
    const apiType = type==='interview'?'interviews' : type==='onboard'?'onboards' : type==='cost'?'costs' : 'proposals';
    apiDelete(apiType, id).catch(console.error);
  }, []);

  const pageTitles = { dashboard:'대시보드', interview:'면접 일정', onboard:'교육 및 입사자', proposal:'포지션 제안 O/B', cost:'채용 비용', settings:'설정' };

  const nav = (p) => { setPage(p); setSidebarOpen(false); };

  const navigateWithFilter = useCallback((targetPage, filters) => {
    if (targetPage === 'interview') {
      setFilterI({ search:'', manager:'', platform:'', attendance:'', passed:'', ...filters });
    } else if (targetPage === 'proposal') {
      setFilterP({ search:'', manager:'', platform:'', result:'', ...filters });
    } else if (targetPage === 'onboard') {
      setFilterO({ search:'', manager:'', status:'', ...filters });
    }
    setPage(targetPage);
    setSidebarOpen(false);
  }, []);

  return (
    <div className="app-wrapper" onClick={()=>setContextMenu(null)}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="var(--color-primary)"/>
            <path d="M8 20V10l6-3 6 3v10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="11" y="14" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.8"/>
            <path d="M14 14v-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="sidebar-logo-text">채용관리</div>
            <div className="sidebar-logo-sub">인사팀 포털</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">메인</div>
          <button className={`nav-item ${page==='dashboard'?'active':''}`} onClick={()=>nav('dashboard')}><LayoutDashboard size={16}/> 대시보드</button>
          <div className="nav-divider"/>
          <div className="nav-section-label">채용 관리</div>
          <button className={`nav-item ${page==='interview'?'active':''}`} onClick={()=>nav('interview')}><CalendarCheck size={16}/> 면접 일정<span className="nav-count">{interviews.length}</span></button>
          <button className={`nav-item ${page==='onboard'?'active':''}`} onClick={()=>nav('onboard')}><UserCheck size={16}/> 교육 및 입사자<span className="nav-count">{onboards.length}</span></button>
          <button className={`nav-item ${page==='proposal'?'active':''}`} onClick={()=>nav('proposal')}><Send size={16}/> 포지션 제안 현황<span className="nav-count">{proposals.length}</span></button>
          <button className={`nav-item ${page==='cost'?'active':''}`} onClick={()=>nav('cost')}><Receipt size={16}/> 채용 비용<span className="nav-count">{costs.length}</span></button>
          <div className="nav-divider"/>
          <button className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>nav('settings')}><Settings size={16}/> 설정</button>
        </nav>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop open" onClick={()=>setSidebarOpen(false)}/>}

      {/* Main */}
      <div className="main-area">
        <header className="topbar">
          <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}><Menu size={18}/></button>
          <div className="topbar-title">{pageTitles[page]}</div>
          <div className="topbar-actions">
            <button className="btn btn-secondary" style={{whiteSpace:'nowrap'}} onClick={async()=>{
              setSheetStatus({msg:'구글 시트에서 동기화 중...', level:'info'});
              try {
                const r = await apiSync();
                const data = await import('@/lib/sheets').then(m => m.loadData());
                setInterviews(data.interviews); setOnboards(data.onboards); setProposals(data.proposals);
                if (data.costs) setCosts(data.costs);
                setSheetStatus({msg:`동기화 완료: 면접 ${r.counts.interviews}건, 입사자 ${r.counts.onboards}건, 제안 ${r.counts.proposals}건`, level:'success'});
              } catch(e) { setSheetStatus({msg:`동기화 실패: ${e.message}`, level:'error'}); }
            }}>🔄 시트 동기화</button>
            <button className="theme-toggle" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>
              {theme==='dark' ? <Sun size={18}/> : <Moon size={18}/>}
            </button>
          </div>
        </header>

        <div className="content-area">
          {page==='dashboard' && <DashboardPage interviews={interviews} onboards={onboards} proposals={proposals} costs={costs} sheetStatus={sheetStatus} theme={theme} appSettings={appSettings} onNavigate={navigateWithFilter}/>}
          {page==='interview' && <InterviewPage data={interviews} filter={filterI} setFilter={setFilterI} onUpdate={updateInterview} onUpdateType={updateInterviewType} onAdd={addInterviewRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='onboard' && <OnboardPage data={onboards} filter={filterO} setFilter={setFilterO} onUpdate={updateOnboard} onAdd={addOnboardRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='proposal' && <ProposalPage data={proposals} filter={filterP} setFilter={setFilterP} onUpdate={updateProposal} onAdd={addProposalRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='cost' && <CostPage data={costs} onUpdate={updateCost} onAdd={addCostRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='settings' && <SettingsPage settings={appSettings} onUpdate={updateAppSettings}/>}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="row-context-menu" style={{left:contextMenu.x, top:contextMenu.y}} onClick={e=>e.stopPropagation()} onMouseEnter={()=>clearTimeout(menuTimerRef.current)} onMouseLeave={()=>{menuTimerRef.current=setTimeout(()=>setContextMenu(null),180)}}>
          <button className="rcm-btn" onClick={()=>insertRow(contextMenu.type,contextMenu.id,'above')}>↑ 위에 행 추가</button>
          <button className="rcm-btn" onClick={()=>insertRow(contextMenu.type,contextMenu.id,'below')}>↓ 아래에 행 추가</button>
          <button className="rcm-btn" onClick={()=>copyRow(contextMenu.type,contextMenu.id)}>⎘ 행 복사</button>
          <div className="rcm-divider"/>
          <button className="rcm-btn danger" onClick={()=>deleteRow(contextMenu.type,contextMenu.id)}>✕ 행 삭제</button>
        </div>
      )}
    </div>
  );
}
