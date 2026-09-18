import type { Env } from '../types';
import { failure, json, readJson } from '../lib/http';
import { appendCookies, memberSession } from '../lib/session';
import { restFetch } from '../lib/upstream';

interface CreateRoomBody { goal?: string; d_day?: string | null; template_key?: string | null; study_style?: string | null; duration_minutes?: number | null }

async function requireMember(request: Request, env: Env) { return memberSession(request, env); }

export async function roomsRoute(request: Request, env: Env): Promise<Response> {
  const member = await requireMember(request, env);
  if (!member) return failure(401, 'AUTH_REQUIRED', '개인 학습공간은 로그인이 필요합니다.');
  const headers = new Headers(); appendCookies(headers, member.responseCookies);

  if (request.method === 'GET') {
    const response = await restFetch(env, '/rooms?select=id,title,goal,d_day,template_key,study_style,duration_minutes,state,created_at,updated_at&kind=eq.personal&deleted_at=is.null&order=updated_at.desc', member.accessToken);
    if (!response.ok) return failure(502, 'ROOMS_UNAVAILABLE', 'ROOM을 불러오지 못했습니다.', headers);
    return json(await response.json(), 200, headers);
  }

  let body: CreateRoomBody;
  try { body = await readJson<CreateRoomBody>(request); } catch { return failure(400, 'INVALID_BODY', 'ROOM 정보를 확인해주세요.', headers); }
  const goal = body.goal?.trim() ?? '';
  if (!goal || goal.length > 120) return failure(422, 'INVALID_GOAL', '목표는 1~120자로 입력해주세요.', headers);
  if (body.duration_minutes != null && ![20,40,60].includes(body.duration_minutes)) return failure(422, 'INVALID_DURATION', '학습 시간은 20분, 40분, 60분 중 선택해주세요.', headers);

  const response = await restFetch(env, '/rpc/create_personal_room', member.accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_goal: goal, p_d_day: body.d_day || null, p_template_key: body.template_key || null, p_study_style: body.study_style || null, p_duration_minutes: body.duration_minutes ?? null }),
  });
  if (!response.ok) {
    const raw = await response.text();
    if (raw.includes('ROOM_LIMIT_REACHED')) return failure(409, 'ROOM_LIMIT_REACHED', '활성 개인 학습공간은 최대 5개까지 만들 수 있습니다.', headers);
    if (raw.includes('ROOM_CREATE_COOLDOWN')) return failure(429, 'ROOM_CREATE_COOLDOWN', '새 학습공간은 마지막 생성 후 24시간 뒤에 만들 수 있습니다.', headers);
    return failure(502, 'ROOM_CREATE_FAILED', 'ROOM을 만들지 못했습니다.', headers);
  }
  const created = await response.json() as unknown;
  return json(Array.isArray(created) ? (created[0] ?? null) : created, 201, headers);
}

export async function roomDetailRoute(request: Request, env: Env, roomId: string): Promise<Response> {
  const member = await requireMember(request, env);
  if (!member) return failure(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  const headers = new Headers(); appendCookies(headers, member.responseCookies);
  if (!/^[0-9a-f-]{36}$/iu.test(roomId)) return failure(404, 'ROOM_NOT_FOUND', 'ROOM을 찾을 수 없습니다.', headers);
  const [roomResponse, materialsResponse, curriculumResponse] = await Promise.all([
    restFetch(env, `/rooms?id=eq.${encodeURIComponent(roomId)}&select=id,title,goal,d_day,template_key,study_style,duration_minutes,state,created_at,updated_at`, member.accessToken),
    restFetch(env, `/materials?room_id=eq.${encodeURIComponent(roomId)}&select=id,original_name,size_bytes,status,created_at&order=created_at.desc`, member.accessToken),
    restFetch(env, `/curricula?room_id=eq.${encodeURIComponent(roomId)}&select=id,title,curriculum_items(id,position,title,status)&order=created_at.asc`, member.accessToken),
  ]);
  if (!roomResponse.ok || !materialsResponse.ok || !curriculumResponse.ok) return failure(502, 'ROOM_UNAVAILABLE', 'ROOM을 불러오지 못했습니다.', headers);
  const rooms = await roomResponse.json() as unknown[];
  if (!rooms[0]) return failure(404, 'ROOM_NOT_FOUND', 'ROOM을 찾을 수 없습니다.', headers);
  try { await restFetch(env, `/rooms?id=eq.${encodeURIComponent(roomId)}`, member.accessToken, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ last_activity_at: new Date().toISOString() }) }); } catch { /* activity touch is best-effort */ }
  return json({ room: rooms[0], materials: await materialsResponse.json(), curricula: await curriculumResponse.json() }, 200, headers);
}
