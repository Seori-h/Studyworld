import { requireEnum } from '../lib/validation.js';

const MODES = Object.freeze(['coding', 'recall', 'brainstorm', 'reading']);
const EVENTS = Object.freeze(['mode_selected', 'mode_switched', 'recommendation_accepted', 'flash_grade', 'session_completed', 'tool_used', 'ai_action']);
const TOOL_ACTIONS = Object.freeze(['timer', 'bgm', 'static_check', 'hint', 'answer_reveal']);

function blankProfile(profileId) {
  return {
    profileId,
    scores: { coding: 0, recall: 0, brainstorm: 0, reading: 0 },
    shortSessionScore: 0,
    independentFirstScore: 0,
    modeSwitchCount: 0,
    completedSessionCount: 0,
    toolUse: { timer: 0, bgm: 0, staticCheck: 0, hint: 0 },
    attemptBeforeAnswerCount: 0,
    recommendationAcceptCount: 0,
    aiActionCount: 0,
    sampleCount: 0,
    confidence: 'early',
    updatedAt: null,
  };
}

function confidenceFor(sampleCount) {
  if (sampleCount >= 20) return 'established';
  if (sampleCount >= 8) return 'forming';
  return 'early';
}

function labelsFor(profile) {
  const entries = Object.entries(profile.scores).sort((a, b) => b[1] - a[1]);
  const labels = [];
  if (profile.sampleCount >= 5 && entries[0]?.[1] > 0) {
    const names = { coding: '코드·실행 중심', recall: '회상형 학습', brainstorm: '아이디어 확장형', reading: '원문·독해형' };
    labels.push(`${names[entries[0][0]]} 선호`);
  }
  if (profile.shortSessionScore >= 2) labels.push('짧은 집중 세션 선호');
  if (profile.attemptBeforeAnswerCount >= 2 || profile.independentFirstScore >= 3) labels.push('먼저 시도한 뒤 피드백 선호');
  if (profile.toolUse.hint >= 3) labels.push('단계적 힌트 활용');
  if (profile.toolUse.timer >= 3) labels.push('타이머 활용 빈도 높음');
  return labels.slice(0, 4);
}

export class LearningPreferenceService {
  constructor(db) { this.db = db; }

  async get(profileId) {
    const row = await this.db.prepare('SELECT * FROM learning_preferences WHERE profile_id=? LIMIT 1').bind(profileId).first();
    if (!row) return { ...blankProfile(profileId), labels: [] };
    const profile = {
      profileId,
      scores: {
        coding: Number(row.coding_score || 0),
        recall: Number(row.recall_score || 0),
        brainstorm: Number(row.brainstorm_score || 0),
        reading: Number(row.reading_score || 0),
      },
      shortSessionScore: Number(row.short_session_score || 0),
      independentFirstScore: Number(row.independent_first_score || 0),
      modeSwitchCount: Number(row.mode_switch_count || 0),
      completedSessionCount: Number(row.completed_session_count || 0),
      toolUse: {
        timer: Number(row.timer_use_count || 0),
        bgm: Number(row.bgm_use_count || 0),
        staticCheck: Number(row.static_check_count || 0),
        hint: Number(row.hint_use_count || 0),
      },
      attemptBeforeAnswerCount: Number(row.attempt_before_answer_count || 0),
      recommendationAcceptCount: Number(row.recommendation_accept_count || 0),
      aiActionCount: Number(row.ai_action_count || 0),
      sampleCount: Number(row.sample_count || 0),
      confidence: confidenceFor(Number(row.sample_count || 0)),
      updatedAt: row.updated_at || null,
    };
    return { ...profile, labels: labelsFor(profile) };
  }

