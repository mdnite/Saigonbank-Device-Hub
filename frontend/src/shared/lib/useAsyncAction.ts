import { useCallback, useState } from 'react';

/** Wraps an async handler with pending/error state. `run` resolves true on success, false on failure. Keeps pages free of try/catch boilerplate. */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setPending(true);
      setError(null);
      try {
        await action(...args);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
        return false;
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
