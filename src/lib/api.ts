interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) {
    throw new ApiError(
      payload.error?.code ?? 'REQUEST_FAILED',
      payload.error?.message ?? '요청을 처리하지 못했습니다.',
      response.status,
    );
  }
  if (payload.data === null) throw new ApiError('EMPTY_RESPONSE', '응답 데이터가 없습니다.', response.status);
  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadPdf: async <T>(roomId: string, file: File) => request<T>(
    `/api/v1/files?room_id=${encodeURIComponent(roomId)}&name=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/pdf' },
    },
  ),
};
