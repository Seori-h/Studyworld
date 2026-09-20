PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nickname_key TEXT NOT NULL UNIQUE,
  public_code TEXT NOT NULL UNIQUE,
  visual_seed TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  account_origin TEXT NOT NULL DEFAULT 'member' CHECK (account_origin IN ('member','managed_seed')),
  managed_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_managed_by ON profiles(managed_by_profile_id, account_origin, status);

CREATE TABLE IF NOT EXISTS planet_credentials (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_digest TEXT NOT NULL UNIQUE,
  key_version INTEGER NOT NULL CHECK (key_version >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  issued_at TEXT NOT NULL,
  rotated_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT,
  created_by_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_planet_credentials_active_profile
  ON planet_credentials(profile_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_planet_credentials_profile ON planet_credentials(profile_id, status, key_version DESC);

CREATE TABLE IF NOT EXISTS planet_credential_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_id TEXT REFERENCES planet_credentials(id) ON DELETE SET NULL,
  actor_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('issued','rotated','revoked','bootstrap_issued','pepper_rehashed')),
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_credential_events_profile ON planet_credential_events(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS planet_assets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'planet_art' CHECK (kind IN ('planet_art')),
  r2_object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  sha256 TEXT,
  source TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated','uploaded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_planet_assets_profile ON planet_assets(profile_id, kind, deleted_at);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_digest TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS study_drafts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_study_drafts_profile ON study_drafts(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS study_spaces (
  id TEXT PRIMARY KEY,
  owner_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_kind TEXT NOT NULL DEFAULT 'personal' CHECK (space_kind IN ('personal','group','class')),
  template_key TEXT NOT NULL DEFAULT 'teach',
  title TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  meta_label TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','class','group')),
  discoverable INTEGER NOT NULL DEFAULT 0 CHECK (discoverable IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted_pending','deleted','closed','suspended')),
  creation_cycle_id TEXT,
  recommend_score INTEGER NOT NULL DEFAULT 0 CHECK (recommend_score BETWEEN 0 AND 100),
  popular_score INTEGER NOT NULL DEFAULT 0 CHECK (popular_score BETWEEN 0 AND 100),
  visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  recovery_expires_at TEXT,
  CHECK (space_kind <> 'personal' OR (visibility='private' AND discoverable=0))
);
CREATE INDEX IF NOT EXISTS idx_study_spaces_owner ON study_spaces(owner_profile_id, space_kind, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_spaces_cycle ON study_spaces(creation_cycle_id);
CREATE INDEX IF NOT EXISTS idx_study_spaces_discovery ON study_spaces(discoverable, status, category, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_user_one_active_personal_room_insert
BEFORE INSERT ON study_spaces
WHEN NEW.status='active'
 AND NEW.space_kind='personal'
 AND (SELECT role FROM profiles WHERE id=NEW.owner_profile_id)='user'
 AND EXISTS (
   SELECT 1 FROM study_spaces
   WHERE owner_profile_id=NEW.owner_profile_id AND space_kind='personal' AND status='active'
 )
BEGIN
  SELECT RAISE(ABORT, 'USER_ACTIVE_ROOM_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_one_active_personal_room_restore
BEFORE UPDATE OF status ON study_spaces
WHEN NEW.status='active' AND OLD.status<>'active'
 AND NEW.space_kind='personal'
 AND (SELECT role FROM profiles WHERE id=NEW.owner_profile_id)='user'
 AND EXISTS (
   SELECT 1 FROM study_spaces
   WHERE owner_profile_id=NEW.owner_profile_id AND space_kind='personal' AND status='active' AND id<>NEW.id
 )
BEGIN
  SELECT RAISE(ABORT, 'USER_ACTIVE_ROOM_LIMIT');
END;

CREATE TABLE IF NOT EXISTS room_creation_state (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  cycle_started_at TEXT NOT NULL,
  next_allowed_at TEXT NOT NULL,
  correction_used INTEGER NOT NULL DEFAULT 0 CHECK (correction_used IN (0,1)),
  correction_available INTEGER NOT NULL DEFAULT 0 CHECK (correction_available IN (0,1)),
  last_space_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_creation_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES study_spaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('create','correction_create')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_creation_events_profile_time ON room_creation_events(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS space_members (
  space_id TEXT NOT NULL REFERENCES study_spaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','teacher','member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','kicked','banned')),
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kicked_at TEXT,
  PRIMARY KEY (space_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_space_members_profile ON space_members(profile_id, status, joined_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_joined_room_limit_insert
BEFORE INSERT ON space_members
WHEN NEW.role='member' AND NEW.status='active'
 AND (
   SELECT COUNT(*) FROM space_members m
   JOIN study_spaces s ON s.id=m.space_id
   WHERE m.profile_id=NEW.profile_id AND m.status='active' AND s.owner_profile_id<>NEW.profile_id
 ) >= 5
BEGIN
  SELECT RAISE(ABORT, 'JOINED_ROOM_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS trg_joined_room_limit_reactivate
BEFORE UPDATE OF status ON space_members
WHEN NEW.role='member' AND NEW.status='active' AND OLD.status<>'active'
 AND (
   SELECT COUNT(*) FROM space_members m
   JOIN study_spaces s ON s.id=m.space_id
   WHERE m.profile_id=NEW.profile_id AND m.status='active' AND s.owner_profile_id<>NEW.profile_id
     AND m.space_id<>NEW.space_id
 ) >= 5
BEGIN
  SELECT RAISE(ABORT, 'JOINED_ROOM_LIMIT');
END;

CREATE TABLE IF NOT EXISTS space_rules (
  space_id TEXT PRIMARY KEY REFERENCES study_spaces(id) ON DELETE CASCADE,
  rules_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_state (
  space_id TEXT NOT NULL REFERENCES study_spaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schema_json TEXT NOT NULL DEFAULT 'null',
  context_json TEXT NOT NULL DEFAULT 'null',
  workspace_json TEXT NOT NULL DEFAULT 'null',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (space_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_space_state_profile ON space_state(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  minor_count INTEGER NOT NULL DEFAULT 0,
  layout_count INTEGER NOT NULL DEFAULT 0,
  feature_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, usage_date)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_id TEXT REFERENCES study_spaces(id) ON DELETE SET NULL,
  usage_kind TEXT NOT NULL CHECK (usage_kind IN ('minor','layout','feature')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_space ON ai_usage_events(space_id, created_at DESC);


CREATE TABLE IF NOT EXISTS ai_request_daily (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, usage_date)
);

CREATE TABLE IF NOT EXISTS ai_request_logs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_id TEXT REFERENCES study_spaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('success','failure','fallback')),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  error_code TEXT NOT NULL DEFAULT '',
  fallback_used INTEGER NOT NULL DEFAULT 0 CHECK (fallback_used IN (0,1)),
  provider_request_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_profile_time ON ai_request_logs(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_space_time ON ai_request_logs(space_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('mode_selected','mode_switched','recommendation_accepted','flash_grade','session_completed','tool_used','ai_action')),
  mode TEXT CHECK (mode IS NULL OR mode IN ('coding','recall','brainstorm','reading')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 14400),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_events_profile_time ON learning_events(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_preferences (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  coding_score INTEGER NOT NULL DEFAULT 0,
  recall_score INTEGER NOT NULL DEFAULT 0,
  brainstorm_score INTEGER NOT NULL DEFAULT 0,
  reading_score INTEGER NOT NULL DEFAULT 0,
  short_session_score INTEGER NOT NULL DEFAULT 0,
  independent_first_score INTEGER NOT NULL DEFAULT 0,
  mode_switch_count INTEGER NOT NULL DEFAULT 0 CHECK (mode_switch_count >= 0),
  completed_session_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_session_count >= 0),
  timer_use_count INTEGER NOT NULL DEFAULT 0 CHECK (timer_use_count >= 0),
  bgm_use_count INTEGER NOT NULL DEFAULT 0 CHECK (bgm_use_count >= 0),
  static_check_count INTEGER NOT NULL DEFAULT 0 CHECK (static_check_count >= 0),
  sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL CHECK (board IN ('cert','qa','share')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT '',
  comment_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_community_board_created ON community_posts(board, created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON community_comments(post_id, created_at);

INSERT OR IGNORE INTO community_posts (id,board,title,body,author,created_at,views,likes,tags_json,status,comment_count) VALUES
('cert-1','cert','오늘 3시간 집중 완료!','오늘 목표했던 3시간 집중 세션을 마쳤어요. 마지막 30분은 오답을 다시 보는 데 썼습니다.','모험가A','2026-09-20T11:55:00+09:00',182,24,'["집중","공부인증"]','',0),
('cert-2','cert','정수와 유리수 복습 인증','정수와 유리수 단원을 다시 풀고 틀린 문제 4개를 오답노트에 정리했어요.','모험가B','2026-09-20T11:42:00+09:00',131,18,'["중1수학","복습"]','',0),
('cert-3','cert','직업상담 2차 오답정리','직업상담사 2차 대비 오답을 다시 정리했습니다. 헷갈렸던 법규 파트를 집중적으로 봤어요.','모험가C','2026-09-20T11:29:00+09:00',96,13,'["자격증","오답"]','',0),
('cert-4','cert','뽀모도로 8회 달성','오늘 뽀모도로 8회를 완료했어요. 쉬는 시간을 짧게 가져가니 후반 집중력이 더 좋았습니다.','모험가D','2026-09-20T10:55:00+09:00',88,21,'["루틴","집중"]','',0),
('qa-1','qa','중1 문자와 식 3차 시련 관련 질문입니다!','문자를 포함한 식을 정리할 때 부호가 바뀌는 부분이 계속 헷갈립니다. 풀이 순서를 어떻게 잡으면 좋을까요?','수학탐험가','2026-09-20T11:50:00+09:00',212,9,'["중1수학"]','answered',3),
('qa-2','qa','노동관계법규 2번 문제 풀이 과정 피드백 부탁해요','정답은 맞았는데 풀이 근거가 불안합니다. 제가 적은 과정에서 놓친 부분이 있는지 확인하고 싶어요.','자격성장중','2026-09-20T11:00:00+09:00',124,4,'["자격증","법규"]','waiting',0),
('qa-3','qa','AI 맵 생성할 때 프롬프트 팁 있으신가요?','학습 맵을 만들 때 단계가 너무 크게 나뉘는 문제가 있어요. 세부 단계가 잘 나오게 쓰는 프롬프트 팁이 궁금합니다.','맵메이커','2026-09-20T09:00:00+09:00',341,35,'["AI맵","프롬프트"]','answered',5),
('share-1','share','단풍나무숲 수학 산책로','중1 수학 개념을 산책로처럼 한 단계씩 지나가며 복습하는 AI 학습 맵입니다.','맵메이커','2026-09-20T10:00:00+09:00',412,51,'["중1수학","단풍","AI맵"]','',0),
('share-2','share','직업상담사 암기 모드','직업상담사 자격증 핵심 내용을 반복 회상할 수 있게 만든 암기 중심 학습 맵입니다.','자격성장중','2026-09-20T07:00:00+09:00',265,27,'["자격증","암기모드","복습"]','',0);

-- Defense in depth for room quotas. Bootstrap group rooms do not use room_creation_events.
CREATE TRIGGER IF NOT EXISTS trg_user_creation_cooldown_event
BEFORE INSERT ON room_creation_events
WHEN NEW.event_type='create'
 AND (SELECT role FROM profiles WHERE id=NEW.profile_id)='user'
 AND EXISTS (
   SELECT 1 FROM room_creation_events e
   WHERE e.profile_id=NEW.profile_id
     AND e.event_type='create'
     AND datetime(e.created_at) > datetime(NEW.created_at, '-72 hours')
 )
BEGIN
  SELECT RAISE(ABORT, 'ROOM_CREATION_COOLDOWN');
END;

CREATE TRIGGER IF NOT EXISTS trg_user_single_correction_event
BEFORE INSERT ON room_creation_events
WHEN NEW.event_type='correction_create'
 AND (SELECT role FROM profiles WHERE id=NEW.profile_id)='user'
 AND EXISTS (
   SELECT 1
   FROM room_creation_events e
   JOIN study_spaces old_space ON old_space.id=e.space_id
   JOIN study_spaces new_space ON new_space.id=NEW.space_id
   WHERE e.profile_id=NEW.profile_id
     AND e.event_type='correction_create'
     AND old_space.creation_cycle_id=new_space.creation_cycle_id
 )
BEGIN
  SELECT RAISE(ABORT, 'CORRECTION_ALREADY_USED');
END;

CREATE TRIGGER IF NOT EXISTS trg_admin_three_rooms_per_24h
BEFORE INSERT ON room_creation_events
WHEN (SELECT role FROM profiles WHERE id=NEW.profile_id)='admin'
 AND (
   SELECT COUNT(*) FROM room_creation_events e
   WHERE e.profile_id=NEW.profile_id
     AND datetime(e.created_at) > datetime(NEW.created_at, '-24 hours')
 ) >= 3
BEGIN
  SELECT RAISE(ABORT, 'ADMIN_ROOM_DAILY_LIMIT');
END;
