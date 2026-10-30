import type { Snapshot, SnapshotRequest } from '../types';
import { SourceError } from './errors';

function assert(condition: unknown): asserts condition {
  if (!condition) throw new SourceError('contract');
}
function record(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  assert(Array.isArray(value));
  return value;
}
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown) => number(value) && Number.isSafeInteger(value) && value >= 0;
const nonnegative = (value: unknown) => number(value) && value >= 0;
const timestamp = (value: unknown) =>
  typeof value === 'string' &&
  /T.*(Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));
function unique(values: unknown[]) {
  assert(new Set(values).size === values.length);
}

// This deliberately accepts only the demo contract. A live SellerStatus adapter
// must translate a verified API contract, including unknown values and money units.
export function validateSnapshot(value: unknown, request: SnapshotRequest): Snapshot {
  const snapshot = record(value);
  const cabinet = record(snapshot.cabinet);
  assert(cabinet.id === request.cabinetId && text(cabinet.name));
  assert(
    snapshot.period === request.period &&
      snapshot.isDemo === true &&
      timestamp(snapshot.generatedAt),
  );
  const sources = record(snapshot.sources);
  assert(timestamp(sources.operations) && timestamp(sources.inventory));
  assert(sources.inventoryStatus === 'ready' || sources.inventoryStatus === 'stale');
  const operations = record(snapshot.operations);
  for (const key of ['orders', 'sales', 'returns']) assert(count(operations[key]));
  for (const key of ['orderAmount', 'revenue', 'returnAmount'])
    assert(nonnegative(operations[key]));
  const finance = record(snapshot.finance);
  for (const key of ['payout', 'cogs', 'expenses']) assert(number(finance[key]));
  assert(number(finance.costCoverage) && finance.costCoverage >= 0 && finance.costCoverage <= 100);
  assert(finance.completeExpenses === false);
  const warehouses = array(snapshot.warehouses).map(record);
  unique(warehouses.map((warehouse) => warehouse.id));
  for (const warehouse of warehouses)
    assert(
      text(warehouse.id) &&
        text(warehouse.name) &&
        typeof warehouse.description === 'string' &&
        typeof warehouse.aggregated === 'boolean',
    );
  const products = array(snapshot.products).map(record);
  unique(products.map((product) => product.id));
  let stockTotal = 0,
    toBuyerTotal = 0,
    fromBuyerTotal = 0;
  for (const product of products) {
    assert(count(product.id) && product.id !== 0);
    for (const key of ['article', 'name', 'category', 'color']) assert(text(product[key]));
    assert(product.unitCost === null || nonnegative(product.unitCost));
    assert(count(product.toBuyer) && count(product.fromBuyer) && nonnegative(product.dailyDemand));
    toBuyerTotal += product.toBuyer as number;
    fromBuyerTotal += product.fromBuyer as number;
    const positions = array(product.positions).map(record);
    unique(positions.map((position) => JSON.stringify([position.warehouseId, position.barcode])));
    for (const position of positions) {
      assert(warehouses.some((warehouse) => warehouse.id === position.warehouseId));
      assert(text(position.size) && text(position.barcode) && count(position.quantity));
      stockTotal += position.quantity as number;
    }
  }
  assert(count(stockTotal) && count(toBuyerTotal) && count(fromBuyerTotal));
  for (const point of array(snapshot.trend)) assert(number(point));
  for (const value of array(snapshot.alerts)) {
    const alert = record(value);
    for (const key of ['id', 'title', 'description', 'action']) assert(text(alert[key]));
    assert(alert.kind === 'warning' || alert.kind === 'info');
    assert(['overview', 'stocks', 'finance', 'activity'].includes(String(alert.target)));
    if (alert.productId !== undefined)
      assert(products.some((product) => product.id === alert.productId));
  }
  // Clone removes object identity shared with a source and keeps Redux-owned data isolated.
  return structuredClone(value) as Snapshot;
}
