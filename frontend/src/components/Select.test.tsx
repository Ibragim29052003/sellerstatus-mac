import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';
const options = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: '7 дней' },
];
function Fixture({ onEscape = () => {} }: { onEscape?: () => void }) {
  const [value, setValue] = useState('today');
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') onEscape();
      }}
    >
      <Select label="Период" value={value} options={options} onChange={setValue} />
      <button>Следующая кнопка</button>
    </div>
  );
}
describe('Custom select', () => {
  it('commits a keyboard choice and keeps focus on the trigger', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.tab();
    await user.keyboard('{ArrowDown}{End}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('combobox')).toHaveTextContent('7 дней');
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('cancels a pending choice with Escape without closing the parent', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<Fixture onEscape={onEscape} />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{End}{Escape}');
    expect(screen.getByRole('combobox')).toHaveTextContent('Сегодня');
    expect(onEscape).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledOnce();
  });
  it('supports typeahead and clicking, and dismisses without trapping Tab', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('в{Enter}');
    expect(screen.getByRole('combobox')).toHaveTextContent('Вчера');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '7 дней' }));
    expect(screen.getByRole('combobox')).toHaveTextContent('7 дней');
    await user.keyboard('{ArrowUp}{Tab}');
    expect(screen.getByRole('button', { name: 'Следующая кнопка' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
