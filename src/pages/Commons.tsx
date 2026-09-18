import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnswerResult, BasicTestRun, LeaderboardEntry, SessionState } from '../domain/types';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';

export function Commons({ session }: { session: SessionState }) {
  const [run, setRun] = useState<BasicTestRun | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [nicknameNeeded, setNicknameNeeded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useMemo(() => run?.questions[index], [run, index]);

  const loadLeaderboard = useCallback(async () => {
    try { setLeaderboard(await api.get<LeaderboardEntry[]>('/api/v1/commons/basic-test/leaderboard')); } catch { setLeaderboard([]); }
  }, []);
  useEffect(() => { void loadLeaderboard(); }, [loadLeaderboard]);

  const start = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const next = await api.post<BasicTestRun>('/api/v1/commons/basic-test/start');
      setRun(next); setIndex(0); setResult(null); setShowComplete(false); setNicknameNeeded(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'GUEST_NICKNAME_REQUIRED') setNicknameNeeded(true);
      else setError(cause instanceof Error ? cause.message : 'Basic Test를 시작하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const saveNickname = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      await api.post('/api/v1/commons/guest-nickname', { nickname });
      setNicknameNeeded(false); await start();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '닉네임을 저장하지 못했습니다.'); setBusy(false); }
  };

  const answer = async (choice: number) => {
    if (!run || !current || result || busy) return; setBusy(true); setError('');
    try {
      const next = await api.post<AnswerResult>('/api/v1/commons/basic-test/answers', { run_id: run.run_id, question_id: current.id, choice });
      setResult(next); await loadLeaderboard();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '답안을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const next = () => { if (result?.completed) { setShowComplete(true); return; } setResult(null); setIndex((value) => Math.min(value + 1, 9)); };
  const finished = showComplete;

  if (run && current) return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">광장 · BASIC TEST</p><h1 className="page-title">기본 상식 테스트</h1></div><span className="public-pill">{index + 1} / 10</span></div>
    <div className="quiz-layout">
      <article className="card question-card">
        {finished ? <div className="complete-state"><p className="eyebrow">BASIC TEST COMPLETE</p><h2>이번 10문제를 모두 풀었어요.</h2><strong>{result?.total_score ?? 0}점</strong><p>재시험은 방금 풀었던 문항을 우선 제외해 새 10문제를 구성합니다.</p><Button onClick={() => void start()}>새 문제로 재시험</Button></div> : <>
          <div className="question-meta"><span>{current.category} · {String(index + 1).padStart(2,'0')} / 10</span><span>{current.points} PTS</span></div>
          <div className="progress"><span style={{ width: `${(index + 1) * 10}%` }} /></div>
          <h2>{current.prompt}</h2>
          <div className="choices">{current.choices.map((choice, choiceIndex) => <button className={result ? (choiceIndex === result.correct_choice ? 'is-correct' : choiceIndex !== result.correct_choice && !result.correct ? 'is-muted' : '') : ''} disabled={Boolean(result) || busy} key={choice} onClick={() => void answer(choiceIndex)}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice}</button>)}</div>
          {result && <div className={`answer-result ${result.correct ? 'is-correct' : ''}`} role="status"><strong>{result.correct ? '정답입니다.' : `정답은 ${current.choices[result.correct_choice]}입니다.`}</strong><span>+{result.awarded_points} · 누적 {result.total_score}점</span><p>{result.explanation}</p><Button variant="secondary" onClick={next}>{result.completed ? '결과 보기' : '다음 문제'}</Button></div>}
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </article>
      <Leaderboard entries={leaderboard} />
    </div>
  </section>;

  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">PUBLIC LEARNING PLAZA</p><h1 className="page-title">광장</h1><p className="page-copy">Basic Test로 가볍게 시작하고, 공개적·공익적 목적으로 운영되는 학습공간에 참여합니다.</p></div><span className="public-pill">OPEN · PUBLIC INTEREST</span></div>
    <section className="basic-test-card"><div><p className="eyebrow">BASIC TEST · PLAZA FIRST</p><h2>광장에 들어오면<br />가장 먼저, 기본 테스트</h2><p>과학·역사·지리·문화의 기본 상식을 매회 10문제로 확인합니다. 재시험에는 직전 문항을 우선 제외합니다.</p>
      {nicknameNeeded && session.kind !== 'member' ? <form className="nickname-form" onSubmit={(e) => { e.preventDefault(); void saveNickname(); }}><label htmlFor="guest-nickname">광장에서 사용할 닉네임</label><div><input id="guest-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="2~12자" /><Button disabled={busy || nickname.trim().length < 2}>등록하고 시작</Button></div></form> : <Button onClick={() => void start()} disabled={busy}>{busy ? '준비 중…' : 'Basic Test 시작하기'}</Button>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="basic-test-meta"><div><small>QUESTIONS</small><strong>10</strong><span>매회 출제</span></div><div><small>PUBLIC SCORE</small><strong>OPEN</strong><span>회원 · 비회원 공개</span></div></div></section>
    <div className="policy-box"><strong>광장 원칙</strong><p>공개적·공익적 학습 목적의 공간만 허용합니다. 자발적 퇴장 후 1시간 재입장 제한과 네트워크 단절 3분 재접속 유예는 공개 스터디 입장 기능과 함께 서버 상태로 적용합니다.</p></div>
    <section className="commons-section"><div className="section-heading"><div><h2>실황 스터디 아카이브</h2><p>현재 운영 중인 공개 스터디가 생기면 입장 전 설명·규칙과 학습 분위기를 여기서 확인합니다.</p></div><span className="public-pill">MAX 30</span></div><div className="archive-empty"><div className="archive-scene" aria-hidden="true"><i/><i/><i/></div><strong>현재 공개된 스터디가 없습니다.</strong><span>샘플 방을 실제 방처럼 표시하지 않습니다.</span></div></section>
    <section className="locked-create"><div><p className="eyebrow">광장 스터디 개설</p><h2>개설 기능 준비 중</h2><p>개인 학습 출석 3일 이상 · 1인 동시 1개 · 최대 30명 · 24시간 내 최소 3명/활동 조건을 서버 제약으로 구현한 뒤 엽니다.</p></div><Button variant="secondary" disabled>🔒 준비 중</Button></section>
    <div className="leaderboard-bottom"><Leaderboard entries={leaderboard} /></div>
  </section>;
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return <aside className="card score-card"><p className="eyebrow">PUBLIC LEADERBOARD</p><h2>공개 스코어</h2><ol className="ranking">{entries.map((entry) => <li key={`${entry.actor_type}-${entry.rank}-${entry.display_name}`}><span className="rank">{String(entry.rank).padStart(2,'0')}</span><span className="player">{entry.display_name}<small>{entry.actor_type === 'guest' ? '비회원 · 3일 보관' : '회원'}</small></span><strong>{entry.score}</strong></li>)}</ol>{!entries.length && <p className="empty-copy">아직 공개 점수가 없습니다.</p>}<p className="fine-print">비회원 닉네임·점수·풀이 기록은 마지막 활동 3일 후 삭제됩니다.</p></aside>;
}
