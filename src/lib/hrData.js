import { createClient } from './supabase';

export const VALID_TYPES = ['interviews', 'onboards', 'proposals', 'costs'];

export async function getData(type) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('hr_data')
    .select('data')
    .eq('type', type)
    .single();
  if (error) throw new Error(error.message);
  return data?.data ?? [];
}

export async function setData(type, rows) {
  const supabase = createClient();
  const { error } = await supabase
    .from('hr_data')
    .upsert({ type, data: rows });
  if (error) throw new Error(error.message);
}

export function nextId(arr) {
  return arr.length ? Math.max(...arr.map(r => r.id)) + 1 : 1;
}
