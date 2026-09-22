import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAdmin } from './session/RequireAdmin';
import { RequireAuth } from './session/RequireAuth';
import { NotFoundPage } from './NotFoundPage';
import { AppShell } from '@/shared/layout/AppShell';
import { AuthLayout } from '@/shared/layout/AuthLayout';
import { ComingSoonPage } from '@/shared/layout/ComingSoonPage';
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
          { path: '/devices/new', element: <AssetFormPage /> },
          { path: '/devices/:id/edit', element: <AssetFormPage /> },
          { path: '/allocation', element: <ComingSoonPage title="Cấp phát - Thu hồi" /> },
          {
            element: <RequireAdmin />,
            children: [
              { path: '/users', element: <UserListPage /> },
              { path: '/users/new', element: <CreateUserPage /> },
            ],
          },
          { path: '/settings', element: <UserSettingsPage /> },
          { path: '/transfers', element: <ComingSoonPage title="Điều chuyển" /> },
          { path: '/audit', element: <ComingSoonPage title="Kiểm kê" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
