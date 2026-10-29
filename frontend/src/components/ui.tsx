import { ArrowUpRight, ChevronRight, Package, Shirt } from 'lucide-react';
import type { ReactNode } from 'react';
import { count } from '../data/selectors';
import type { Product } from '../data/types';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div>
        <strong>
          SellerStatus<span className="brand-dot">.</span>
        </strong>
        {!compact && <small>Ваш магазин. В фокусе.</small>}
      </div>
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Sparkline({ values, large = false }: { values: number[]; large?: boolean }) {
  if (!values.length) return <span className="muted">Нет динамики</span>;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((n, i) => `${(i / Math.max(values.length - 1, 1)) * 300},${85 - ((n - min) / range) * 70}`)
    .join(' ');
  return (
    <svg
      className={large ? 'spark large' : 'spark'}
      viewBox="0 0 300 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M0,100 L${points.replaceAll(' ', ' L')} L300,100 Z`}
        fill="currentColor"
        opacity=".07"
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function ProductTile({ product }: { product: Product }) {
  const Icon = product.category === 'Аксессуары' ? Package : Shirt;
  return (
    <span className={`product-art ${product.color}`} aria-hidden="true">
      <Icon strokeWidth={1.2} />
    </span>
  );
}
export function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function StatCard({
  label,
  value,
  detail,
  icon,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button className={`stat-card ${tone ?? ''}`} onClick={onClick}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <ChevronRight size={15} />
      </div>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}
export function Quantity({ value }: { value: number }) {
  return (
    <>
      {count(value)} <span className="unit">шт.</span>
    </>
  );
}
