import { createAdminClient } from './supabase';

export const VALID_TYPES = ['interviews', 'onboards', 'proposals', 'costs', 'jds'];

export async function getData(type) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hr_data')
    .select('data')
    .eq('type', type);
  if (error) throw new Error(error.message);
  return data?.[0]?.data ?? [];
}

export async function setData(type, rows) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('hr_data')
    .update({ data: rows })
    .eq('type', type);
  if (error) throw new Error(error.message);
}

export function nextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}
