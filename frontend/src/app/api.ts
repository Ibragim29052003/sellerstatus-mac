import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { loadSnapshot } from '../data/loading/loadSnapshot';
import type { LoadIssue } from '../data/loading/errors';
import type { RuntimeDependencies } from '../data/loading/source';
import type { Snapshot, SnapshotRequest } from '../data/types';

// The adapter boundary: replace the demo query with an authenticated SellerStatus
// transport after its read-only contract is verified. Never fetch WB from a view.
export const sellerApi = createApi({
  reducerPath: 'sellerApi',
  baseQuery: fakeBaseQuery<LoadIssue>(),
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    snapshot: builder.query<Snapshot, SnapshotRequest>({
      async queryFn(request, api) {
        const { snapshotSource } = api.extra as RuntimeDependencies;
        return loadSnapshot(snapshotSource, request, api.signal);
      },
    }),
  }),
});
export const { useSnapshotQuery } = sellerApi;
