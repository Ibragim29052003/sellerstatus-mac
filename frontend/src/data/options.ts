import type { Period, Scenario, StockFilter, Theme } from './types';
import type { SelectOption } from '../components/Select';

export const periodOptions: SelectOption<Period>[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'week', label: '7 дней' },
];
export const themeOptions: SelectOption<Theme>[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлое' },
  { value: 'dark', label: 'Тёмное' },
];
export const scenarioOptions: SelectOption<Scenario>[] = [
  { value: 'normal', label: 'Обычный день' },
  { value: 'loss', label: 'Убыток' },
  { value: 'partial', label: 'Неполные данные' },
  { value: 'stale', label: 'Устаревшие остатки' },
  { value: 'empty', label: 'Пустой кабинет' },
  { value: 'error', label: 'Ошибка сервера' },
  { value: 'retry', label: 'Успех со второй попытки' },
  { value: 'refreshError', label: 'Сбой повторного обновления' },
  { value: 'invalid', label: 'Повреждённый ответ' },
];
export const stockOptions: SelectOption<StockFilter>[] = [
  { value: 'all', label: 'Все состояния' },
  { value: 'low', label: 'Низкий запас' },
  { value: 'inTransit', label: 'Есть товары в пути' },
];
