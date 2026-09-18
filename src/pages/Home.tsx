import type { SessionState } from '../domain/types';
import { navigate } from '../app/router';
import { Button } from '../components/Button';

function LearningVillage() {
  return (
    <div
      className="world-wrap"
      aria-label="숲 속에서 주민들이 각자의 학습공간을 만들어가는 모습"
    >
      <div className="world-glow" aria-hidden="true" />
      <div className="world-scene">
        <i className="world-sun" />
        <i className="hill hill--one" />
        <i className="hill hill--two" />

        <i className="tree tree--1" />
        <i className="tree tree--2" />
        <i className="tree tree--3" />
        <i className="tree tree--4" />

        <div className="cabin">
          <i className="cabin-roof" />
          <i className="cabin-base" />
          <i className="cabin-door" />
          <i className="cabin-window" />
        </div>

        <i className="builder builder--1" />
        <i className="builder builder--2" />
        <i className="builder builder--3" />

        <div className="scene-note">
          각자의 배움이 모여 하나의 세계가 됩니다.
        </div>
      </div>
    </div>
  );
}

export function Home({ session }: { session: SessionState }) {
  return (
    <section className="page home-page">
      <div className="home-hero-grid">
        <div className="hero">
          <p className="hero-kicker">STUDYWORLD</p>
          <h1>내 방식대로 넓히는 배움의 세계</h1>
          <p className="hero-copy">
            타인의 기준이 아닌, 내 스타일에 딱 맞춘 학습공간을 만나보세요
          </p>

          <div className="hero-actions">
            <Button
              onClick={() =>
                navigate(session.kind === 'member' ? '/rooms' : '/login')
              }
            >
              내 학습공간 만들기
            </Button>

            <Button
              variant="secondary"
              onClick={() => navigate('/commons')}
            >
              광장 둘러보기
            </Button>
          </div>
        </div>

        <LearningVillage />
      </div>

      <div className="feature-grid" aria-label="STUDYWORLD 주요 기능">
        <article>
          <h2>광장</h2>
          <p>
            Basic Test로 시작하고 공개적·공익적 학습 스터디를
            둘러봅니다.
          </p>
        </article>

        <article>
          <h2>나의 학습공간</h2>
          <p>
            목표부터 시작하고 자료를 더할수록 학습 계획을 정교하게
            확장합니다.
          </p>
        </article>

        <article>
          <h2>계속 조정하기</h2>
          <p>
            공부하면서 자료와 방식, 학습공간 구성을 계속 다듬을 수
            있습니다.
          </p>
        </article>
      </div>
    </section>
  );
}