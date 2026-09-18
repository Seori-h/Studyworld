import type { Env } from '../types';
import { failure, json, readJson } from '../lib/http';
import { publicRpc } from '../lib/upstream';
import { appendCookies, guestCookieForId, guestId, memberSession, newGuestCookie } from '../lib/session';

interface NicknameBody { nickname?: string }
interface AnswerBody { run_id?: string; question_id?: string; choice?: number }

async function rpcJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
  return response.json();
}

async function actor(request: Request, env: Env, createGuest: boolean) {
  const member = await memberSession(request, env);
  const headers = new Headers();
  if (member) {
    appendCookies(headers, member.responseCookies);
    return { actorType: 'member' as const, actorId: member.user.id, headers, memberId: member.user.id };
  }
  const existing = await guestId(request, env);
  if (existing) {
    headers.append('Set-Cookie', await guestCookieForId(existing, env));
    return { actorType: 'guest' as const, actorId: existing, headers, memberId: null };
  }
  if (!createGuest) return null;
  const guest = await newGuestCookie(env);
  headers.append('Set-Cookie', guest.cookie);
  return { actorType: 'guest' as const, actorId: guest.id, headers, memberId: null };
}

export async function guestNicknameRoute(request: Request, env: Env): Promise<Response> {
  const current = await actor(request, env, true);
  if (!current) return failure(500, 'GUEST_SESSION_FAILED', '비회원 세션을 만들지 못했습니다.');
  if (current.actorType === 'member') return failure(409, 'MEMBER_SESSION', '회원은 별도 닉네임 등록이 필요하지 않습니다.', current.headers);
  let body: NicknameBody;
  try { body = await readJson<NicknameBody>(request); } catch { return failure(400, 'INVALID_BODY', '닉네임 형식이 올바르지 않습니다.', current.headers); }
  const nickname = body.nickname?.trim() ?? '';
  if (nickname.length < 2 || nickname.length > 12 || !/^[가-힣A-Za-z0-9 ]+$/u.test(nickname)) return failure(422, 'INVALID_NICKNAME', '닉네임은 2~12자의 한글·영문·숫자로 입력해주세요.', current.headers);
  try {
    const response = await publicRpc(env, 'set_basic_guest_nickname', { p_guest_id: current.actorId, p_nickname: nickname }, true);
    if (!response.ok) return failure(response.status === 409 ? 409 : 422, 'NICKNAME_UNAVAILABLE', '사용할 수 없는 닉네임입니다.', current.headers);
    return json({ nickname: await response.json() }, 201, current.headers);
  } catch { return failure(502, 'NICKNAME_FAILED', '닉네임을 저장하지 못했습니다.', current.headers); }
}

export async function basicTestStartRoute(request: Request, env: Env): Promise<Response> {
  const current = await actor(request, env, false);
  if (!current) return failure(401, 'GUEST_NICKNAME_REQUIRED', '비회원은 먼저 광장 닉네임을 등록해주세요.');
  try {
    const response = await publicRpc(env, 'start_basic_test', { p_actor_type: current.actorType, p_actor_id: current.actorId }, true);
    if (!response.ok) {
      const raw = await response.text();
      if (raw.includes('GUEST_NICKNAME_REQUIRED')) return failure(401, 'GUEST_NICKNAME_REQUIRED', '비회원은 먼저 광장 닉네임을 등록해주세요.', current.headers);
      return failure(502, 'BASIC_TEST_UNAVAILABLE', 'Basic Test를 시작하지 못했습니다.', current.headers);
    }
    return json(await response.json(), 201, current.headers);
  } catch { return failure(502, 'BASIC_TEST_UNAVAILABLE', 'Basic Test를 시작하지 못했습니다.', current.headers); }
}

export async function basicAnswerRoute(request: Request, env: Env): Promise<Response> {
  const current = await actor(request, env, false);
  if (!current) return failure(401, 'SESSION_REQUIRED', 'Basic Test 세션이 필요합니다.');
  let body: AnswerBody;
  try { body = await readJson<AnswerBody>(request); } catch { return failure(400, 'INVALID_BODY', '답안 형식이 올바르지 않습니다.', current.headers); }
  if (!body.run_id || !body.question_id || !Number.isInteger(body.choice) || (body.choice ?? -1) < 0 || (body.choice ?? 9) > 5) return failure(422, 'INVALID_ANSWER', '답안을 확인해주세요.', current.headers);
  try {
    const response = await publicRpc(env, 'submit_basic_answer', {
      p_actor_type: current.actorType, p_actor_id: current.actorId, p_run_id: body.run_id, p_question_id: body.question_id, p_choice: body.choice,
    }, true);
    if (!response.ok) return failure(422, 'ANSWER_REJECTED', '현재 시험의 답안인지 확인해주세요.', current.headers);
    const rows = await rpcJson(response) as unknown[];
    return json(rows[0] ?? null, 200, current.headers);
  } catch { return failure(502, 'ANSWER_FAILED', '답안을 저장하지 못했습니다.', current.headers); }
}

export async function basicLeaderboardRoute(env: Env): Promise<Response> {
  try { return json(await rpcJson(await publicRpc(env, 'get_basic_leaderboard', { p_limit: 30 }))); }
  catch { return failure(502, 'LEADERBOARD_UNAVAILABLE', '공개 랭킹을 불러오지 못했습니다.'); }
}
