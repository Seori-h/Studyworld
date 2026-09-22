-- Authenticated study-room presence sessions and per-user accumulated study time.
CREATE TABLE IF NOT EXISTS study_room_visits (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES study_spaces(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entered_at TEXT NOT NULL,
  exited_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  exit_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_room_visits_profile_space
  ON study_room_visits(profile_id, space_id, entered_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_room_visits_space_profile_closed
  ON study_room_visits(space_id, profile_id, exited_at);

-- A profile can be actively present in only one study room at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_study_room_visits_open_profile
  ON study_room_visits(profile_id)
  WHERE exited_at IS NULL;
