import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { createDemoSnapshot } from '../data/demo';
import type { Snapshot, SnapshotRequest } from '../data/types';

// The adapter boundary: replace the demo query with an authenticated SellerStatus
// transport after its read-only contract is verified. Never fetch WB from a view.
export const sellerApi = createApi({
  reducerPath: 'sellerApi',
  baseQuery: fakeBaseQuery<{ message: string }>(),
  endpoints: (builder) => ({
    snapshot: builder.query<Snapshot, SnapshotRequest>({
      async queryFn(request, api) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            api.signal.removeEventListener('abort', finish);
            resolve();
          };
          const timer = setTimeout(finish, 350);
          api.signal.addEventListener('abort', finish, { once: true });
        });
        if (api.signal.aborted) return { error: { message: 'Загрузка отменена' } };
        if (request.scenario === 'error')
          return {
            error: {
              message: 'Демонстрация недоступного сервера. Реальные запросы не выполняются.',
            },
          };
        return { data: createDemoSnapshot(request) };
      },
    }),
  }),
});
export const { useSnapshotQuery } = sellerApi;
