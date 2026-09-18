import { useEffect, useState } from 'react';

import type {
  Room,
  SessionState,
} from '../domain/types';

import { api } from '../lib/api';
import { navigate } from '../app/router';
import { Button } from '../components/Button';

const templates = [
  ['toeic', '토익 800점 달성'],
  ['engineer', '정보처리기사 실기'],
  ['law', '공무원 행정법 1일 1회독'],
  ['coding', '코딩테스트 매일 1문제'],
] as const;

const styles = [
  '시험 대비',
  '개념 이해',
  '실무 활용',
  '빠른 복습',
  '쉽게 설명',
  '핵심 요약',
  '문제 풀이',
  '반복 복습',
  '질문하며 학습',
];

export function Rooms({
  session,
}: {
  session: SessionState;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [goal, setGoal] = useState('');
  const [dDay, setDDay] = useState('');
  const [template, setTemplate] = useState('');
  const [studyStyle, setStudyStyle] = useState('');
  const [duration, setDuration] = useState<
    number | null
  >(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session.kind !== 'member') {
      navigate('/login');
      return;
    }

    void api
      .get<Room[]>('/api/v1/rooms')
      .then(setRooms)
      .catch(() =>
        setError(
          '학습공간을 불러오지 못했습니다.',
        ),
      );
  }, [session.kind]);

  const create = async () => {
    const value = goal.trim();

    if (!value || busy) return;

    setBusy(true);
    setError('');

    try {
      const room = await api.post<Room>(
        '/api/v1/rooms',
        {
          goal: value,
          d_day: dDay || null,
          template_key: template || null,
          study_style: studyStyle || null,
          duration_minutes: duration,
        },
      );

      setRooms((items) => [room, ...items]);
      setGoal('');
      setDDay('');
      setTemplate('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '학습공간을 만들지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseTemplate = (
    key: string,
    label: string,
  ) => {
    setTemplate(key);
    setGoal(label);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            MY LEARNING SPACES
          </p>

          <h1 className="page-title">
            내 학습공간
          </h1>

          <p className="page-copy">
            자료 없이 목표만으로 바로 시작하고, 필요한
            자료는 만든 뒤 추가할 수 있습니다.
          </p>
        </div>

        <span className="public-pill">
          ACTIVE{' '}
          {
            rooms.filter(
              (room) => room.state === 'active',
            ).length
          }{' '}
          / 5
        </span>
      </div>

      <form
        className="room-builder card"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="field field--wide">
          <label htmlFor="goal">
            무엇을 공부할까요?
          </label>

          <input
            id="goal"
            maxLength={120}
            value={goal}
            onChange={(event) =>
              setGoal(event.target.value)
            }
            placeholder="목표, 자격증명, 오늘 공부할 주제를 적어주세요"
          />
        </div>

        <div className="template-strip">
          {templates.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={
                template === key
                  ? 'is-selected'
                  : ''
              }
              onClick={() =>
                chooseTemplate(key, label)
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="d-day">
              D-Day <small>선택</small>
            </label>

            <input
              id="d-day"
              type="date"
              value={dDay}
              onChange={(event) =>
                setDDay(event.target.value)
              }
            />
          </div>

          <div className="field">
            <label>
              학습 시간 <small>선택</small>
            </label>

            <div className="segmented">
              {[20, 40, 60].map((value) => (
                <button
                  type="button"
                  className={
                    duration === value
                      ? 'is-selected'
                      : ''
                  }
                  key={value}
                  onClick={() =>
                    setDuration(value)
                  }
                >
                  {value}분
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-label">
            공부 방식{' '}
            <small>선택 또는 직접 입력</small>
          </span>

          <div className="choice-chips">
            {styles.map((value) => (
              <button
                type="button"
                key={value}
                className={
                  studyStyle === value
                    ? 'is-selected'
                    : ''
                }
                onClick={() =>
                  setStudyStyle(value)
                }
              >
                {value}
              </button>
            ))}
          </div>

          <input
            value={studyStyle}
            onChange={(event) =>
              setStudyStyle(event.target.value)
            }
            maxLength={80}
            placeholder="예: 틀린 문제는 다음 날 다시 보여줘"
          />
        </div>

        <div className="builder-note">
          <strong>
            자료는 나중에 추가해도 됩니다.
          </strong>
          <span>
            PDF · URL · 공공 아카이브는 선택 사항이며,
            기본 ROOM 생성은 외부 AI 없이 동작합니다.
          </span>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <Button disabled={!goal.trim() || busy}>
          {busy
            ? '만드는 중…'
            : '학습공간 만들기'}
        </Button>
      </form>

      <div className="room-list">
        {rooms.map((room) => (
          <button
            key={room.id}
            className="room-row"
            onClick={() =>
              navigate(`/rooms/${room.id}`)
            }
          >
            <span>
              <small>
                {room.state === 'archived'
                  ? '보관됨'
                  : '개인 학습공간'}
              </small>

              <strong>{room.title}</strong>

              <em>
                {room.study_style
                  || '기본 학습 틀'}

                {room.d_day
                  ? ` · D-${Math.max(
                      0,
                      Math.ceil(
                        (new Date(
                          room.d_day,
                        ).getTime()
                          - Date.now())
                          / 86400000,
                      ),
                    )}`
                  : ''}
              </em>
            </span>

            <b>열기 →</b>
          </button>
        ))}

        {!rooms.length && (
          <div className="empty-state">
            아직 학습공간이 없습니다. 목표 하나로
            첫 공간을 만들어보세요.
          </div>
        )}
      </div>
    </section>
  );
}