  async record(profileId, payload = {}) {
    const eventType = requireEnum(String(payload.eventType || ''), EVENTS, 'eventType');
    const mode = payload.mode ? requireEnum(String(payload.mode), MODES, 'mode') : '';
    const durationSeconds = Math.max(0, Math.min(4 * 60 * 60, Number(payload.durationSeconds || 0)));
    const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
    const action = typeof metadata.action === 'string' ? metadata.action.slice(0, 40) : undefined;
    const allowedMetadata = {
      grade: ['again', 'hard', 'know'].includes(metadata.grade) ? metadata.grade : undefined,
      action,
      source: typeof metadata.source === 'string' ? metadata.source.slice(0, 24) : undefined,
      attempted: typeof metadata.attempted === 'boolean' ? metadata.attempted : undefined,
      hintUsed: typeof metadata.hintUsed === 'boolean' ? metadata.hintUsed : undefined,
    };
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const increments = {
      coding: 0, recall: 0, brainstorm: 0, reading: 0,
      short: 0, independent: 0, switched: 0, completed: 0,
      timer: 0, bgm: 0, staticCheck: 0, hint: 0,
      attempted: 0, recommendation: 0, aiAction: 0,
    };

    if (eventType === 'mode_selected' && mode) increments[mode] += 1;
    if (eventType === 'mode_switched' && mode) {
      increments[mode] += 1;
      increments.switched += 1;
    }
    if (eventType === 'recommendation_accepted') {
      if (mode) increments[mode] += 2;
      increments.recommendation += 1;
    }
    if (eventType === 'flash_grade') {
      increments.recall += 1;
    }
    if (eventType === 'session_completed') {
      increments.completed += 1;
      if (durationSeconds > 0 && durationSeconds <= 35 * 60) increments.short += 1;
    }
    if (eventType === 'tool_used' && TOOL_ACTIONS.includes(action)) {
      if (action === 'timer') increments.timer += 1;
      if (action === 'bgm') increments.bgm += 1;
      if (action === 'static_check') increments.staticCheck += 1;
      if (action === 'hint') increments.hint += 1;
      if (action === 'answer_reveal' && allowedMetadata.attempted) {
        increments.attempted += 1;
        increments.independent += allowedMetadata.hintUsed ? 1 : 2;
      }
    }
    if (eventType === 'ai_action') {
      increments.aiAction += 1;
      if (action === 'code_review') increments.coding += 1;
      if (action === 'summary' || action === 'paragraph_explain') increments.reading += 1;
      if (action === 'node_suggestion') increments.brainstorm += 1;
      if (action === 'flashcards') increments.recall += 1;
    }

    await this.db.batch([
      this.db.prepare('INSERT INTO learning_events (id,profile_id,event_type,mode,duration_seconds,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)')
        .bind(id, profileId, eventType, mode || null, durationSeconds, JSON.stringify(allowedMetadata), now),
      this.db.prepare(`INSERT INTO learning_preferences
        (profile_id,coding_score,recall_score,brainstorm_score,reading_score,short_session_score,independent_first_score,mode_switch_count,completed_session_count,timer_use_count,bgm_use_count,static_check_count,sample_count,updated_at,hint_use_count,attempt_before_answer_count,recommendation_accept_count,ai_action_count)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(profile_id) DO UPDATE SET
          coding_score=coding_score+excluded.coding_score,
          recall_score=recall_score+excluded.recall_score,
          brainstorm_score=brainstorm_score+excluded.brainstorm_score,
          reading_score=reading_score+excluded.reading_score,
          short_session_score=short_session_score+excluded.short_session_score,
          independent_first_score=independent_first_score+excluded.independent_first_score,
          mode_switch_count=mode_switch_count+excluded.mode_switch_count,
          completed_session_count=completed_session_count+excluded.completed_session_count,
          timer_use_count=timer_use_count+excluded.timer_use_count,
          bgm_use_count=bgm_use_count+excluded.bgm_use_count,
          static_check_count=static_check_count+excluded.static_check_count,
          sample_count=sample_count+1,
          updated_at=excluded.updated_at,
          hint_use_count=hint_use_count+excluded.hint_use_count,
          attempt_before_answer_count=attempt_before_answer_count+excluded.attempt_before_answer_count,
          recommendation_accept_count=recommendation_accept_count+excluded.recommendation_accept_count,
          ai_action_count=ai_action_count+excluded.ai_action_count`)
        .bind(
          profileId,
          increments.coding, increments.recall, increments.brainstorm, increments.reading,
          increments.short, increments.independent, increments.switched, increments.completed,
          increments.timer, increments.bgm, increments.staticCheck, 1, now,
          increments.hint, increments.attempted, increments.recommendation, increments.aiAction,
        ),
    ]);
    return this.get(profileId);
  }

  async hint(profileId) {
    const profile = await this.get(profileId);
    if (profile.sampleCount < 5) return '';
    const labels = profile.labels.length ? profile.labels.join(', ') : '뚜렷한 선호가 아직 없음';
    return `누적 학습 패턴(${profile.confidence}): ${labels}. 완료 세션 ${profile.completedSessionCount}회, 모드 전환 ${profile.modeSwitchCount}회, AI 추천 수락 ${profile.recommendationAcceptCount}회. 현재 사용자의 명시적 요청을 항상 우선하세요.`;
  }
}

export { MODES as LEARNING_MODES, EVENTS as LEARNING_EVENTS, confidenceFor as preferenceConfidenceFor };
