import { describe, expect, it } from 'vitest';
import { createDemoSnapshot } from './demo';
import { buildAlerts, estimatedProfit, filterProducts, stockOf, stockTotals } from './selectors';
const snapshot = createDemoSnapshot({ period: 'today', scenario: 'normal' });
describe('Inventory accounting', () => {
  it('sums positions once and keeps transit quantities outside stock', () => {
    expect(stockOf(snapshot.products[0])).toBe(54);
    expect(stockOf(snapshot.products[0], 'ru')).toBe(42);
    expect(stockTotals(snapshot.products)).toEqual({ stock: 1040, toBuyer: 176, fromBuyer: 27 });
  });
  it('applies warehouse, barcode search and stock rule together', () => {
    expect(
      filterProducts(snapshot.products, '2000001001028', 'by', 'low').map((p) => p.id),
    ).toEqual([1001]);
    expect(filterProducts(snapshot.products, 'ХУДИ', 'ru', 'low')).toEqual([]);
  });
  it('changes event periods without multiplying current inventory', () => {
    const week = createDemoSnapshot({ period: 'week', scenario: 'normal' });
    expect(week.operations.sales).toBeGreaterThan(snapshot.operations.sales);
    expect(stockTotals(week.products)).toEqual(stockTotals(snapshot.products));
  });
});
describe('Financial and warning semantics', () => {
  it('does not publish full profit with incomplete cost coverage', () => {
    const s = createDemoSnapshot({ period: 'today', scenario: 'partial' });
    expect(estimatedProfit(s)).toBeNull();
    expect(buildAlerts(s).some((a) => a.id === 'cost')).toBe(true);
  });
  it('reports a negative result without treating every expense as a loss', () => {
    const s = createDemoSnapshot({ period: 'today', scenario: 'loss' });
    expect(estimatedProfit(s)).toBe(-21720);
    expect(buildAlerts(s).some((a) => a.id === 'loss')).toBe(true);
  });
  it('replaces urgent replenishment alerts when inventory is stale', () => {
    const s = createDemoSnapshot({ period: 'today', scenario: 'stale' });
    expect(buildAlerts(s).map((a) => a.id)).toEqual(['stale']);
  });
  it('keeps an empty cabinet free of invented alerts', () => {
    expect(buildAlerts(createDemoSnapshot({ period: 'today', scenario: 'empty' }))).toEqual([]);
  });
});
