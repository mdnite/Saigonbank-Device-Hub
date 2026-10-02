import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { AuditSummaryPage } from './AuditSummaryPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('hiện các đợt thành phần, ma trận và dòng Tổng cộng', async () => {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({ userId: '1', displayName: 'A', email: 'a@b.vn', token: fakeJwt(inOneHour()), roleName: 'Trưởng phòng', departmentCode: 'KETOAN' }),
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, data: summary, error: null, message: 'OK' }), { status: 200 })),
    ),
  );
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/audit/summaries/4']}>
        <Routes>
          <Route path="/audit/summaries/:id" element={<AuditSummaryPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Quý 3' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Đợt #3' })).toHaveAttribute('href', '/audit/3');
  const totalRow = screen.getByText('Tổng cộng').closest('tr')!;
  expect(totalRow).toHaveTextContent('5');
  expect(totalRow).toHaveTextContent('3');
});
