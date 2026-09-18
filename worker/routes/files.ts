import type { Env } from '../types';
import { failure, json } from '../lib/http';
import { appendCookies, memberSession } from '../lib/session';
import { restFetch, storageFetch } from '../lib/upstream';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function cleanName(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/gu, '').trim();
  return normalized.slice(0, 160) || 'material.pdf';
}

export async function uploadFileRoute(request: Request, env: Env): Promise<Response> {
  const member = await memberSession(request, env);
  if (!member) return failure(401, 'AUTH_REQUIRED', '파일 업로드는 로그인이 필요합니다.');
  const headers = new Headers(); appendCookies(headers, member.responseCookies);
  const url = new URL(request.url);
  const roomId = url.searchParams.get('room_id') ?? '';
  const originalName = cleanName(url.searchParams.get('name') ?? 'material.pdf');
  if (!/^[0-9a-f-]{36}$/iu.test(roomId)) return failure(422, 'INVALID_ROOM', 'ROOM 정보를 확인해주세요.', headers);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/pdf') return failure(415, 'PDF_ONLY', '현재 PDF 파일만 업로드할 수 있습니다.', headers);
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (declaredLength > MAX_FILE_BYTES) return failure(413, 'FILE_TOO_LARGE', '파일은 최대 10MB까지 업로드할 수 있습니다.', headers);

  const ownership = await restFetch(env, `/rooms?id=eq.${encodeURIComponent(roomId)}&select=id`, member.accessToken);
  if (!ownership.ok) return failure(502, 'ROOM_CHECK_FAILED', 'ROOM 권한을 확인하지 못했습니다.', headers);
  const roomRows = await ownership.json() as unknown[];
  if (!roomRows.length) return failure(404, 'ROOM_NOT_FOUND', 'ROOM을 찾을 수 없습니다.', headers);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) return failure(413, 'FILE_TOO_LARGE', '파일은 최대 10MB까지 업로드할 수 있습니다.', headers);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return failure(415, 'INVALID_PDF', '올바른 PDF 파일이 아닙니다.', headers);

  const objectPath = `${member.user.id}/${roomId}/${crypto.randomUUID()}.pdf`;
  const upload = await storageFetch(env, `/object/study-materials/${objectPath}`, member.accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes,
  });
  if (!upload.ok) return failure(502, 'UPLOAD_FAILED', '파일을 저장하지 못했습니다.', headers);

  const saved = await restFetch(env, '/materials?select=id,original_name,size_bytes,status,created_at', member.accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ owner_id: member.user.id, room_id: roomId, object_path: objectPath, original_name: originalName, mime_type: 'application/pdf', size_bytes: bytes.byteLength, status: 'uploaded' }),
  });
  if (!saved.ok) {
    await storageFetch(env, `/object/study-materials/${objectPath}`, member.accessToken, { method: 'DELETE' });
    return failure(502, 'MATERIAL_SAVE_FAILED', '파일 정보를 저장하지 못했습니다.', headers);
  }
  const rows = await saved.json() as unknown[];
  return json(rows[0] ?? null, 201, headers);
}
