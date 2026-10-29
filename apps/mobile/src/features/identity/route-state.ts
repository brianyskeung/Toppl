export type RouteState = 'loading' | 'error' | 'guest' | 'needs-onboarding' | 'ready';

type Input = {
  sessionLoading: boolean;
  hasSession: boolean;
  profileStatus: 'pending' | 'error' | 'success';
  profile: { onboarded_at: string | null } | null | undefined;
};

/** Decides which part of the app a user may see. Missing or unfinished profiles need onboarding. */
export function routeState({
  sessionLoading,
  hasSession,
  profileStatus,
  profile,
}: Input): RouteState {
  if (sessionLoading) return 'loading';
  if (!hasSession) return 'guest';
  if (profileStatus === 'pending') return 'loading';
  if (profileStatus === 'error') return 'error';
  if (!profile || !profile.onboarded_at) return 'needs-onboarding';
  return 'ready';
}
