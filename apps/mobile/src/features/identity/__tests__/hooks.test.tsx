import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useProfile } from '../hooks';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: jest.fn(() => ({ eq: mockEq })) })) },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

test('fetches a profile by lowercased username', async () => {
  mockMaybeSingle.mockResolvedValue({ data: { username: 'sam_sends' }, error: null });
  const { result } = await renderHook(() => useProfile('Sam_Sends'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockEq).toHaveBeenCalledWith('username', 'sam_sends');
  expect(result.current.data).toEqual({ username: 'sam_sends' });
});

test('returns null for an unknown username', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  const { result } = await renderHook(() => useProfile('nobody'), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBeNull();
});
