import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createAppStore } from './app/store';
function setup() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return userEvent.setup();
}
describe('Seller workspace', () => {
  it('opens warehouse inventory, combines filters and retains them after product detail', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Всё под контролем.' });
    await user.click(screen.getByRole('button', { name: 'Остатки и склады' }));
    await user.click(screen.getByRole('button', { name: /Минск/ }));
    await user.type(screen.getByRole('textbox', { name: 'Поиск товаров' }), 'Essential');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Подробнее: Футболка Essential' }));
    expect(screen.getByRole('heading', { name: 'Распределение запаса' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'К списку товаров' }));
    expect(screen.getByRole('textbox')).toHaveValue('Essential');
    expect(within(screen.getByRole('table')).getByText('12')).toBeInTheDocument();
  });
  it('hides full profit for incomplete data and recovers from error scenario', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Всё под контролем.' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демосценарий' }), 'partial');
    await screen.findByText('Недостаточно данных');
    await user.click(screen.getByRole('button', { name: 'Финансы' }));
    expect(screen.getByText('Не определён')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демосценарий' }), 'error');
    await screen.findByRole('alert');
    expect(screen.queryByText('Состав расчёта')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Вернуться к демосводке' }));
    await screen.findByText('Состав расчёта');
  });
});

describe('Demo states and period navigation', () => {
  it('supports all display scenarios and safe period changes', async () => {
    const user = setup();
    await screen.findByRole('heading', { name: 'Всё под контролем.' });
    await user.click(screen.getByRole('button', { name: '7 дней' }));
    await screen.findByRole('button', { name: /Выкупы.*756/ });
    expect(screen.getByRole('button', { name: /На складах WB/ })).toHaveTextContent('1 040');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демосценарий' }), 'stale');
    await screen.findByRole('button', { name: /Остатки давно не обновлялись/ });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демосценарий' }), 'empty');
    await screen.findByRole('heading', { name: 'Начнём с чистого листа' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Демосценарий' }), 'loss');
    await screen.findByRole('button', { name: /Расчётный результат отрицательный/ });
  });
});
