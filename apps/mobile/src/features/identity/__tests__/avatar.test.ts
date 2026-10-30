import { avatarResize } from '../avatar';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

test.each([
  [400, 300, null],
  [512, 512, null],
  [2000, 1000, { width: 512, height: null }],
  [1000, 2000, { width: null, height: 512 }],
  [1024, 1024, { width: 512, height: null }],
])('%ix%i → %j', (w, h, expected) => {
  expect(avatarResize(w, h)).toEqual(expected);
});
