import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8');

test('favicon/PWA assets are wired into the deployable HTML', () => {
  assert.match(html, /favicon-32\.png/);
  assert.match(html, /favicon-192\.png/);
  assert.match(html, /manifest\.webmanifest/);
});

test('commercial frontend has no browser-local community DB fallback or stale prototype copy', () => {
  assert.doesNotMatch(app, /COMMUNITY_STORE_KEY|readCommunityPosts|writeCommunityPosts/);
  assert.doesNotMatch(html, /현재 프로토타입|브라우저에 저장되고/);
});

test('public planet card uses public code, never a secret key fragment', () => {
  assert.match(app, /fillText\(profile\.publicCode/);
  assert.doesNotMatch(app, /fillText\(profile\.maskedPlanetKey/);
  assert.match(app, /function maskPlanetKey\(\)\{return 'ST-•••••-•••••-•••••-•••••'\}/);
  assert.match(app, /localStorage\.removeItem\('studyworld\.dynamic\.space\.v1'\)/);
  assert.match(app, /profile:\$\{profileId\}:space:/);
});

test('planet key recovery input is masked by default and admin management UI is present', () => {
  assert.match(html, /id="keyModalInput" type="password"/);
  assert.match(html, /id="keyModalReveal"/);
  assert.match(html, /id="adminManagedUsers"/);
  assert.match(html, /id="adminManagedBackdrop"/);
});

test('room deletion/recovery UI is connected', () => {
  assert.match(html, /roomDeleteBackdrop/);
  assert.match(app, /requestRoomDelete\('accidental'\)/);
  assert.match(app, /requestRoomDelete\('wrong_room'\)/);
  assert.match(app, /requestRoomDelete\('restore'\)/);
});

test('dynamic study engine sends ephemeral source context to server AI but strips it from persisted state', () => {
  assert.match(app, /context:\{file_name:dynamicContext\.name,file_type:dynamicContext\.type,has_text:Boolean\(dynamicContext\.text\),text:contextExcerpt\(\)\}/);
  assert.match(app, /next\.context=\{\.\.\.\(next\.context\|\|\{\}\),text:''\}/);
  assert.match(app, /study\/context\/pdf/);
  assert.match(app, /study\/actions/);
  assert.match(app, /STATIC CHECK · 실제 실행 아님/);
});


test('dynamic AI UI gives explicit provider-forwarding notice and keeps room-modification quota opt-in', () => {
  assert.match(html, /AI 분석을 요청하면 필요한 텍스트 구간 또는 PDF 파일이 설정된 AI 제공자에 일시 전송될 수 있습니다/);
  assert.match(app, /roomModification:Boolean\(roomModification&&!preview&&activeStudySpaceId\)/);
  assert.match(app, /roomModificationArmed=true/);
  assert.match(app, /DEFAULT_DYNAMIC_PLACEHOLDER/);
});


test('pre-AI learning UI never presents heuristic output as generated AI output', () => {
  assert.match(app, /로컬 미리보기 카드/);
  assert.match(app, /아직 AI 요약을 생성하지 않았습니다/);
  assert.match(app, /STATIC CHECK · 실제 실행 아님/);
  assert.doesNotMatch(app, /local check passed/);
});
