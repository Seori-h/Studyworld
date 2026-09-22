import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/assets/app.js', import.meta.url), 'utf8');
const localActions = await readFile(new URL('../public/assets/study-actions.json', import.meta.url), 'utf8');

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


test('immersive runtime removes the exposed AI command bar and uses local action data', () => {
  assert.doesNotMatch(html, /id="dynamicCommandDock"/);
  assert.doesNotMatch(html, /id="dynamicCommandInput"/);
  assert.doesNotMatch(html, /id="modifyRoom"/);
  assert.match(app, /LOCAL_ACTIONS_URL='\/assets\/study-actions\.json'/);
  assert.match(app, /data-local-action=\"hint\"/);
  assert.match(app, /data-local-action=\"quiz\"/);
  assert.match(localActions, /"hint"/);
  assert.match(localActions, /"quiz"/);
});


test('fixed learning actions stay local and never masquerade as generated AI output', () => {
  assert.match(app, /FIELD QUIZ · LOCAL/);
  assert.match(app, /source:'static_json'/);
  assert.match(app, /ensureAiMaterialForLayout\(\)\{return null\}/);
  assert.match(app, /STATIC CHECK · 실제 실행 아님/);
  assert.doesNotMatch(app, /local check passed/);
});

test('personal language rooms use conversation mode and do not force the Tokyo convenience-store template', () => {
  assert.match(app, /title:'실전 회화 롤플레이'/);
  assert.match(app, /study_type:'conversation',layout_mode:'conversation'/);
  assert.match(app, /conversation_coach/);
  assert.doesNotMatch(app, /language:\{recipe:'REC009',title:'도쿄 편의점 롤플레이'/);
});

test('planet and room exits expose live stay time without a top control panel', () => {
  assert.match(html, /id="profileSessionTime"/);
  assert.match(html, /id="profileLockKey"[^>]*>🪐 행성 퇴장/);
  assert.doesNotMatch(html, /class="runtime-head"/);
  assert.match(app, /id=\"runtimeVisitTime\"/);
  assert.match(app, /id=\"runtimeBack\"/);
  assert.match(app, /returnFromRuntime/);
  assert.match(app, /runtimeBackLabel/);
  assert.match(app, /\/enter/);
  assert.match(app, /\/exit/);
  assert.match(app, /totalStudySeconds/);
});

test('community UI uses real likes, answer acceptance and required certification images', () => {
  assert.match(html, /id="postLikeBtn"/);
  assert.match(app, /setCommunityLike/);
  assert.match(app, /acceptCommunityAnswer/);
  assert.match(app, /공부 인증 이미지를 첨부해 주세요/);
});


test('category discovery uses a recoverable responsive dialog and runtime returns to the exact prior context', () => {
  assert.match(html, /id="planetDialogBackdrop"/);
  assert.match(html, /id="planetDialog"[^>]*role="dialog"/);
  assert.match(app, /openPlanetDialog\(node\.dataset\.category,node\)/);
  assert.match(app, /closePlanetDialog/);
  assert.match(app, /category:view==='commons'\?commonsCategory:null/);
  assert.match(app, /scrollY:Math\.max\(0,window\.scrollY\|\|0\)/);
  assert.match(app, /openSquareCategory\(context\.category\|\|'전체'\)/);
});

test('study room UI does not expose internal learning-pattern or schema controls', () => {
  assert.doesNotMatch(html, /id="dynamicPreferenceToggle"/);
  assert.doesNotMatch(html, /id="dynamicSchemaToggle"/);
  assert.doesNotMatch(html, />학습 패턴</);
  assert.doesNotMatch(html, />JSON</);
  assert.doesNotMatch(html, />Persona</i);
  assert.doesNotMatch(html, />Layout</i);
  assert.doesNotMatch(html, />Activity</i);
  assert.doesNotMatch(html, />Assessment</i);
  assert.doesNotMatch(html, /Agent \/ Assessment/);
  assert.match(app, /dyn-diegetic-npc/);
  assert.doesNotMatch(app, /dynamicSchemaJson/);
});

test('public room identity survives template reuse and never falls back to a different room title', () => {
  assert.match(app, /openRoom\(room,spaceId,exactMeta\)/);
  assert.match(app, /resolveStudySpaceMeta\(spaceId,exactMeta\)/);
  assert.match(app, /title:meta\?\.title\|\|r\.title/);
});

test('planet-key restore always opens and refreshes the authenticated My Planet service page', () => {
  assert.match(html, /id="view-rooms"[^>]*data-route="\/my-planets"/);
  assert.match(app, /if\(destination==='rooms'\)await refreshMyStudySpaces\(\)\.catch/);
  assert.match(app, /enterDemoApp\('rooms'\)/);
  assert.match(app, /id=.?navMyPlanets|navMyPlanets/);
});
