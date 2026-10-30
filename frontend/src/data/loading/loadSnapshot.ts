import type { Snapshot, SnapshotRequest } from '../types';
import { canRetry, SourceError, sourceError, type LoadIssue } from './errors';
import { abortableDelay } from './delay';
import type { SnapshotSource } from './source';
import { validateSnapshot } from './validateSnapshot';

interface LoadOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxRetryWaitMs?: number;
  random?: () => number;
  now?: () => number;
}
export type SnapshotResult = { data: Snapshot; error?: never } | { error: LoadIssue; data?: never };

async function attempt(
  source: SnapshotSource,
  request: SnapshotRequest,
  parent: AbortSignal,
  attempt: number,
  timeoutMs: number,
) {
  if (parent.aborted) throw new SourceError('cancelled');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => {
      reject(new SourceError('cancelled'));
      controller.abort();
    };
    parent.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      reject(new SourceError('timeout'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    const value = await Promise.race([
      source.read(request, { signal: controller.signal, attempt }),
      stopped,
    ]);
    if (parent.aborted) throw new SourceError('cancelled');
    return validateSnapshot(value, request);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abort);
  }
}

export async function loadSnapshot(
  source: SnapshotSource,
  request: SnapshotRequest,
  signal: AbortSignal,
  options: LoadOptions = {},
): Promise<SnapshotResult> {
  const {
    timeoutMs = 8000,
    maxAttempts = 3,
    baseDelayMs = 250,
    maxRetryWaitMs = 2000,
    random = Math.random,
    now = Date.now,
  } = options;
  for (let index = 1; index <= maxAttempts; index++) {
    try {
      return { data: await attempt(source, request, signal, index, timeoutMs) };
    } catch (reason) {
      const error = sourceError(reason);
      const retryAt = error.retryAfterMs === undefined ? undefined : now() + error.retryAfterMs;
      if (!canRetry(error) || index === maxAttempts || (error.retryAfterMs ?? 0) > maxRetryWaitMs) {
        return {
          error: {
            code: error.code,
            message: error.message,
            attempts: index,
            ...(retryAt === undefined ? {} : { retryAt }),
          },
        };
      }
      const delay = Math.max(
        error.retryAfterMs ?? 0,
        Math.min(maxRetryWaitMs, baseDelayMs * 2 ** (index - 1) * (0.8 + random() * 0.4)),
      );
      try {
        await abortableDelay(delay, signal);
      } catch {
        return {
          error: {
            code: 'cancelled',
            message: new SourceError('cancelled').message,
            attempts: index,
          },
        };
      }
    }
  }
  return {
    error: { code: 'unexpected', message: new SourceError('unexpected').message, attempts: 0 },
  };
}
