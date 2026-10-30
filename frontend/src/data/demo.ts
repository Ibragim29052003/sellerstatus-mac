import type { Product, Snapshot, SnapshotRequest } from './types';

const products: Product[] = [
  {
    id: 1001,
    article: 'SS-TEE-01',
    name: 'Футболка Essential',
    category: 'Футболки',
    color: 'sand',
    unitCost: 420,
    toBuyer: 56,
    fromBuyer: 8,
    dailyDemand: 22,
    positions: [
      { warehouseId: 'ru', size: 'S', barcode: '2000001001011', quantity: 18 },
      { warehouseId: 'ru', size: 'M', barcode: '2000001001028', quantity: 24 },
      { warehouseId: 'by', size: 'M', barcode: '2000001001028', quantity: 12 },
    ],
  },
  {
    id: 1002,
    article: 'SS-HOOD-02',
    name: 'Худи Everyday',
    category: 'Худи',
    color: 'lavender',
    unitCost: 1100,
    toBuyer: 29,
    fromBuyer: 6,
    dailyDemand: 8,
    positions: [
      { warehouseId: 'ru', size: 'M', barcode: '2000001002018', quantity: 124 },
      { warehouseId: 'ru', size: 'L', barcode: '2000001002025', quantity: 96 },
      { warehouseId: 'by', size: 'L', barcode: '2000001002025', quantity: 38 },
    ],
  },
  {
    id: 1003,
    article: 'SS-BAG-03',
    name: 'Шоппер Daily',
    category: 'Аксессуары',
    color: 'mint',
    unitCost: 180,
    toBuyer: 41,
    fromBuyer: 3,
    dailyDemand: 14,
    positions: [
      { warehouseId: 'ru', size: 'Без размера', barcode: '2000001003015', quantity: 386 },
      { warehouseId: 'by', size: 'Без размера', barcode: '2000001003015', quantity: 74 },
    ],
  },
  {
    id: 1004,
    article: 'SS-LONG-04',
    name: 'Лонгслив Studio',
    category: 'Лонгсливы',
    color: 'blue',
    unitCost: 590,
    toBuyer: 17,
    fromBuyer: 4,
    dailyDemand: 5,
    positions: [
      { warehouseId: 'ru', size: 'M', barcode: '2000001004012', quantity: 39 },
      { warehouseId: 'ru', size: 'L', barcode: '2000001004029', quantity: 21 },
    ],
  },
  {
    id: 1005,
    article: 'SS-CAP-05',
    name: 'Кепка Weekend',
    category: 'Аксессуары',
    color: 'peach',
    unitCost: 260,
    toBuyer: 12,
    fromBuyer: 1,
    dailyDemand: 3,
    positions: [
      { warehouseId: 'ru', size: 'Без размера', barcode: '2000001005019', quantity: 148 },
      { warehouseId: 'by', size: 'Без размера', barcode: '2000001005019', quantity: 25 },
    ],
  },
  {
    id: 1006,
    article: 'SS-PANT-06',
    name: 'Брюки Relaxed',
    category: 'Брюки',
    color: 'rose',
    unitCost: 970,
    toBuyer: 21,
    fromBuyer: 5,
    dailyDemand: 6,
    positions: [
      { warehouseId: 'ru', size: 'S', barcode: '2000001006016', quantity: 12 },
      { warehouseId: 'ru', size: 'M', barcode: '2000001006023', quantity: 23 },
    ],
  },
];

export function createDemoSnapshot({
  period,
  scenario,
}: Pick<SnapshotRequest, 'period' | 'scenario'>): Snapshot {
  const scale = period === 'week' ? 6 : period === 'yesterday' ? 0.86 : 1;
  const quantity = (n: number) => Math.round(n * scale);
  const empty = scenario === 'empty';
  const partial = scenario === 'partial';
  const loss = scenario === 'loss';
  const snapshot: Snapshot = {
    cabinet: { id: 'demo-store', name: 'Studio Store' },
    period,
    isDemo: true,
    generatedAt: '2026-10-29T20:30:00+03:00',
    sources: {
      operations: '2026-10-29T20:30:00+03:00',
      inventory: scenario === 'stale' ? '2026-10-28T12:00:00+03:00' : '2026-10-29T20:00:00+03:00',
      inventoryStatus: scenario === 'stale' ? 'stale' : 'ready',
    },
    operations: {
      orders: quantity(184),
      orderAmount: quantity(286900),
      sales: quantity(126),
      revenue: quantity(198400),
      returns: quantity(14),
      returnAmount: quantity(16800),
    },
    finance: {
      payout: quantity(145280),
      cogs: quantity(partial ? 52000 : 72000),
      expenses: quantity(loss ? 95000 : 28400),
      costCoverage: partial ? 72 : 100,
      completeExpenses: false,
    },
    warehouses: [
      {
        id: 'ru',
        name: 'Склад WB РФ',
        description: 'Обобщённая группа источника',
        aggregated: true,
      },
      { id: 'by', name: 'Минск', description: 'Склад WB · Беларусь', aggregated: false },
    ],
    products: structuredClone(products),
    alerts: [],
    trend:
      period === 'week'
        ? [32, 47, 39, 58, 51, 65, 78]
        : [9, 15, 12, 27, 22, 36, 31, 52, 46, 68, 61, 80],
  };
  const result = snapshot.finance.payout - snapshot.finance.cogs - snapshot.finance.expenses;
  const last = snapshot.trend.at(-1) ?? 1;
  snapshot.trend = partial
    ? []
    : snapshot.trend.map((point) => Math.round((point / last) * result));
  if (partial) snapshot.products[0].unitCost = null;
  if (empty) {
    snapshot.products = [];
    snapshot.operations = {
      orders: 0,
      orderAmount: 0,
      sales: 0,
      revenue: 0,
      returns: 0,
      returnAmount: 0,
    };
    snapshot.finance = {
      payout: 0,
      cogs: 0,
      expenses: 0,
      costCoverage: 100,
      completeExpenses: false,
    };
    snapshot.trend = [];
  }
  return snapshot;
}
