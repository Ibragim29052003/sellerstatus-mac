export type Period = 'today' | 'yesterday' | 'week';
export type Scenario =
  | 'normal'
  | 'loss'
  | 'partial'
  | 'stale'
  | 'empty'
  | 'error'
  | 'retry'
  | 'refreshError'
  | 'invalid';
export type Page = 'overview' | 'stocks' | 'finance' | 'activity' | 'planner';
export type StockFilter = 'all' | 'low' | 'inTransit';
export type Theme = 'light' | 'dark' | 'system';
export interface StockPosition {
  warehouseId: string;
  size: string;
  barcode: string;
  quantity: number;
}
export interface Product {
  id: number;
  article: string;
  name: string;
  category: string;
  color: string;
  unitCost: number | null;
  positions: StockPosition[];
  toBuyer: number;
  fromBuyer: number;
  dailyDemand: number;
}
export interface Alert {
  id: string;
  kind: 'warning' | 'info';
  title: string;
  description: string;
  action: string;
  target: Page;
  productId?: number;
}
export interface Snapshot {
  cabinet: { id: string; name: string };
  period: Period;
  isDemo: true;
  generatedAt: string;
  sources: { operations: string; inventory: string; inventoryStatus: 'ready' | 'stale' };
  operations: {
    orders: number;
    orderAmount: number;
    sales: number;
    revenue: number;
    returns: number;
    returnAmount: number;
  };
  finance: {
    payout: number;
    cogs: number;
    expenses: number;
    costCoverage: number;
    completeExpenses: false;
  };
  warehouses: { id: string; name: string; description: string; aggregated: boolean }[];
  products: Product[];
  alerts: Alert[];
  trend: number[];
}
export interface SnapshotRequest {
  cabinetId: string;
  period: Period;
  scenario: Scenario;
}
