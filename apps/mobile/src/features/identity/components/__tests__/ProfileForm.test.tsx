import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProfileForm } from '../ProfileForm';

const initial = { display_name: 'Sam', bio: null, grade_system: 'hueco' as const };

test('blocks an over-length bio', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  await render(<ProfileForm initial={initial} onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Bio'), 'x'.repeat(281));
  await fireEvent.press(screen.getByText('Save'));
  expect(screen.getByText('Bio must be at most 280 characters.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('submits edited values', async () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  await render(<ProfileForm initial={initial} onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Display name'), 'Sammy');
  await fireEvent.press(screen.getByText('Fontainebleau'));
  await fireEvent.press(screen.getByText('Save'));
  expect(onSubmit).toHaveBeenCalledWith({ display_name: 'Sammy', bio: '', grade_system: 'font' });
  expect(await screen.findByText('Saved.')).toBeTruthy();
});
