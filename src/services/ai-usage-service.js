import { POLICY } from '../config.js';
import { HttpError } from '../lib/http.js';
import { classifyModification } from './room-policy-service.js';
export class AiUsageService {
  constructor(env){this.db=env.DB;}
  async consume(profileId,spaceId,prompt,explicitKind=''){const kind=classifyModification(prompt,explicitKind),limit=POLICY.aiDailyLimits[kind],date=new Date().toISOString().slice(0,10),column=`${kind}_count`,now=new Date().toISOString(),initial={minor:0,layout:0,feature:0};initial[kind]=1;const sql=`INSERT INTO ai_usage_daily (profile_id,usage_date,minor_count,layout_count,feature_count,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(profile_id,usage_date) DO UPDATE SET ${column}=${column}+1,updated_at=excluded.updated_at WHERE ${column}<? RETURNING minor_count,layout_count,feature_count`;const row=await this.db.prepare(sql).bind(profileId,date,initial.minor,initial.layout,initial.feature,now,limit).first();if(!row)throw new HttpError(429,'AI_ROOM_MODIFICATION_LIMIT',`오늘 가능한 ${kind} 수정 사용량을 모두 사용했습니다.`,{kind,limit});await this.db.prepare('INSERT INTO ai_usage_events (id,profile_id,space_id,usage_kind,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),profileId,spaceId||null,kind,now).run();const used=Number(row[`${kind}_count`]||0);return{kind,limit,used,remaining:Math.max(0,limit-used)};}
}
