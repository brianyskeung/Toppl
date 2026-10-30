import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeleteAccount } from '../DeleteAccount';

test('only deletes after the username is typed', async () => {
  const onDelete = jest.fn().mockResolvedValue(undefined);
  await render(<DeleteAccount username="sam_sends" onDelete={onDelete} />);
  const input = screen.getByLabelText('Type your username to confirm');

  await fireEvent.changeText(input, 'sam');
  await fireEvent.press(screen.getByText('Delete account'));
  expect(onDelete).not.toHaveBeenCalled();

  await fireEvent.changeText(input, 'Sam_Sends');
  await fireEvent.press(screen.getByText('Delete account'));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
