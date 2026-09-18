export type ActorKind = 'guest' | 'member';

export interface SessionState {
  kind: 'guest' | 'member' | 'none';
  user?: { id: string; displayName: string };
}

export interface Room {
  id: string;
  title: string;
  goal: string | null;
  d_day: string | null;
  template_key: string | null;
  study_style: string | null;
  duration_minutes: number | null;
  state: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface BasicQuestion {
  id: string;
  category: string;
  prompt: string;
  choices: string[];
  points: number;
}

export interface BasicTestRun { run_id: string; questions: BasicQuestion[] }

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  score: number;
  actor_type: ActorKind;
}

export interface AnswerResult {
  correct: boolean;
  awarded_points: number;
  total_score: number;
  explanation: string;
  correct_choice: number;
  completed: boolean;
}
