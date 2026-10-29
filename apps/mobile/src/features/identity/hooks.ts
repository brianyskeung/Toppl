import { useQuery } from '@tanstack/react-query';
import { fetchProfileByUsername } from './api';

export const profileKeys = {
  byUsername: (username: string) => ['profiles', 'username', username.toLowerCase()] as const,
};

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.byUsername(username),
    queryFn: () => fetchProfileByUsername(username),
  });
}
