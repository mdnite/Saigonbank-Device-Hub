const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Mọi response BE đều bọc dạng này (backend/src/shared/http/api-response.ts). */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

/** POST JSON tới BE, trả `data`; lỗi thì ném Error mang `message` tiếng Việt từ BE. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ, vui lòng thử lại sau');
  }

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !envelope?.success) {
    throw new Error(envelope?.message ?? 'Đã có lỗi xảy ra');
  }
  return envelope.data;
}
