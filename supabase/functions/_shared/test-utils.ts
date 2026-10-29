// Helpers for Deno tests that call functions served by local Supabase (`supabase start`).
// Env comes from `supabase status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY, MAILPIT_URL).
import { createClient } from '@supabase/supabase-js';

export const API_URL = Deno.env.get('API_URL') ?? 'http://127.0.0.1:54321';
export const ANON_KEY = Deno.env.get('ANON_KEY')!;
export const MAILPIT_URL = Deno.env.get('MAILPIT_URL') ?? Deno.env.get('INBUCKET_URL') ??
  'http://127.0.0.1:54324';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

export const admin = createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function randomIp(): string {
  return `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 255)).join('.')}`;
}

export function randomUsername(): string {
  return `t_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export async function callFunction(
  name: string,
  body: unknown,
  { ip = randomIp(), token = ANON_KEY }: { ip?: string; token?: string } = {},
) {
  const res = await fetch(`${API_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

export async function deleteUserByUsername(username: string) {
  const { data } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (data) await admin.auth.admin.deleteUser(data.id);
}
