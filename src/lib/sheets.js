const API = '/api';

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
  return res.json();
}

export async function loadData() {
  const [interviews, onboards, proposals, costs] = await Promise.all([
    apiFetch(`${API}/interviews`),
    apiFetch(`${API}/onboards`),
    apiFetch(`${API}/proposals`),
    apiFetch(`${API}/costs`),
  ]);
  return { interviews, onboards, proposals, costs };
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
