import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireCan } from './session/RequireCan';
import {
  canAccessAudits,
  canAccessOrders,
  canAccessTransfers,
  canCreateOrder,
  canCreateTransfer,
  canWriteDevices,
  isAdmin,
} from '@/modules/auth/domain/session';
import { RequireAuth } from './session/RequireAuth';
import { NotFoundPage } from './NotFoundPage';
import { AppShell } from '@/shared/layout/AppShell';
import { AuthLayout } from '@/shared/layout/AuthLayout';
import { AuditHomePage } from '@/modules/audit/presentation/AuditHomePage';
import { AuditDetailPage } from '@/modules/audit/presentation/AuditDetailPage';
import { LoginPage } from '@/modules/auth/presentation/LoginPage';
import { ForgotPasswordPage } from '@/modules/auth/presentation/ForgotPasswordPage';
import { OtpPage } from '@/modules/auth/presentation/OtpPage';
import { ResetPasswordPage } from '@/modules/auth/presentation/ResetPasswordPage';
import { DashboardPage } from '@/modules/dashboard/presentation/DashboardPage';
import { DeviceCatalogPage } from '@/modules/device/presentation/DeviceCatalogPage';
import { AssetFormPage } from '@/modules/device/presentation/AssetFormPage';
import { UserSettingsPage } from '@/modules/user/presentation/UserSettingsPage';
import { UserListPage } from '@/modules/user/presentation/UserListPage';
import { CreateUserPage } from '@/modules/user/presentation/CreateUserPage';
import { DeviceOrderListPage } from '@/modules/allocation/presentation/DeviceOrderListPage';
import { CreateOrderPage } from '@/modules/allocation/presentation/CreateOrderPage';
import { DeviceTransferListPage } from '@/modules/transfer/presentation/DeviceTransferListPage';
import { CreateTransferPage } from '@/modules/transfer/presentation/CreateTransferPage';

/** Wraps the auth screens in the split illustration layout. */
function AuthShell() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthShell />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/verify-otp', element: <OtpPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/devices', element: <DeviceCatalogPage /> },
          {
            element: <RequireCan can={canWriteDevices} to="/devices" />,
            children: [
              { path: '/devices/new', element: <AssetFormPage /> },
              { path: '/devices/:id/edit', element: <AssetFormPage /> },
            ],
          },
          {
            element: <RequireCan can={canAccessOrders} />,
            children: [
              { path: '/allocation', element: <DeviceOrderListPage /> },
              {
                element: <RequireCan can={canCreateOrder} to="/allocation" />,
                children: [{ path: '/allocation/new', element: <CreateOrderPage /> }],
              },
            ],
          },
          {
            element: <RequireCan can={isAdmin} />,
            children: [
              { path: '/users', element: <UserListPage /> },
              { path: '/users/new', element: <CreateUserPage /> },
            ],
          },
          { path: '/settings', element: <UserSettingsPage /> },
          {
            element: <RequireCan can={canAccessTransfers} />,
            children: [
              { path: '/transfers', element: <DeviceTransferListPage /> },
              {
                element: <RequireCan can={canCreateTransfer} to="/transfers" />,
                children: [{ path: '/transfers/new', element: <CreateTransferPage /> }],
              },
            ],
          },
          {
            element: <RequireCan can={canAccessAudits} />,
            children: [
              { path: '/audit', element: <AuditHomePage /> },
              { path: '/audit/:id', element: <AuditDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
