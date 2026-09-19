const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Mọi response BE đều bọc dạng này (backend/src/shared/http/api-response.ts). */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ApiSession {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let session: ApiSession = { getToken: () => null, onUnauthorized: () => {} };

/** SessionProvider đăng ký: lấy token hiện tại + tự đăng xuất khi BE trả 401. */
export function configureApiSession(next: ApiSession): void {
  session = next;
}

/** Gọi BE, trả `data` của envelope; lỗi thì ném Error mang `message` tiếng Việt từ BE. */
export async function apiRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = session.getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ, vui lòng thử lại sau');
  }

  // Chỉ coi là hết phiên khi đã gửi token — 401 của /auth/login (sai mật khẩu) không có token.
  if (res.status === 401 && token) session.onUnauthorized();

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !envelope?.success) {
    throw new Error(envelope?.message ?? 'Đã có lỗi xảy ra');
  }
  return envelope.data;
}

export function apiGet<T>(path: string, query: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return apiRequest<T>('GET', qs ? `${path}?${qs}` : path);
}

export const apiPost = <T>(path: string, body: unknown) => apiRequest<T>('POST', path, body);
export const apiPatch = <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body);
export const apiDelete = <T>(path: string) => apiRequest<T>('DELETE', path);
