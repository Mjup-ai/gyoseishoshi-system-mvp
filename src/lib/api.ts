const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://gyoseishoshi.mjup.co.jp';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, init);
}
