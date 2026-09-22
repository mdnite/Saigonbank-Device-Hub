import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiGet } from '@/shared/lib/apiClient';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { SessionProvider, useSession } from './SessionContext';

const KEY = 'idsm.session';
const stored = (token: string, roleName = 'Nhân viên') =>
  localStorage.setItem(
    KEY,
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token, roleName, departmentCode: null }),
  );

function Probe() {
  const { session, notice } = useSession();
  return (
    <>
      <p>session:{session ? 'yes' : 'no'}</p>
      <p>notice:{notice ?? ''}</p>
    </>
  );
}
const renderProbe = () =>
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('token còn hạn: giữ phiên', () => {
  stored(fakeJwt(inOneHour()));
  renderProbe();
  expect(screen.getByText('session:yes')).toBeInTheDocument();
});

it('token hết hạn khi mở app: bỏ phiên, xoá storage, báo hết phiên', () => {
  stored(fakeJwt(Math.floor(Date.now() / 1000) - 10));
  renderProbe();
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});

it('phiên cũ thiếu roleName: bỏ phiên, không báo', () => {
  localStorage.setItem(KEY, JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()) }));
  renderProbe();
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:')).toBeInTheDocument();
});

it('phiên cũ thiếu departmentCode: bỏ phiên, không báo', () => {
  localStorage.setItem(
    KEY,
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName: 'Trưởng phòng' }),
  );
  renderProbe();
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:')).toBeInTheDocument();
});

it('API trả 401 khi đang đăng nhập: tự đăng xuất + báo hết phiên', async () => {
  stored(fakeJwt(inOneHour()));
  renderProbe();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: null, error: 'UNAUTHORIZED', message: 'x' }), { status: 401 }),
    ),
  );
  await act(async () => {
    await apiGet('/users').catch(() => undefined);
  });
  expect(screen.getByText('session:no')).toBeInTheDocument();
  expect(screen.getByText('notice:Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBeNull();
});
