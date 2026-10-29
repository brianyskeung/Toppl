import { appName } from '@/lib/env';

test('path alias resolves', () => {
  expect(appName).toBe('toppl');
});
