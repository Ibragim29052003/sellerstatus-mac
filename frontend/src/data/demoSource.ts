import { createDemoSnapshot } from './demo';
import { SourceError } from './loading/errors';
import { abortableDelay } from './loading/delay';
import type { SnapshotSource } from './loading/source';

// One instance per store: demonstration faults cannot leak between windows or tests.
export function createDemoSource(): SnapshotSource {
  const operations = new Map<string, number>();
  return {
    async read(request, { signal, attempt }) {
      const key = JSON.stringify([request.cabinetId, request.period, request.scenario]);
      if (attempt === 1) operations.set(key, (operations.get(key) ?? 0) + 1);
      await abortableDelay(350, signal);
      if (request.cabinetId !== 'demo-store') throw new SourceError('forbidden');
      if (
        request.scenario === 'error' ||
        (request.scenario === 'refreshError' && (operations.get(key) ?? 0) > 1)
      )
        throw new SourceError('server');
      if (request.scenario === 'retry' && attempt === 1) throw new SourceError('network');
      if (request.scenario === 'invalid') return { period: request.period, operations: null };
      return createDemoSnapshot(request);
    },
  };
}
