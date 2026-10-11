import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { LoginPage } from './LoginPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPage() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('Enter ở ô Username: chuyển focus sang Password, không gửi đăng nhập', () => {
  const fetchMock = renderPage();
  const username = screen.getByLabelText('Username');
  fireEvent.change(username, { target: { value: 'admin' } });
  fireEvent.keyDown(username, { key: 'Enter' });
  expect(screen.getByLabelText('Password')).toHaveFocus();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('icon con mắt bật / tắt hiện mật khẩu', () => {
  renderPage();
  const password = screen.getByLabelText('Password');
  expect(password).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(password).toHaveAttribute('type', 'password');
});
