import {
  bodyMeasurementsSchema,
  credentialsSchema,
  passwordSchema,
  profileUpdateSchema,
  usernameSchema,
} from '../schemas';

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

describe('profileUpdateSchema', () => {
  const valid = { display_name: 'Sam', bio: 'Hi', grade_system: 'font' };

  test('stores empty text as null', () => {
    expect(profileUpdateSchema.parse({ ...valid, display_name: '  ', bio: '' })).toEqual({
      display_name: null,
      bio: null,
      grade_system: 'font',
    });
  });

  test('enforces length limits and known grade systems', () => {
    expect(profileUpdateSchema.safeParse({ ...valid, display_name: 'x'.repeat(51) }).success).toBe(
      false,
    );
    expect(profileUpdateSchema.safeParse({ ...valid, bio: 'x'.repeat(281) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, grade_system: 'yds' }).success).toBe(false);
  });
});

describe('bodyMeasurementsSchema', () => {
  test('parses numbers and treats empty as null', () => {
    expect(bodyMeasurementsSchema.parse({ height_cm: ' 175 ', ape_index_cm: '' })).toEqual({
      height_cm: 175,
      ape_index_cm: null,
    });
    expect(bodyMeasurementsSchema.parse({ height_cm: '100', ape_index_cm: '-30' })).toEqual({
      height_cm: 100,
      ape_index_cm: -30,
    });
  });

  test.each([
    { height_cm: '99', ape_index_cm: '' },
    { height_cm: '251', ape_index_cm: '' },
    { height_cm: '', ape_index_cm: '31' },
    { height_cm: '170.5', ape_index_cm: '' },
    { height_cm: 'tall', ape_index_cm: '' },
  ])('rejects %j', (input) => {
    expect(bodyMeasurementsSchema.safeParse(input).success).toBe(false);
  });
});
