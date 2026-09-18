import type { Env } from './types';
import { assertSameOrigin, failure, json, requestId } from './lib/http';
import { logoutRoute, oauthCallback, oauthStart, sessionRoute } from './routes/auth';
import { basicAnswerRoute, basicLeaderboardRoute, basicTestStartRoute, guestNicknameRoute } from './routes/commons';
import { roomDetailRoute, roomsRoute } from './routes/rooms';
import { uploadFileRoute } from './routes/files';
import { supportRoute } from './routes/support';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = requestId(request);
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
      const configured = Boolean(env.UPSTREAM_ORIGIN && env.UPSTREAM_PUBLIC_KEY && env.UPSTREAM_SECRET_KEY && env.SESSION_KEY);
      if (!configured && url.pathname !== '/api/v1/health') return failure(503, 'CONFIG_NOT_READY', '서비스 연결 설정이 완료되지 않았습니다.');

      const csrf = assertSameOrigin(request);
      if (csrf) return csrf;

      if (request.method === 'GET' && url.pathname === '/api/v1/health') return json({ ok: true });
      if (request.method === 'GET' && url.pathname === '/api/v1/session') return sessionRoute(request, env);
      if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') return logoutRoute(request, env);
      if (request.method === 'GET' && url.pathname === '/api/v1/auth/callback') return oauthCallback(request, env);
      if (request.method === 'GET' && url.pathname.startsWith('/api/v1/auth/oauth/')) return oauthStart(request, env, url.pathname.split('/').at(-1) ?? '');

      if (request.method === 'POST' && url.pathname === '/api/v1/commons/guest-nickname') return guestNicknameRoute(request, env);
      if (request.method === 'POST' && url.pathname === '/api/v1/commons/basic-test/start') return basicTestStartRoute(request, env);
      if (request.method === 'POST' && url.pathname === '/api/v1/commons/basic-test/answers') return basicAnswerRoute(request, env);
      if (request.method === 'GET' && url.pathname === '/api/v1/commons/basic-test/leaderboard') return basicLeaderboardRoute(env);
      if (request.method === 'POST' && url.pathname === '/api/v1/support') return supportRoute(request, env);

      if ((request.method === 'GET' || request.method === 'POST') && url.pathname === '/api/v1/rooms') return roomsRoute(request, env);
      if (request.method === 'GET' && /^\/api\/v1\/rooms\/[0-9a-f-]{36}$/iu.test(url.pathname)) return roomDetailRoute(request, env, url.pathname.slice('/api/v1/rooms/'.length));
      if (request.method === 'POST' && url.pathname === '/api/v1/files') return uploadFileRoute(request, env);

      return failure(404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.');
    } catch (error) {
      console.error(JSON.stringify({ request_id: id, code: 'UNHANDLED', message: error instanceof Error ? error.message : 'unknown' }));
      return failure(500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
    }
  },
};
