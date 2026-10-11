import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CreateOrderPage } from './CreateOrderPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

const envelope = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }));

it('chọn phòng ban → người → tick thiết bị đã lọc → gửi đúng body', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/departments')) return envelope([{ id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' }]);
    if (url.endsWith('/users/lookup'))
      return envelope([
        { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
        { id: 1, fullName: 'Quản trị', username: 'admin', departmentId: null },
      ]);
    if (url.endsWith('/device-types')) return envelope([{ id: 1, typeName: 'Laptop', prefix: 'LT' }]);
    if (url.includes('/devices'))
      return envelope([
        { id: 3, deviceCode: 'LT-000003', deviceName: 'Dell', serialNumber: null, location: null, deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' } },
      ]);
    return envelope({ id: 1 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter>
      <CreateOrderPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByLabelText('Cấp phát'));
  await waitFor(() => expect(screen.getByRole('option', { name: 'Phòng Kỹ thuật' })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  await screen.findByRole('option', { name: 'Nguyễn Văn A (a)' });
  expect(screen.queryByRole('option', { name: 'Quản trị (admin)' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Người nhận'), { target: { value: '7' } });
  fireEvent.click(await screen.findByLabelText('LT-000003 — Dell'));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }));

  await waitFor(() => {
    const call = fetchMock.mock.calls.find(
      (c) => (c[0] as string).endsWith('/device-orders') && (c[1] as RequestInit)?.method === 'POST',
    );
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      type: 'Cấp phát',
      targetUserId: 7,
      deviceIds: [3],
    });
  });
});
