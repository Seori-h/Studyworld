import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { Room } from '../domain/types';
import { api } from '../lib/api';
import { InviteLocked } from '../components/InviteLocked';
import { Button } from '../components/Button';

interface Material {
  id: string;
  original_name: string;
  size_bytes: number;
  created_at: string;
  status: string;
}

interface CurriculumItem {
  id: string;
  position: number;
  title: string;
  status: string;
}

interface Curriculum {
  id: string;
  title: string;
  curriculum_items: CurriculumItem[];
}

export function RoomDetail({
  id,
}: {
  id: string;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [materials, setMaterials] = useState<
    Material[]
  >([]);
  const [curricula, setCurricula] = useState<
    Curriculum[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<{
        room: Room;
        materials: Material[];
        curricula: Curriculum[];
      }>(`/api/v1/rooms/${encodeURIComponent(id)}`);

      setRoom(data.room);
      setMaterials(data.materials);
      setCurricula(data.curricula);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'ROOM을 불러오지 못했습니다.',
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file?: File) => {
    if (
      !file
      || file.type !== 'application/pdf'
      || uploading
    ) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      await api.uploadPdf(id, file);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '파일을 업로드하지 못했습니다.',
      );
    } finally {
      setUploading(false);
    }
  };

  const items = curricula.flatMap((curriculum) =>
    [...curriculum.curriculum_items].sort(
      (left, right) =>
        left.position - right.position,
    ),
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            PERSONAL LEARNING SPACE
          </p>

          <h1 className="page-title">
            {room?.title ?? '학습공간'}
          </h1>

          <p className="page-copy">
            {room?.goal}
          </p>
        </div>

        <span className="public-pill">
          {room?.duration_minutes
            ? `${room.duration_minutes} MIN`
            : 'MY ROOM'}
        </span>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="room-dashboard">
        <div className="room-main-stack">
          <article className="card panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TODAY</p>
                <h2>기본 학습 틀</h2>
              </div>

              <Button
                variant="secondary"
                disabled
              >
                학습공간 조정
              </Button>
            </div>

            <ol className="curriculum-list">
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    {String(
                      item.position,
                    ).padStart(2, '0')}
                  </span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.status === 'done'
                      ? '완료'
                      : '예정'}
                  </small>
                </li>
              ))}
            </ol>

            {!items.length && (
              <p className="empty-copy">
                기본 학습 틀을 불러오는 중입니다.
              </p>
            )}

            <p className="fine-print">
              프리셋 변경과 “이렇게 바꿔줘” 자연어
              조정은 다음 구현 단계에서 이 진입점에
              연결합니다.
            </p>
          </article>

          <article className="card panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  MATERIALS
                </p>
                <h2>자료 추가</h2>
              </div>
            </div>

            <p className="panel-copy">
              자료는 선택 사항입니다. 추가된 자료는
              분석 파이프라인이 연결되면 핵심 주제와
              학습 계획에 반영합니다.
            </p>

            <div className="material-actions">
              <label className="upload-box">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) =>
                    void upload(
                      event.target.files?.[0],
                    )
                  }
                  disabled={uploading}
                />

                <strong>
                  {uploading
                    ? '업로드 중…'
                    : 'PDF 추가하기'}
                </strong>

                <span>
                  회원 전용 · 최대 10MB
                </span>
              </label>

              <button
                className="material-placeholder"
                disabled
              >
                <strong>URL 연결</strong>
                <span>
                  SSRF 방어 완료 후 활성화
                </span>
              </button>

              <button
                className="material-placeholder"
                disabled
              >
                <strong>공공 아카이브</strong>
                <span>
                  허용 자료 연결 준비 중
                </span>
              </button>
            </div>

            <ul className="material-list">
              {materials.map((item) => (
                <li key={item.id}>
                  <span>{item.original_name}</span>
                  <small>
                    {Math.ceil(
                      item.size_bytes / 1024,
                    )}{' '}
                    KB · {item.status}
                  </small>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="side-stack">
          <article className="card panel room-settings">
            <p className="eyebrow">
              ROOM SETTING
            </p>

            <h2>내 학습 방식</h2>

            <dl>
              <div>
                <dt>방식</dt>
                <dd>
                  {room?.study_style || '기본형'}
                </dd>
              </div>

              <div>
                <dt>D-Day</dt>
                <dd>
                  {room?.d_day || '설정 안 함'}
                </dd>
              </div>

              <div>
                <dt>자료</dt>
                <dd>{materials.length}개</dd>
              </div>
            </dl>
          </article>

          <InviteLocked />
        </aside>
      </div>
    </section>
  );
}