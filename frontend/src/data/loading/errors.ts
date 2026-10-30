export type LoadErrorCode =
  | 'network'
  | 'timeout'
  | 'rateLimit'
  | 'server'
  | 'unauthorized'
  | 'forbidden'
  | 'contract'
  | 'cancelled'
  | 'unexpected';
export interface LoadIssue {
  code: LoadErrorCode;
  message: string;
  attempts: number;
  retryAt?: number;
}
const messages: Record<LoadErrorCode, string> = {
  network: 'Нет связи с источником. Проверьте подключение и попробуйте ещё раз.',
  timeout: 'Источник отвечает слишком долго. Попробуйте загрузить сводку позже.',
  rateLimit: 'Источник ограничил частоту запросов. Нужно подождать перед повтором.',
  server: 'Источник временно недоступен. Попробуйте ещё раз позже.',
  unauthorized: 'Сессия закончилась. Для загрузки данных нужен повторный вход.',
  forbidden: 'Источник не разрешил чтение данных этого кабинета.',
  contract: 'Ответ источника не прошёл проверку. Неподтверждённые данные не показаны.',
  cancelled: 'Загрузка отменена.',
  unexpected: 'Не удалось обработать ответ источника. Попробуйте ещё раз.',
};
export class SourceError extends Error {
  constructor(
    readonly code: LoadErrorCode,
    readonly retryAfterMs?: number,
  ) {
    super(messages[code]);
    this.name = 'SourceError';
  }
}
export function sourceError(error: unknown): SourceError {
  if (error instanceof SourceError) return error;
  if (error instanceof TypeError) return new SourceError('network');
  if (error instanceof DOMException && error.name === 'AbortError')
    return new SourceError('cancelled');
  return new SourceError('unexpected');
}
export const canRetry = (error: SourceError) =>
  ['network', 'timeout', 'server', 'rateLimit'].includes(error.code);
export const canShowPrevious = (issue: LoadIssue | undefined) =>
  !!issue && ['network', 'timeout', 'server', 'rateLimit'].includes(issue.code);
export function toLoadIssue(value: unknown): LoadIssue | undefined {
  if (!value) return undefined;
  if (
    typeof value === 'object' &&
    'code' in value &&
    typeof value.code === 'string' &&
    Object.hasOwn(messages, value.code)
  ) {
    const code = value.code as LoadErrorCode;
    return {
      code,
      message: messages[code],
      attempts: 'attempts' in value && typeof value.attempts === 'number' ? value.attempts : 0,
      ...('retryAt' in value && typeof value.retryAt === 'number'
        ? { retryAt: value.retryAt }
        : {}),
    };
  }
  return { code: 'unexpected', message: messages.unexpected, attempts: 0 };
}

// Supports both valid HTTP forms. A long Retry-After is never shortened to an
// earlier retry: the loader returns retryAt instead of waiting indefinitely.
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (value === null) return undefined;
  if (/^\d+(\.\d+)?$/.test(value.trim())) {
    const milliseconds = Number(value) * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : undefined;
  }
  if (/^[+-]?\d/.test(value.trim())) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}
