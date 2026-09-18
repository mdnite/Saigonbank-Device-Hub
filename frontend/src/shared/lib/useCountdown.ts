import { useCallback, useEffect, useState } from 'react';

/** Đếm ngược mỗi giây tới 0. Gọi restart(n) để đặt lại mốc đếm. */
export function useCountdown(initialSeconds: number) {
  // Tính theo mốc hết hạn, không trừ dần theo tick: tab ẩn bị trình duyệt làm chậm timer,
  // quay lại vẫn hiện đúng thời gian còn lại.
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(id);
  }, [remaining, now]);

  const restart = useCallback(
    (next: number = initialSeconds) => {
      const t = Date.now();
      setNow(t);
      setDeadline(t + next * 1000);
    },
    [initialSeconds],
  );

  return { remaining, restart };
}
