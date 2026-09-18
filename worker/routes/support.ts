import type { Env } from '../types';
import { failure, json, readJson } from '../lib/http';
import { publicRpc } from '../lib/upstream';
import { appendCookies, guestCookieForId, guestId, memberSession, newGuestCookie } from '../lib/session';

interface SupportBody { category?: string; title?: string; body?: string }
const CATEGORIES = new Set(['account','materials','commons','feature','other']);

export async function supportRoute(request: Request, env: Env): Promise<Response> {
  const member = await memberSession(request, env);
  const headers = new Headers();
  let actorType: 'member'|'guest'; let actorId: string; let memberId: string|null = null;
  if (member) { actorType='member'; actorId=member.user.id; memberId=member.user.id; appendCookies(headers, member.responseCookies); }
  else {
    actorType='guest'; const existing=await guestId(request,env);
    if (existing) { actorId=existing; headers.append('Set-Cookie',await guestCookieForId(existing,env)); }
    else { const guest=await newGuestCookie(env); actorId=guest.id; headers.append('Set-Cookie',guest.cookie); }
  }
  let body: SupportBody;
  try { body=await readJson<SupportBody>(request); } catch { return failure(400,'INVALID_BODY','문의 내용을 확인해주세요.',headers); }
  const category=body.category ?? ''; const title=body.title?.trim() ?? ''; const content=body.body?.trim() ?? '';
  if (!CATEGORIES.has(category) || title.length<2 || title.length>80 || content.length<10 || content.length>1500) return failure(422,'INVALID_SUPPORT_TICKET','문의 유형, 제목, 내용을 확인해주세요.',headers);
  const response=await publicRpc(env,'submit_support_ticket',{p_actor_type:actorType,p_actor_id:actorId,p_member_id:memberId,p_category:category,p_title:title,p_body:content},true);
  if (!response.ok) { const raw=await response.text(); if(raw.includes('RATE_LIMITED')) return failure(429,'RATE_LIMITED','문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',headers); return failure(502,'SUPPORT_FAILED','문의를 저장하지 못했습니다.',headers); }
  return json({ ticket_id: await response.json(), status:'open' },201,headers);
}
