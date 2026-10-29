import { routeState } from '../route-state';

const base = { sessionLoading: false, hasSession: true, profileStatus: 'success' as const };

test.each([
  ['session loading', { ...base, sessionLoading: true, profile: undefined }, 'loading'],
  [
    'no session',
    { ...base, hasSession: false, profileStatus: 'pending' as const, profile: undefined },
    'guest',
  ],
  [
    'profile loading',
    { ...base, profileStatus: 'pending' as const, profile: undefined },
    'loading',
  ],
  ['profile failed', { ...base, profileStatus: 'error' as const, profile: undefined }, 'error'],
  ['no profile', { ...base, profile: null }, 'needs-onboarding'],
  ['not onboarded', { ...base, profile: { onboarded_at: null } }, 'needs-onboarding'],
  ['onboarded', { ...base, profile: { onboarded_at: '2026-10-28T00:00:00Z' } }, 'ready'],
])('%s → %s', (_name, input, expected) => {
  expect(routeState(input)).toBe(expected);
});
