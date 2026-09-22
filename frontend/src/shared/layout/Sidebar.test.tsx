import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { Sidebar } from './Sidebar';

afterEach(() => localStorage.clear());

it('Đăng xuất xoá session (token) khỏi localStorage và về /login', () => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName: 'Nhân viên',
      departmentCode: null,
    }),
  );
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Sidebar />} />
          <Route path="/login" element={<p>LOGIN</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

  expect(localStorage.getItem('idsm.session')).toBeNull();
  expect(screen.getByText('LOGIN')).toBeInTheDocument();
});

const renderSidebarAs = (roleName: string) => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode: null,
    }),
  );
  render(
    <SessionProvider>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </SessionProvider>,
  );
};

it('Quản trị viên thấy mục "Người dùng"', () => {
  renderSidebarAs('Quản trị viên');
  expect(screen.getByRole('link', { name: 'Người dùng' })).toBeInTheDocument();
});

it('Nhân viên không thấy mục "Người dùng" nhưng vẫn thấy "Cài đặt"', () => {
  renderSidebarAs('Nhân viên');
  expect(screen.queryByRole('link', { name: 'Người dùng' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Cài đặt' })).toBeInTheDocument();
});
