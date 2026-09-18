import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { Sidebar } from './Sidebar';

it('Đăng xuất xoá session (token) khỏi localStorage và về /login', () => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: 'jwt' }),
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
