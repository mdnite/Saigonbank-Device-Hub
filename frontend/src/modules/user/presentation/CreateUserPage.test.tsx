import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { CreateUserPage } from './CreateUserPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const envelope = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }));

const ROLES = [
  { id: 1, roleName: 'Quản trị viên' },
  { id: 2, roleName: 'Trưởng phòng' },
  { id: 3, roleName: 'Nhân viên' },
  { id: 4, roleName: 'Chuyên viên' },
];
const DEPARTMENTS = [
  { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Kỹ thuật' },
  { id: 2, departmentCode: 'KETOAN', departmentName: 'Kế toán' },
  { id: 3, departmentCode: 'KINHDOANH', departmentName: 'Kinh doanh' },
  { id: 4, departmentCode: 'NGHIEPVU', departmentName: 'Nghiệp vụ' },
];

function renderPage() {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName: 'Quản trị viên',
      departmentCode: null,
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => envelope(url.includes('/roles') ? ROLES : DEPARTMENTS)),
  );
  render(
    <SessionProvider>
      <MemoryRouter>
        <CreateUserPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Chức vụ khoá tới khi chọn phòng; KD không có Chuyên viên; đổi phòng xoá chức vụ không hợp lệ', async () => {
  renderPage();
  const role = await screen.findByLabelText(/Chức vụ/);
  expect(role).toBeDisabled();
  await screen.findByRole('option', { name: 'Kỹ thuật' });
  fireEvent.change(screen.getByLabelText(/Phòng ban/), { target: { value: '1' } });
  await waitFor(() => expect(role).not.toBeDisabled());
  expect(within(role).getByRole('option', { name: 'Chuyên viên' })).toBeInTheDocument();
  fireEvent.change(role, { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText(/Phòng ban/), { target: { value: '3' } });
  expect(within(role).queryByRole('option', { name: 'Chuyên viên' })).toBeNull();
  expect((role as HTMLSelectElement).value).toBe('');
});

it('Không phòng ban → chỉ có Quản trị viên', async () => {
  renderPage();
  await screen.findByRole('option', { name: 'Kỹ thuật' });
  fireEvent.change(screen.getByLabelText(/Phòng ban/), { target: { value: 'NONE' } });
  const role = screen.getByLabelText(/Chức vụ/);
  expect(within(role).getAllByRole('option').map((o) => o.textContent)).toEqual(['Chọn chức vụ', 'Quản trị viên']);
});
