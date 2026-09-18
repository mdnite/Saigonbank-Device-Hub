import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Mỗi act chỉ commit 1 lần, nên tiến từng giây để effect kịp lên lịch timer kế tiếp. */
const tick = (seconds: number) => {
  for (let i = 0; i < seconds; i++) act(() => vi.advanceTimersByTime(1_000));
};

it('đếm theo đồng hồ thật, kể cả khi timer bị trình duyệt làm chậm', () => {
  const { result } = renderHook(() => useCountdown(300));
  expect(result.current.remaining).toBe(300);

  tick(60);
  expect(result.current.remaining).toBe(240);

  // Tab ẩn: đồng hồ chạy 100s nhưng không timer nào kịp chạy.
  vi.setSystemTime(Date.now() + 100_000);
  tick(1);
  expect(result.current.remaining).toBe(139);

  tick(200);
  expect(result.current.remaining).toBe(0);

  act(() => result.current.restart());
  expect(result.current.remaining).toBe(300);
});
