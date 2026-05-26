export function today() {
  return new Date().toISOString().split('T')[0];
}

export function normalizeDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (value.includes('Date(')) {
      const match = value.match(/Date\((\d+),(\d+),(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const month = String(parseInt(match[2]) + 1).padStart(2, '0');
        const day = String(parseInt(match[3])).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    const trimmed = value.trim();
    if (trimmed.match(/^\d{4}\.\d{2}\.\d{2}$/)) return trimmed.replace(/\./g, '-');
    return trimmed;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function mapYesNo(val) {
  if (!val) return '';
  const v = String(val).trim();
  if (['O','o','완료','Y','y'].includes(v)) return '완료';
  if (['X','x','미완료','N','n'].includes(v)) return '미완료';
  return v;
}

export function mapAttendance(val) {
  if (!val) return '';
  const v = String(val).trim();
  if (['O','참석','Y'].includes(v)) return '참석';
  if (['X','불참','N'].includes(v)) return '불참';
  return v;
}

export function getHighlightDate(data) {
  const t = today();
  if (data.some(r => r.date === t)) return t;
  const upcoming = data.filter(r => r.date >= t).map(r => r.date);
  return upcoming.length ? upcoming.reduce((min, d) => d < min ? d : min) : null;
}

export function newId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}
