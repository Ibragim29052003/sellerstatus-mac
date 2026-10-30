import { configureStore, createSlice, createListenerMiddleware } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { sellerApi } from './api';
import { readBrowserTheme, saveTheme } from './preferences';
import { isDesktop } from './desktop';
import { createDemoSource } from '../data/demoSource';
import type { SnapshotSource } from '../data/loading/source';
import { scenarioOptions } from '../data/options';
import type { Page, Period, Scenario, StockFilter, Theme } from '../data/types';
interface UiState {
  page: Page;
  period: Period;
  scenario: Scenario;
  query: string;
  warehouse: string;
  stockFilter: StockFilter;
  productId: number | null;
  theme: Theme;
  settingsOpen: boolean;
  themeError: string | null;
}
const params = new URLSearchParams(window.location.search);
const requestedPage = params.get('page');
const requestedPeriod = params.get('period');
const requestedScenario = params.get('scenario');
const initialState: UiState = {
  page: ['overview', 'stocks', 'finance', 'activity'].includes(requestedPage ?? '')
    ? (requestedPage as Page)
    : 'overview',
  period: ['today', 'yesterday', 'week'].includes(requestedPeriod ?? '')
    ? (requestedPeriod as Period)
    : 'today',
  scenario: scenarioOptions.some((option) => option.value === requestedScenario)
    ? (requestedScenario as Scenario)
    : 'normal',
  query: '',
  warehouse: 'all',
  stockFilter: 'all',
  productId: null,
  theme: 'system',
  themeError: null,
  settingsOpen: false,
};
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    pageChanged(state, action: PayloadAction<Page>) {
      state.page = action.payload;
      state.productId = null;
    },
    periodChanged(state, action: PayloadAction<Period>) {
      state.period = action.payload;
    },
    scenarioChanged(state, action: PayloadAction<Scenario>) {
      state.scenario = action.payload;
      state.productId = null;
      state.query = '';
      state.warehouse = 'all';
      state.stockFilter = 'all';
    },
    queryChanged(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    warehouseChanged(state, action: PayloadAction<string>) {
      state.warehouse = action.payload;
    },
    stockFilterChanged(state, action: PayloadAction<StockFilter>) {
      state.stockFilter = action.payload;
    },
    productSelected(state, action: PayloadAction<number | null>) {
      state.productId = action.payload;
    },
    themeChanged(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      state.themeError = null;
    },
    themeReceived(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      state.themeError = null;
    },
    themeSaveFailed(state, action: PayloadAction<string>) {
      state.themeError = action.payload;
    },
    settingsToggled(state) {
      state.settingsOpen = !state.settingsOpen;
    },
    filtersReset(state) {
      state.query = '';
      state.warehouse = 'all';
      state.stockFilter = 'all';
    },
  },
});
export const actions = uiSlice.actions;
export const createAppStore = (snapshotSource: SnapshotSource = createDemoSource()) => {
  const listener = createListenerMiddleware();
  let pendingSave = Promise.resolve();
  listener.startListening({
    actionCreator: actions.themeChanged,
    effect: async (action, api) => {
      pendingSave = pendingSave.catch(() => {}).then(() => saveTheme(action.payload));
      try {
        await pendingSave;
      } catch {
        api.dispatch(actions.themeSaveFailed('Тема применена, но сохранить её не удалось.'));
      }
    },
  });
  return configureStore({
    reducer: { ui: uiSlice.reducer, [sellerApi.reducerPath]: sellerApi.reducer },
    preloadedState: { ui: { ...initialState, theme: isDesktop() ? 'system' : readBrowserTheme() } },
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: { snapshotSource } } })
        .prepend(listener.middleware)
        .concat(sellerApi.middleware),
  });
};
export const store = createAppStore();
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
