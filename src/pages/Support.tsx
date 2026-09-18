import { useState } from 'react';

import { api } from '../lib/api';
import { Button } from '../components/Button';

export function Support() {
  const [category, setCategory] =
    useState('account');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;

    setBusy(true);
    setStatus('');

    try {
      const result = await api.post<{
        ticket_id: string;
        status: string;
      }>('/api/v1/support', {
        category,
        title,
        body,
      });

      setStatus(
        `문의가 접수되었습니다. 접수번호 ${result.ticket_id}`,
      );

      setTitle('');
      setBody('');
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : '문의를 저장하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page support-page">
      <div className="support-heading">
        <h1 className="page-title">
          문의하기
        </h1>

        <p className="page-copy">
          이용 문의, 오류 제보, 광장 운영 신고,
          기능 제안을 남겨주세요.
        </p>
      </div>

      <div className="support-grid">
        <section className="card support-info">
          <h2>어떤 도움이 필요한가요?</h2>

          <div className="support-list">
            <div>
              <b>이용 · 로그인</b>
              <span>
                로그인, 계정, 학습공간 이용
              </span>
            </div>

            <div>
              <b>자료 · 분석</b>
              <span>
                업로드, URL 연결, 분석 결과
              </span>
            </div>

            <div>
              <b>광장 운영 · 신고</b>
              <span>
                공개 스터디 운영과 참여자 문제
              </span>
            </div>

            <div>
              <b>기능 제안</b>
              <span>
                학습 방식과 UI 개선 아이디어
              </span>
            </div>
          </div>
        </section>

        <form
          className="card support-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="field">
            <label htmlFor="support-category">
              문의 유형
            </label>

            <select
              id="support-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              <option value="account">
                이용 · 로그인
              </option>
              <option value="materials">
                자료 · 분석
              </option>
              <option value="commons">
                광장 운영 · 신고
              </option>
              <option value="feature">
                기능 제안
              </option>
              <option value="other">
                기타
              </option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="support-title">
              제목
            </label>

            <input
              id="support-title"
              maxLength={80}
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </div>

          <div className="field">
            <label htmlFor="support-body">
              내용
            </label>

            <textarea
              id="support-body"
              maxLength={1500}
              value={body}
              onChange={(event) =>
                setBody(event.target.value)
              }
            />
          </div>

          <Button
            disabled={
              busy
              || title.trim().length < 2
              || body.trim().length < 10
            }
          >
            {busy
              ? '접수 중…'
              : '문의 남기기'}
          </Button>

          {status && (
            <p
              className="support-status"
              role="status"
            >
              {status}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}