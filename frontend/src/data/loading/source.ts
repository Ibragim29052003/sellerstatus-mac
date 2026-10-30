import type { SnapshotRequest } from '../types';

export interface SnapshotSource {
  read(
    request: SnapshotRequest,
    context: { signal: AbortSignal; attempt: number },
  ): Promise<unknown>;
}
export interface RuntimeDependencies {
  snapshotSource: SnapshotSource;
}
