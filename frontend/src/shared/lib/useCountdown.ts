import { useCallback, useEffect, useState } from 'react';

/** Đếm ngược mỗi giây tới 0. Gọi restart(n) để đặt lại mốc đếm. */
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    // ponytail: setTimeout theo tick, có thể trôi vài trăm ms trên 60s — không sao cho một bộ
    // đếm cooldown UI; nếu cần chính xác thì tính theo Date.now() mốc hết hạn.
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const restart = useCallback(
    (next: number = initialSeconds) => setRemaining(next),
    [initialSeconds],
  );

  return { remaining, restart };
}
