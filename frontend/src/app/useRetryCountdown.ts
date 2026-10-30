import { useEffect, useState } from 'react';

export function useRetryCountdown(retryAt: number | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (retryAt === undefined) return;
    const update = () => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    };
    const initial = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [retryAt]);
  return retryAt === undefined ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
}
