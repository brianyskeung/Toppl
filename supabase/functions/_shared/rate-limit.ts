import type { SupabaseClient } from '@supabase/supabase-js';

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// shortcut: trusts the first x-forwarded-for hop, which a client can spoof; CAPTCHA
// (planned before release) is the real abuse control.
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

/** Records an attempt for `key` and returns false once it exceeds `max` per `window`. */
export async function allowAttempt(
  admin: SupabaseClient,
  key: string,
  action: string,
  max: number,
  window: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('record_auth_attempt', {
    p_ip_hash: await sha256(key),
    p_action: action,
    p_max: max,
    p_window: window,
  });
  if (error) throw error;
  return data === true;
}
