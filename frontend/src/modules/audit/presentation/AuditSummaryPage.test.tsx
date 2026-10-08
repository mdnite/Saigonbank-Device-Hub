import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { AuditSummaryPage } from './AuditSummaryPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderSummary(roleName: string) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName, departmentCode: 'KETOAN' }),
  );
  const summary = {
    id: 4,
    title: 'Quý 3',
    purpose: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: { id: 5, fullName: 'CTV Kế toán' },
    auditCount: 1,
    audits: [{ id: 3, unitName: 'Kho', purpose: 'Định kỳ', dueDate: '2026-09-30T00:00:00.000Z', decidedAt: null, deviceCount: 5 }],
    matrix: [
      { unitName: 'Kho', deviceTypeName: 'Laptop', total: 2, ok: 1, missing: 1, broken: 0 },
      { unitName: 'Kho', deviceTypeName: 'Máy in', total: 3, ok: 2, missing: 0, broken: 1 },
    ],
  };
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ success: true, data: summary, error: null, message: 'OK' }), { status: 200 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/audit/summaries/4']}>
        <Routes>
          <Route path="/audit/summaries/:id" element={<AuditSummaryPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('hiện các đợt thành phần, ma trận và dòng Tổng cộng', async () => {
  renderSummary('Trưởng phòng');
  expect(await screen.findByRole('heading', { name: 'Quý 3' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Đợt #3' })).toHaveAttribute('href', '/audit/3');
  const totalRow = screen.getByText('Tổng cộng').closest('tr')!;
  expect(totalRow).toHaveTextContent('5');
  expect(totalRow).toHaveTextContent('3');
});

it('TP Kế toán bấm Xoá (confirm) → DELETE /audit-summaries/4', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderSummary('Trưởng phòng');
  fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/audit-summaries/4') && i?.method === 'DELETE')).toBe(true),
  );
});

it('Chuyên viên không thấy nút Xoá', async () => {
  renderSummary('Chuyên viên');
  await screen.findByRole('heading', { name: 'Quý 3' });
  expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
});
