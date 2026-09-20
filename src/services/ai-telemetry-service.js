import { POLICY } from '../config.js';
import { HttpError } from '../lib/http.js';

export class AiTelemetryService {
  constructor(db) { this.db = db; }

  async reserveRequest(profileId) {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const result = await this.db.prepare(`INSERT INTO ai_request_daily
      (profile_id,usage_date,request_count,success_count,failure_count,input_tokens,output_tokens,updated_at)
      VALUES (?,?,1,0,0,0,0,?)
      ON CONFLICT(profile_id,usage_date) DO UPDATE SET
        request_count=ai_request_daily.request_count+1,
        updated_at=excluded.updated_at
      WHERE ai_request_daily.request_count < ?`)
      .bind(profileId, date, now, POLICY.aiDailyRequestMax)
      .run();
    const changed = Number(result?.meta?.changes ?? result?.changes ?? 0);
    if (changed < 1) {
      const row = await this.db.prepare('SELECT request_count FROM ai_request_daily WHERE profile_id=? AND usage_date=? LIMIT 1').bind(profileId, date).first();
      throw new HttpError(429, 'AI_DAILY_REQUEST_LIMIT', '오늘 가능한 AI 학습 요청량을 모두 사용했습니다.', { limit: POLICY.aiDailyRequestMax, used: Number(row?.request_count || POLICY.aiDailyRequestMax) });
    }
    return { date, limit: POLICY.aiDailyRequestMax };
  }

  async record({ profileId, spaceId = null, action, provider = '', model = '', status, latencyMs = 0, inputTokens = 0, outputTokens = 0, errorCode = '', fallbackUsed = false, providerRequestId = '' }) {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare(`INSERT INTO ai_request_logs
        (id,profile_id,space_id,action,provider,model,status,latency_ms,input_tokens,output_tokens,error_code,fallback_used,provider_request_id,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, profileId, spaceId, action, provider, model, status, Math.max(0, Math.round(latencyMs)), Math.max(0, Number(inputTokens || 0)), Math.max(0, Number(outputTokens || 0)), errorCode, fallbackUsed ? 1 : 0, providerRequestId, now),
      this.db.prepare(`UPDATE ai_request_daily SET
          success_count=success_count+?,
          failure_count=failure_count+?,
          input_tokens=input_tokens+?,
          output_tokens=output_tokens+?,
          updated_at=?
        WHERE profile_id=? AND usage_date=?`)
        .bind(status === 'success' ? 1 : 0, status === 'success' ? 0 : 1, Math.max(0, Number(inputTokens || 0)), Math.max(0, Number(outputTokens || 0)), now, profileId, date),
    ]);
    return id;
  }
}
