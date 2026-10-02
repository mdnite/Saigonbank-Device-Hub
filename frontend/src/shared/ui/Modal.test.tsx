import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Modal } from './Modal';

it('mở: hiện tiêu đề, nội dung, footer; nút Đóng gọi onClose', () => {
  const onClose = vi.fn();
  render(
    <Modal open title="Lập lịch kiểm kê" onClose={onClose} footer={<button>Lập lịch</button>}>
      <p>Nội dung</p>
    </Modal>,
  );
  expect(screen.getByRole('heading', { name: 'Lập lịch kiểm kê' })).toBeInTheDocument();
  expect(screen.getByText('Nội dung')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lập lịch' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(onClose).toHaveBeenCalled();
});

it('đóng: không render nội dung', () => {
  render(
    <Modal open={false} title="X" onClose={() => {}}>
      <p>Nội dung</p>
    </Modal>,
  );
  expect(screen.queryByText('Nội dung')).toBeNull();
});
