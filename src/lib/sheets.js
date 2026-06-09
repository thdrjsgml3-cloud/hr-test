const API = '/api';

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
  return res.json();
}

export async function loadData() {
  const [interviews, onboards, proposals, costs, jds, jdSettingsRaw, jdReports] = await Promise.all([
    apiFetch(`${API}/interviews`),
    apiFetch(`${API}/onboards`),
    apiFetch(`${API}/proposals`),
    apiFetch(`${API}/costs`),
    apiFetch(`${API}/jds`),
    apiFetch(`${API}/jd_settings`).catch(() => null),
    apiFetch(`${API}/jd_reports`).catch(() => []),
  ]);
  const jdSettings = (!jdSettingsRaw || Array.isArray(jdSettingsRaw) && jdSettingsRaw.length === 0) ? null : jdSettingsRaw;
  return { interviews, onboards, proposals, costs, jds, jdSettings, jdReports: Array.isArray(jdReports) ? jdReports : [] };
}

export function apiSaveJdSettings(settings) {
  return apiFetch(`${API}/jd_settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export function apiSaveJdReports(reports) {
  return apiFetch(`${API}/jd_reports`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reports),
  });
}

export function apiSaveAllJDs(rows) {
  return apiFetch(`${API}/jds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
}

export function apiUpdate(type, id, fields) {
  return apiFetch(`${API}/${type}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export function apiAdd(type, row) {
  return apiFetch(`${API}/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

export function apiInsert(type, row, refId, pos) {
  return apiFetch(`${API}/${type}/insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, refId, pos }),
  });
}

export function apiDelete(type, id) {
  return apiFetch(`${API}/${type}/${id}`, { method: 'DELETE' });
}

export function apiSync() {
  return apiFetch(`${API}/sync`, { method: 'POST' });
}
