import type { PropsWithChildren } from 'react';
import type { SessionState } from '../domain/types';
import { navigate } from '../app/router';
import { Button } from './Button';

interface Props extends PropsWithChildren { session: SessionState }

export function Shell({ session, children }: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')} aria-label="STUDYWORLD 홈">STUDY<span>WORLD</span></button>
        <nav className="nav" aria-label="주요 메뉴">
          <button className="nav-link" onClick={() => navigate('/commons')}>광장</button>
          <button className="nav-link" onClick={() => navigate('/rooms')}>내 학습공간</button>
          <button className="nav-link" onClick={() => navigate('/support')}>문의</button>
          {session.kind === 'member' ? (
            <Button variant="quiet" onClick={() => void fetch('/api/v1/auth/logout', { method: 'POST' }).then(() => location.assign('/'))}>로그아웃</Button>
          ) : <Button variant="secondary" onClick={() => navigate('/login')}>로그인</Button>}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">STUDYWORLD · 내 방식대로 넓히는 배움의 세계</footer>
    </div>
  );
}
