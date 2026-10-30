import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useSession } from '../session';
import { useRequireAuth } from '../use-require-auth';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../session', () => ({ useSession: jest.fn() }));

const mockedUseSession = jest.mocked(useSession);

beforeEach(() => jest.clearAllMocks());

test('guest: opens the auth sheet and does not run the action', async () => {
  mockedUseSession.mockReturnValue({ session: null, isLoading: false });
  const action = jest.fn();
  const { result } = await renderHook(() => useRequireAuth());
  result.current(action)();
  expect(action).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/welcome');
});

test('signed in: runs the action with its arguments, no sheet', async () => {
  mockedUseSession.mockReturnValue({ session: {} as never, isLoading: false });
  const action = jest.fn();
  const { result } = await renderHook(() => useRequireAuth());
  result.current(action)('sam_sends');
  expect(action).toHaveBeenCalledWith('sam_sends');
  expect(router.push).not.toHaveBeenCalled();
});
