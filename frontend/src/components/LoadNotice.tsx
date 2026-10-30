import { CircleAlert } from 'lucide-react';
import type { LoadIssue } from '../data/loading/errors';
import { sourceTime } from '../data/selectors';

export function LoadNotice({
  issue,
  operationsTime,
  inventoryTime,
  busy,
  retrySeconds,
  onRetry,
  compact = false,
}: {
  issue: LoadIssue;
  operationsTime: string;
  inventoryTime: string;
  busy: boolean;
  retrySeconds: number;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`load-notice ${compact ? 'compact' : ''}`}
      role="status"
      title={compact ? issue.message : undefined}
    >
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <div className="notice-heading">
          <strong>
            {compact
              ? 'Показан предыдущий снимок'
              : 'Не удалось обновить. Показан предыдущий снимок.'}
          </strong>
          {compact && (
            <button
              className="text-button"
              aria-label="Повторить обновление"
              disabled={busy || retrySeconds > 0}
              onClick={onRetry}
            >
              {retrySeconds > 0 ? `${retrySeconds} с` : 'Повторить'}
            </button>
          )}
        </div>
        <p className={compact ? 'sr-only' : undefined}>{issue.message}</p>
        <small>
          Операции: {sourceTime(operationsTime)} · остатки: {sourceTime(inventoryTime)} МСК.
        </small>
        {!compact && (
          <button className="text-button" disabled={busy || retrySeconds > 0} onClick={onRetry}>
            {retrySeconds > 0 ? `Повтор через ${retrySeconds} с` : 'Повторить обновление'}
          </button>
        )}
      </div>
    </div>
  );
}
