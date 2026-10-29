import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { completeOnboarding, fetchMyProfile, fetchProfileByUsername, updateProfile } from './api';
import { pickAndUploadAvatar } from './avatar';
import { routeState, type RouteState } from './route-state';
import type { OnboardingInput, ProfileUpdate } from './schemas';
import { useSession } from './session';

export const profileKeys = {
  all: ['profiles'] as const,
  byUsername: (username: string) => ['profiles', 'username', username.toLowerCase()] as const,
  me: (userId: string) => ['profiles', 'me', userId] as const,
};

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.byUsername(username),
    queryFn: () => fetchProfileByUsername(username),
  });
}

/** The signed-in user's own profile (null when they have none yet). */
export function useMyProfile() {
  const userId = useSession().session?.user.id;
  return useQuery({
    queryKey: profileKeys.me(userId ?? ''),
    queryFn: () => fetchMyProfile(userId!),
    enabled: !!userId,
  });
}

/**
 * Route state for the root layout. After the first decision, a refetch keeps the last state
 * instead of going back to 'loading', so the navigator (and the user's place) is never torn down.
 */
export function useRouteState(): RouteState {
  const { session, isLoading } = useSession();
  const profile = useMyProfile();
  const [last, setLast] = useState<RouteState>('loading');
  const state = routeState({
    sessionLoading: isLoading,
    hasSession: !!session,
    profileStatus: profile.status,
    profile: profile.data,
  });
  // Storing the last settled state during render is React's "previous value" pattern.
  if (state !== 'loading' && state !== last) setLast(state);
  return state === 'loading' ? last : state;
}

function useInvalidateProfiles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: profileKeys.all });
}

export function useCompleteOnboarding() {
  const userId = useSession().session?.user.id;
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (input: OnboardingInput) => completeOnboarding(userId!, input),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile() {
  const userId = useSession().session?.user.id;
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (input: ProfileUpdate) => updateProfile(userId!, input),
    onSuccess: invalidate,
  });
}

export function useChangeAvatar() {
  const userId = useSession().session?.user.id;
  const invalidate = useInvalidateProfiles();
  return useMutation({
    mutationFn: (previousPath: string | null) => pickAndUploadAvatar(userId!, previousPath),
    onSuccess: invalidate,
  });
}
