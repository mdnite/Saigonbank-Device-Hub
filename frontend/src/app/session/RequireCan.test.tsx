import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { canWriteDevices } from '@/modules/auth/domain/session';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { RequireCan } from './RequireCan';
import { SessionProvider } from './SessionContext';

afterEach(() => localStorage.clear());

function openDeviceForm(roleName: string, departmentCode: string | null) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode,
    }),
  );
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/devices/new']}>
        <Routes>
          <Route element={<RequireCan can={canWriteDevices} to="/devices" />}>
            <Route path="/devices/new" element={<p>FORM</p>} />
          </Route>
          <Route path="/devices" element={<p>LIST</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Chuyên viên Kỹ thuật vào được trang thêm thiết bị', () => {
  openDeviceForm('Chuyên viên', 'KYTHUAT');
  expect(screen.getByText('FORM')).toBeInTheDocument();
});

it('Quản trị viên gõ thẳng URL trang thêm thiết bị: bị đưa về danh sách', () => {
  openDeviceForm('Quản trị viên', null);
  expect(screen.queryByText('FORM')).toBeNull();
  expect(screen.getByText('LIST')).toBeInTheDocument();
});
