import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoSnapshot } from '../demo';
import type { SnapshotRequest } from '../types';
import { SourceError, parseRetryAfter } from './errors';
import { loadSnapshot } from './loadSnapshot';
import type { SnapshotSource } from './source';
const request: SnapshotRequest = { cabinetId: 'demo-store', period: 'today', scenario: 'normal' };
const good = () => createDemoSnapshot(request);
const options = { baseDelayMs: 10, random: () => 0.5 };
const signal = () => new AbortController().signal;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('Snapshot loading policy', () => {
  it('validates and isolates a successful source response', async () => {
    const data = good();
    const result = await loadSnapshot({ read: async () => data }, request, signal());
    expect(result.data).toEqual(data);
    expect(result.data).not.toBe(data);
  });
  it('recovers from a temporary failure and retries with the next attempt number', async () => {
    const read = vi
      .fn<SnapshotSource['read']>()
      .mockRejectedValueOnce(new SourceError('network'))
      .mockResolvedValue(good());
    const pending = loadSnapshot({ read }, request, signal(), options);
    await vi.runAllTimersAsync();
    expect((await pending).data?.operations.sales).toBe(126);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1].attempt).toBe(2);
  });
  it('stops after three failures instead of retrying indefinitely', async () => {
    const read = vi.fn<SnapshotSource['read']>().mockRejectedValue(new SourceError('server'));
    const pending = loadSnapshot({ read }, request, signal(), options);
    await vi.runAllTimersAsync();
    expect((await pending).error).toMatchObject({ code: 'server', attempts: 3 });
    expect(read).toHaveBeenCalledTimes(3);
  });
  it.each(['unauthorized', 'forbidden', 'contract', 'unexpected'] as const)(
    'never automatically retries %s',
    async (code) => {
      const read = vi.fn<SnapshotSource['read']>().mockRejectedValue(new SourceError(code));
      expect((await loadSnapshot({ read }, request, signal())).error).toMatchObject({
        code,
        attempts: 1,
      });
      expect(read).toHaveBeenCalledOnce();
    },
  );
  it('does not retry a rate limit earlier than Retry-After', async () => {
    const read = vi
      .fn<SnapshotSource['read']>()
      .mockRejectedValueOnce(new SourceError('rateLimit', 100))
      .mockResolvedValue(good());
    const pending = loadSnapshot({ read }, request, signal(), options);
    await vi.advanceTimersByTimeAsync(99);
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).data).toBeDefined();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('returns a long cooldown without shortening it or waiting in the background', async () => {
    const read = vi
      .fn<SnapshotSource['read']>()
      .mockRejectedValue(new SourceError('rateLimit', 60_000));
    const result = await loadSnapshot({ read }, request, signal(), options);
    expect(result.error).toMatchObject({
      code: 'rateLimit',
      attempts: 1,
      retryAt: Date.now() + 60_000,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('enforces a timeout even if a source ignores cancellation', async () => {
    const read = vi.fn<SnapshotSource['read']>().mockImplementation(() => new Promise(() => {}));
    const pending = loadSnapshot({ read }, request, signal(), {
      ...options,
      timeoutMs: 50,
      maxAttempts: 2,
    });
    await vi.runAllTimersAsync();
    expect((await pending).error).toMatchObject({ code: 'timeout', attempts: 2 });
    expect(read.mock.calls.every(([, context]) => context.signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels an active request and does not start a retry', async () => {
    const controller = new AbortController();
    const read = vi.fn<SnapshotSource['read']>().mockImplementation(() => new Promise(() => {}));
    const pending = loadSnapshot({ read }, request, controller.signal);
    controller.abort();
    expect((await pending).error?.code).toBe('cancelled');
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels backoff instead of sending a delayed request after navigation', async () => {
    const controller = new AbortController();
    const read = vi.fn<SnapshotSource['read']>().mockRejectedValue(new SourceError('network'));
    const pending = loadSnapshot({ read }, request, controller.signal, options);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect((await pending).error?.code).toBe('cancelled');
    expect(read).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never contacts a source for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.fn<SnapshotSource['read']>();
    expect((await loadSnapshot({ read }, request, controller.signal)).error?.code).toBe(
      'cancelled',
    );
    expect(read).not.toHaveBeenCalled();
  });
  it.each(['period', 'cabinet'] as const)('rejects a response for a different %s', async (kind) => {
    const data = good();
    if (kind === 'period') data.period = 'week';
    else data.cabinet.id = 'other-store';
    const read = vi.fn<SnapshotSource['read']>().mockResolvedValue(data);
    expect((await loadSnapshot({ read }, request, signal())).error?.code).toBe('contract');
    expect(read).toHaveBeenCalledOnce();
  });
  it.each(['missing', 'duplicate', 'negative', 'timestamp', 'warehouse', 'nan'] as const)(
    'rejects %s data before it reaches a view',
    async (kind) => {
      const data = good();
      if (kind === 'missing') Reflect.deleteProperty(data.operations, 'sales');
      if (kind === 'duplicate') data.products.push(data.products[0]);
      if (kind === 'negative') data.products[0].positions[0].quantity = -1;
      if (kind === 'timestamp') data.sources.inventory = 'not-a-date';
      if (kind === 'warehouse') data.products[0].positions[0].warehouseId = 'unknown';
      if (kind === 'nan') data.finance.payout = NaN;
      expect((await loadSnapshot({ read: async () => data }, request, signal())).error?.code).toBe(
        'contract',
      );
    },
  );
});
describe('Retry-After parsing', () => {
  it('accepts seconds and an HTTP date, and rejects malformed input', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('Fri, 30 Oct 2026 10:01:00 GMT')).toBe(60_000);
    expect(parseRetryAfter('invalid')).toBeUndefined();
    expect(parseRetryAfter('-1')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
