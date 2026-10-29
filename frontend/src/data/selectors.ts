import type { Alert, Product, Snapshot, StockFilter } from './types';
export const stockOf = (product: Product, warehouseId = 'all') =>
  product.positions
    .filter((p) => warehouseId === 'all' || p.warehouseId === warehouseId)
    .reduce((sum, p) => sum + p.quantity, 0);
export const coverOf = (product: Product) =>
  product.dailyDemand > 0 ? stockOf(product) / product.dailyDemand : null;
export const isLowStock = (product: Product) => {
  const cover = coverOf(product);
  return cover !== null && cover < 7;
};
export const stockTotals = (products: Product[]) =>
  products.reduce(
    (acc, product) => ({
      stock: acc.stock + stockOf(product),
      toBuyer: acc.toBuyer + product.toBuyer,
      fromBuyer: acc.fromBuyer + product.fromBuyer,
    }),
    { stock: 0, toBuyer: 0, fromBuyer: 0 },
  );
export function filterProducts(
  products: Product[],
  query: string,
  warehouseId: string,
  filter: StockFilter,
): Product[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return products.filter((p) => {
    const matchesQuery = [
      p.name,
      p.article,
      String(p.id),
      ...p.positions.map((x) => x.barcode),
    ].some((value) => value.toLocaleLowerCase('ru').includes(needle));
    return (
      matchesQuery &&
      (warehouseId === 'all' || p.positions.some((x) => x.warehouseId === warehouseId)) &&
      (filter !== 'low' || isLowStock(p)) &&
      (filter !== 'inTransit' || p.toBuyer + p.fromBuyer > 0)
    );
  });
}
export const estimatedProfit = (s: Snapshot) =>
  s.finance.costCoverage === 100 ? s.finance.payout - s.finance.cogs - s.finance.expenses : null;
export function buildAlerts(s: Snapshot): Alert[] {
  const alerts: Alert[] = [];
  if (s.sources.inventoryStatus === 'stale')
    alerts.push({
      id: 'stale',
      kind: 'warning',
      title: 'Остатки давно не обновлялись',
      description: 'Показан предыдущий снимок. Перед планированием нужна свежая синхронизация.',
      action: 'Посмотреть остатки',
      target: 'stocks',
    });
  const low = s.products.filter(isLowStock);
  if (low.length && s.sources.inventoryStatus !== 'stale')
    alerts.push({
      id: 'low',
      kind: 'warning',
      title: `${low.length} товара требуют пополнения`,
      description: `${low[0].name}: запас примерно на ${coverOf(low[0])?.toFixed(1).replace('.', ',')} дня при демонстрационном спросе.`,
      action: 'Посмотреть товары',
      target: 'stocks',
    });
  if (s.finance.costCoverage < 100)
    alerts.push({
      id: 'cost',
      kind: 'warning',
      title: 'Не хватает данных о себестоимости',
      description: `Покрыто ${s.finance.costCoverage}% операций. Полный итог прибыли пока недоступен.`,
      action: 'Открыть расчёт',
      target: 'finance',
    });
  if ((estimatedProfit(s) ?? 0) < 0)
    alerts.push({
      id: 'loss',
      kind: 'warning',
      title: 'Расчётный результат отрицательный',
      description: 'Учтённые затраты превышают оперативную выплату. Проверьте состав расходов.',
      action: 'Разобрать расходы',
      target: 'finance',
    });
  return alerts;
}
export const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
export const count = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
export const sourceTime = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
