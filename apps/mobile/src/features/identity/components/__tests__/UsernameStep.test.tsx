import { fireEvent, render, screen } from '@testing-library/react-native';
import { UsernameTakenError } from '../../api';
import { UsernameStep } from '../UsernameStep';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

test('shows an inline error for an invalid username without submitting', async () => {
  const onSubmit = jest.fn();
  await render(<UsernameStep onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Username'), 'no');
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.getByText(/3–20 characters/)).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('submits the lowercased username and shows a taken error', async () => {
  const onSubmit = jest.fn().mockRejectedValue(new UsernameTakenError());
  await render(<UsernameStep onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Username'), 'Sam_Sends');
  await fireEvent.press(screen.getByText('Continue'));
  expect(onSubmit).toHaveBeenCalledWith('sam_sends');
  expect(await screen.findByText('That username is taken.')).toBeTruthy();
});
