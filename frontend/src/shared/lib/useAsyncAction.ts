import { useCallback, useState } from 'react';

/** Wraps an async handler with pending/error state. Keeps pages free of try/catch boilerplate. */
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending, error };
}
