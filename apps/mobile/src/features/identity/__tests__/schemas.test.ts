import { credentialsSchema, passwordSchema, usernameSchema } from '../schemas';

describe('usernameSchema', () => {
  test.each(['abc', 'sam_sends', 'a1_b2_c3', 'x'.repeat(20)])('accepts %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  test.each(['ab', 'x'.repeat(21), 'has space', 'dash-name', 'émile', ''])('rejects %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  test('trims and lowercases', () => {
    expect(usernameSchema.parse('  Sam_Sends ')).toBe('sam_sends');
  });
});

describe('passwordSchema', () => {
  test('requires 8 to 72 characters', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false);
  });
});

test('credentialsSchema reports the failing field', () => {
  const result = credentialsSchema.safeParse({ username: 'ok_name', password: 'short' });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0].path).toEqual(['password']);
});
