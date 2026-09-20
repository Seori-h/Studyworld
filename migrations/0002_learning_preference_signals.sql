-- Additional aggregate-only learning preference signals.
-- No prompt/source text is stored in these columns.
ALTER TABLE learning_preferences ADD COLUMN hint_use_count INTEGER NOT NULL DEFAULT 0 CHECK (hint_use_count >= 0);
ALTER TABLE learning_preferences ADD COLUMN attempt_before_answer_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_before_answer_count >= 0);
ALTER TABLE learning_preferences ADD COLUMN recommendation_accept_count INTEGER NOT NULL DEFAULT 0 CHECK (recommendation_accept_count >= 0);
ALTER TABLE learning_preferences ADD COLUMN ai_action_count INTEGER NOT NULL DEFAULT 0 CHECK (ai_action_count >= 0);
