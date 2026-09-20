const escapeHtml=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

const rooms={
 paper:{recipe:'REC006',title:'Attention 논문 깊게 읽기',category:'AI · 개발',icon:'📖',desc:'원문을 먼저 보고, 선택한 부분만 설명받는 리딩 행성',activity:'read / research',agent:'설명형 튜터',assessment:'none',policy:'user_led',layout:'split',progress:46,last:'6쪽에서 이어보기',modules:['자료 뷰어','근거 하이라이터','검색/RAG','노트']},
 coding:{recipe:'REC004',title:'코딩 도장 · 배열과 해시',category:'AI · 개발',icon:'⌨️',desc:'문제 + 코드 에디터 + 정적 체크 + AI 리뷰 코치',activity:'code',agent:'소크라테스 튜터',assessment:'code_test',policy:'require_attempt',layout:'custom',progress:62,last:'테스트 2/4 통과',modules:['문제','코드 에디터','정적 체크','AI 디버깅 코치']},
 language:{recipe:'REC009',title:'도쿄 편의점 롤플레이',category:'언어',icon:'🗣️',desc:'상황극을 끊지 않고 진행한 뒤 마지막에 교정',activity:'speak',agent:'역할 캐릭터',assessment:'simulation',policy:'delayed_feedback',layout:'immersive',progress:34,last:'결제 표현부터',modules:['상황극','음성','자막','세션 리포트']},
 teach:{recipe:'REC001',title:'내가 설명하는 생물학',category:'과학 · 수학',icon:'🌱',desc:'AI 학생에게 설명하며 빠진 개념과 오개념을 찾기',activity:'explain',agent:'호기심 학생',assessment:'teach_back',policy:'hint_first',layout:'split',progress:51,last:'세포 호흡 개념',modules:['Teach-back 학생','설명 평가기','힌트 사다리','약점 기록']},
 exam:{recipe:'REC002',title:'한국사 엄격 시험실',category:'시험 · 자격',icon:'✓',desc:'시험 범위에서만 출제하고 결과 중심으로 복습',activity:'recall / solve',agent:'엄격한 시험관',assessment:'mixed',policy:'never_show_until_end',layout:'focus',progress:73,last:'오답 7개 남음',modules:['객관식','단답형','오답노트','적응형 문제']},
 memory:{recipe:'REC005',title:'TOEFL 단어 복습실',category:'언어',icon:'◫',desc:'틀린 카드가 다시 돌아오는 약점 우선 암기 행성',activity:'recall',agent:'집중 코치',assessment:'flashcard',policy:'after_attempt',layout:'focus',progress:68,last:'오늘 24장 남음',modules:['플래시카드','오답 재시험','약점 큐','진행도']},
 essay:{recipe:'REC007',title:'에세이 워크숍',category:'인문 · 사회',icon:'✎',desc:'대필하지 않고 문제점만 짚어 수정 → 재평가',activity:'write',agent:'비평가',assessment:'short_answer',policy:'require_attempt',layout:'split',progress:29,last:'2차 수정본',modules:['노트','쓰기 비평가','세션 리포트']}
};
const categoryMap={
 '전체':['paper','coding','language','teach','exam','memory','essay'],
 'AI · 개발':['coding','paper','teach','essay'],
 '언어':['language','memory','teach','paper'],
 '디자인':['essay','teach','coding','paper'],
 '인문 · 사회':['essay','teach','paper','exam'],
 '과학 · 수학':['teach','exam','paper','coding'],
 '시험 · 자격':['exam','memory','teach','paper'],
 '비즈니스':['essay','coding','paper','teach'],
 '취미 · 생활':['language','teach','essay','memory']
};
const subMap={
 '언어':['회화','발음','독해','단어'],
 'AI · 개발':['프론트엔드','AI','데이터','코딩테스트'],
 '디자인':['UI/UX','그래픽','브랜딩','영상'],
 '인문 · 사회':['철학','심리','경제','역사'],
 '과학 · 수학':['수학','물리','생명','통계'],
 '시험 · 자격':['자격증','수능','면접','공무원'],
 '비즈니스':['기획','마케팅','창업','재무'],
 '취미 · 생활':['사진','여행','요리','글쓰기']
};
let state={view:'home',category:'디자인',builderRoom:'coding',currentRoom:'paper'};

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

/* Production connection settings — Cloudflare Worker API is served from the same origin. */
const STUDYWORLD_SETTINGS={
  apiBaseUrl:'',
  requestTimeoutMs:12000,
  aiRequestTimeoutMs:45000,
  nickname:{minLength:2,maxLength:16,debounceMs:320},
  fairy:{showDelayMs:900,voiceEnabled:false},
  search:{rotateMs:5500,fadeMs:500,resumeDelayMs:1000},
  storage:{pendingStudyKey:'studyworld.pending.study.v1'},
  security:{keyFormat:'ST-XXXXX-XXXXX-XXXXX-XXXXX',keyStorage:'server-hmac-digest-only',sessionCookie:'HttpOnly; Secure; SameSite=Strict',optionalPin:false},
  endpoints:{
    nicknameAvailability:'/api/v1/profiles/nickname-availability',
    planetKeyIssue:'/api/v1/planet-keys/issue',
    planetKeyRestore:'/api/v1/planet-keys/restore',
    session:'/api/v1/session',
    logout:'/api/v1/session/logout',
    planetKeyRotate:'/api/v1/planet-keys/rotate',
    adminManagedProfiles:'/api/v1/admin/managed-profiles',
    adminStudySpaces:'/api/v1/admin/study-spaces',
    studyDrafts:'/api/v1/study-drafts',
    studySpaces:'/api/v1/study-spaces',
    communityPosts:'/api/v1/community/posts',
    communityPost:'/api/v1/community/posts/{id}',
    communityComments:'/api/v1/community/posts/{id}/comments',
    uploads:'/api/v1/uploads',
    studyIntent:'/api/v1/study/intent',
    studyActions:'/api/v1/study/actions',
    studyPdfContext:'/api/v1/study/context/pdf',
    learningPreferences:'/api/v1/learning/preferences',
    learningEvents:'/api/v1/learning/events'
  }
};
window.STUDYWORLD_SETTINGS=STUDYWORLD_SETTINGS;
class ApiError extends Error{
  constructor(status,payload){super(payload?.error?.message||`HTTP_${status}`);this.name='ApiError';this.status=status;this.code=payload?.error?.code||`HTTP_${status}`;this.details=payload?.error?.details||null}
}
async function apiFetch(path,options={}){
  const controller=new AbortController();const timeoutMs=Number(options.timeoutMs||STUDYWORLD_SETTINGS.requestTimeoutMs);const cleanOptions={...options};delete cleanOptions.timeoutMs;const t=setTimeout(()=>controller.abort(),timeoutMs);
  const url=(STUDYWORLD_SETTINGS.apiBaseUrl||'')+path;
  const headers={Accept:'application/json',...(options.headers||{})};
  if(options.body && !(options.body instanceof FormData) && !headers['Content-Type'])headers['Content-Type']='application/json';
  try{
    const res=await fetch(url,{...cleanOptions,credentials:'same-origin',headers,signal:controller.signal});
    let payload=null;const type=res.headers.get('content-type')||'';
    if(type.includes('application/json')){try{payload=await res.json()}catch(_e){payload=null}}
    if(!res.ok){if(res.status===401){localStorage.removeItem('studyworld.demo.profile.v1');localStorage.removeItem('studyworld.demo.session.v1')}throw new ApiError(res.status,payload)}
    return payload;
  }finally{clearTimeout(t)}
}

function buildPendingStudyPayload(){
 const tag=activeSearchTag===null?null:SEARCH_TAGS[activeSearchTab][activeSearchTag];
 return {version:1,prompt:heroInput.value.trim()||(tag?.prompt||''),categoryMode:activeSearchTab,tagLabel:tag?.label||null,tagPrompt:tag?.prompt||null,source:'home-search',createdAt:new Date().toISOString()};
}
function savePendingStudy(payload){localStorage.setItem(STUDYWORLD_SETTINGS.storage.pendingStudyKey,JSON.stringify(payload));return payload}
function readPendingStudy(){try{return JSON.parse(localStorage.getItem(STUDYWORLD_SETTINGS.storage.pendingStudyKey)||'null')}catch(e){return null}}
function clearPendingStudy(){localStorage.removeItem(STUDYWORLD_SETTINGS.storage.pendingStudyKey)}
async function persistStudyDraft(payload){
 return apiFetch(STUDYWORLD_SETTINGS.endpoints.studyDrafts,{method:'POST',body:JSON.stringify(payload)});
}
async function createStudySpaceFromDraft(payload){
 return apiFetch(STUDYWORLD_SETTINGS.endpoints.studySpaces,{method:'POST',body:JSON.stringify({...payload,templateKey:state.builderRoom,visibility:'private'})});
}
let activeStudySpaceId=null;
function roomCreationErrorMessage(error){
 if(error?.code==='ROOM_CREATION_COOLDOWN'){
   const at=error?.details?.nextAllowedAt;return at?`개인룸은 3일에 한 번 만들 수 있어요. 다음 생성: ${new Date(at).toLocaleString('ko-KR')}`:'개인룸은 3일에 한 번 만들 수 있어요.';
 }
 if(error?.code==='ACTIVE_PERSONAL_ROOM_EXISTS')return '이미 운영 중인 개인룸이 있어요. 개인룸은 한 번에 1개만 운영할 수 있습니다.';
 if(error?.code==='ADMIN_ROOM_DAILY_LIMIT')return '관리자 데모 계정은 24시간에 최대 3개 룸을 만들 수 있어요.';
 return error?.message||'학습 공간을 만들지 못했습니다.';
}
let pendingRoomDeleteId=null;
function closeRoomDeleteModal(){const backdrop=$('#roomDeleteBackdrop');if(backdrop)backdrop.hidden=true;pendingRoomDeleteId=null;}
function openRoomDeleteModal(spaceId,mode='confirm'){
 pendingRoomDeleteId=spaceId;const backdrop=$('#roomDeleteBackdrop'),initial=$('#roomDeleteActions'),recovery=$('#roomRecoveryActions'),title=$('#roomDeleteTitle'),copy=$('#roomDeleteCopy');if(!backdrop)return;
 const resolving=mode==='recovery';if(initial)initial.hidden=resolving;if(recovery)recovery.hidden=!resolving;
 if(title)title.textContent=resolving?'삭제한 방을 어떻게 처리할까요?':'이 방을 정리할까요?';
 if(copy)copy.textContent=resolving?'15분 안에는 기존 방을 복구할 수 있어요. 잘못 만든 방이라면 조건을 충족할 때 이번 생성 주기에 한해 1회 새로 만들 수 있습니다.':'삭제 후 바로 새 방을 만들 수는 없습니다. 우선 삭제 대기 상태로 옮기며 15분 동안 복구 또는 1회 정정을 선택할 수 있어요.';
 backdrop.hidden=false;
}
async function requestRoomDelete(reason){
 if(!pendingRoomDeleteId)return;const id=pendingRoomDeleteId;
 try{
   if(reason==='restore')await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.studySpaces}/${encodeURIComponent(id)}/restore`,{method:'POST'});
   else await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.studySpaces}/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({reason})});
   if(reason==='accidental'){await refreshMyStudySpaces();openRoomDeleteModal(id,'recovery');showToast('방을 삭제 대기 상태로 옮겼어요. 15분 동안 복구할 수 있습니다.');return}
   closeRoomDeleteModal();if(activeStudySpaceId===id)activeStudySpaceId=null;await refreshMyStudySpaces();
   if(reason==='restore')showToast('기존 방을 그대로 복구했어요.');
   else if(reason==='wrong_room'){switchView('home');showToast('1회 정정 기회가 열렸어요. 원래 72시간 기준은 그대로 유지됩니다.');}
   else showToast('방을 삭제했어요. 새 방 생성 가능 시점은 기존 정책대로 유지됩니다.');
 }catch(error){showToast(error?.message||'방 상태를 변경하지 못했어요.');}
}
async function refreshMyStudySpaces(){
 const root=$('#myRooms');if(!root||!readDemoProfile())return;
 try{
   const data=await apiFetch(STUDYWORLD_SETTINGS.endpoints.studySpaces);
   const owned=data.owned||[],joined=data.joined||[];
   const cards=[...owned.map(x=>{const ownership=x.spaceKind==='group'?'내 공개 스터디':x.spaceKind==='class'?'내 클래스':'내 개인룸';return roomCard(x.templateKey||'teach',false,{spaceId:x.id,title:x.title,ownership,owned:true,spaceKind:x.spaceKind||'personal',status:x.status,recoveryExpiresAt:x.recoveryExpiresAt})}),...joined.map(x=>roomCard(x.templateKey||'teach',false,{spaceId:x.id,title:x.title,ownership:'참여 중',spaceKind:x.spaceKind||'group',status:'active'}))];
   root.innerHTML=cards.length?cards.join(''):`<article class="room-card room-empty"><div class="room-body"><div class="room-meta"><span class="tag">MY PLANET</span></div><h3>아직 만든 개인룸이 없어요</h3><p>개인룸은 3일에 1개 만들 수 있고, 다른 스터디에는 최대 5개까지 참여할 수 있어요.</p></div></article>`;
   bindRoomClicks(root);
   const summary=$('#roomPolicySummary');if(summary){const activeOwned=owned.filter(x=>x.status==='active'&&(x.spaceKind||'personal')==='personal').length;const next=data?.limits?.nextAllowedAt?new Date(data.limits.nextAllowedAt).toLocaleString('ko-KR'):'첫 생성 가능';summary.innerHTML=`<span>내 개인룸 ${activeOwned}/1</span><span>참여 중 ${joined.length}/${data?.limits?.joinedMax||5}</span><span>다음 정상 생성 ${escapeHtml(next)}</span>${data?.limits?.correctionAvailable?'<strong>1회 정정 가능</strong>':''}`;}
   if(data?.limits?.nextAllowedAt)root.dataset.nextAllowedAt=data.limits.nextAllowedAt;
 }catch(error){root.innerHTML=`<article class="room-card room-empty"><div class="room-body"><h3>내 행성을 불러오지 못했어요</h3><p>${escapeHtml(error.message||'잠시 후 다시 시도해 주세요.')}</p></div></article>`}
}
$('#roomDeleteClose')?.addEventListener('click',closeRoomDeleteModal);$('#roomDeleteCancel')?.addEventListener('click',closeRoomDeleteModal);$('#roomDeleteBackdrop')?.addEventListener('click',event=>{if(event.target.id==='roomDeleteBackdrop')closeRoomDeleteModal()});$('#roomDeleteConfirm')?.addEventListener('click',()=>requestRoomDelete('accidental'));$('#roomRestoreAccidental')?.addEventListener('click',()=>requestRoomDelete('restore'));$('#roomReplaceWrong')?.addEventListener('click',()=>requestRoomDelete('wrong_room'));$('#roomDeleteFinalize')?.addEventListener('click',()=>requestRoomDelete('normal'));
async function continuePendingStudySetup(){
 const draft=readPendingStudy();if(!draft)return false;const prompt=(draft.prompt||draft.tagPrompt||'').trim();if(!prompt)return false;
 document.body.classList.add('app-mode');inferPrompt(prompt);showToast('저장된 설정으로 학습 공간을 생성하고 있어요…');
 try{const created=await createStudySpaceFromDraft({...draft,profile:readDemoProfile()?.id||null});activeStudySpaceId=created.id;clearPendingStudy();await refreshMyStudySpaces();openRoom(created.templateKey||state.builderRoom,created.id);saveDemoSession({lastView:'runtime',currentRoom:created.templateKey||state.builderRoom,lastStudyPrompt:prompt,activeStudySpaceId:created.id});return true}
 catch(error){showToast(roomCreationErrorMessage(error));return false}
}
async function requestStudySpaceCreation(){
 const draft=savePendingStudy(buildPendingStudyPayload());if(!draft.prompt){heroInput.focus();showToast('원하는 학습 방식이나 태그를 먼저 선택해 주세요.');return}
 if(!readDemoProfile()){const notice=$('#pendingStudyNotice');if(notice)notice.hidden=false;openDemoAccount('pending-study');return}
 try{await persistStudyDraft(draft)}catch(_e){}await continuePendingStudySetup();
}

async function listCommunityPosts(board,sort='recent'){
  const data=await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.communityPosts}?board=${encodeURIComponent(board)}&sort=${encodeURIComponent(sort)}`);
  return Array.isArray(data)?data:(data.items||[]);
}
async function fetchCommunityPost(id){return apiFetch(STUDYWORLD_SETTINGS.endpoints.communityPost.replace('{id}',encodeURIComponent(id)))}
async function listCommunityComments(postId){
  const data=await apiFetch(STUDYWORLD_SETTINGS.endpoints.communityComments.replace('{id}',encodeURIComponent(postId)));
  return Array.isArray(data)?data:(data.items||[]);
}
async function uploadCommunityImage(file){
  if(!file)return '';const form=new FormData();form.append('file',file);
  const data=await apiFetch(STUDYWORLD_SETTINGS.endpoints.uploads,{method:'POST',body:form});return data.url||'';
}

async function checkNicknameAvailability(nickname){
  const normalized=nickname.trim();
  if([...normalized].length<STUDYWORLD_SETTINGS.nickname.minLength)return{available:false,reason:`별명은 ${STUDYWORLD_SETTINGS.nickname.minLength}자 이상 입력해 주세요.`};
  if([...normalized].length>STUDYWORLD_SETTINGS.nickname.maxLength)return{available:false,reason:`별명은 ${STUDYWORLD_SETTINGS.nickname.maxLength}자 이하로 입력해 주세요.`};
  try{return await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.nicknameAvailability}?nickname=${encodeURIComponent(nickname)}`)}catch(error){return{available:false,reason:error.message||'서버에 연결하지 못했습니다.'}}
}

async function createCommunityPost(payload){return apiFetch(STUDYWORLD_SETTINGS.endpoints.communityPosts,{method:'POST',body:JSON.stringify(payload)});}
async function createCommunityComment(postId,payload){const path=STUDYWORLD_SETTINGS.endpoints.communityComments.replace('{id}',encodeURIComponent(postId));return apiFetch(path,{method:'POST',body:JSON.stringify(payload)});}

function switchView(v){
 state.view=v; $$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
 const navKey=v.startsWith('community')?'community':v;
 $$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===navKey));
 window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.view==='commons') openCommons(commonsCategory);
  else switchView(b.dataset.view);
}));

function roomCard(key,compact=false,meta={}){
 const safeKey=rooms[key]?key:'teach',r=rooms[safeKey],title=meta.title||r.title,pending=meta.status==='deleted_pending';const spaceAttr=meta.spaceId?` data-space-id="${escapeHtml(meta.spaceId)}"`:'';
 const management=!compact&&meta.owned&&meta.spaceId&&(meta.spaceKind||'personal')==='personal'?(pending?`<div class="room-manage-actions pending"><button type="button" data-room-resolve="${escapeHtml(meta.spaceId)}">삭제 처리 선택</button></div>`:`<div class="room-manage-actions"><button type="button" data-room-delete="${escapeHtml(meta.spaceId)}">방 정리</button></div>`):'';
 return `<article class="${compact?'cont-card':'room-card'}${pending?' room-card-pending':''}" data-room="${safeKey}" data-room-status="${escapeHtml(meta.status||'active')}"${spaceAttr}>
   <div class="${compact?'cont-top':'room-visual'}"><span class="bigicon">${r.icon}</span>${compact?`<span class="resume">${r.last}</span>`:`<span class="room-type">${escapeHtml(pending?'삭제 대기':(meta.ownership||r.recipe))}</span>`}</div>
   <div class="${compact?'':'room-body'}">
     <div class="room-meta" style="margin-top:${compact?'9':'0'}px"><span class="tag">${r.category}</span><span class="meta-pill">${r.activity}</span></div>
     <h3>${escapeHtml(title)}</h3>${compact?`<small>${r.desc}</small>`:`<p>${pending?'15분 이내에 복구하거나, 조건을 충족하면 1회 정정을 선택할 수 있어요.':r.desc}</p><div class="room-foot"><div style="flex:1"><div class="progress"><i style="width:${pending?0:r.progress}%"></i></div></div>${pending?'':`<span class="arrow"><svg class="icon-sm"><use href="#arrow"/></svg></span>`}</div>${management}`}
   </div></article>`;
}
function bindRoomClicks(root=document){
 $$('[data-room]',root).forEach(el=>el.addEventListener('click',event=>{if(event.target.closest('button')||el.dataset.roomStatus==='deleted_pending')return;openRoom(el.dataset.room,el.dataset.spaceId||null)}));
 $$('[data-room-delete]',root).forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();openRoomDeleteModal(button.dataset.roomDelete,'confirm')}));
 $$('[data-room-resolve]',root).forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();openRoomDeleteModal(button.dataset.roomResolve,'recovery')}));
}
let planetCatalog={
  '언어':{public:[],private:[]},
  'AI · 개발':{public:[],private:[]},
  '디자인':{public:[],private:[]},
  '인문 · 사회':{public:[],private:[]},
  '과학 · 수학':{public:[],private:[]},
  '시험 · 자격':{public:[],private:[]},
  '비즈니스':{public:[],private:[]},
  '취미 · 생활':{public:[],private:[]}
};
let lastPlanetTrigger=null;const planetDialogBackdrop=$('#planetDialogBackdrop'),planetDialog=$('#planetDialog');
let activePlanetCategory=null;
let commonsCategory='전체',commonsSort='recent';
const categoryOrder=['언어','AI · 개발','디자인','인문 · 사회','과학 · 수학','시험 · 자격','비즈니스','취미 · 생활'];
let discoveryCatalogLoaded=false,discoveryCatalogPromise=null;
async function ensureDiscoveryCatalog(force=false){
 if(discoveryCatalogLoaded&&!force)return planetCatalog;
 if(discoveryCatalogPromise&&!force)return discoveryCatalogPromise;
 discoveryCatalogPromise=(async()=>{
   const rows=await apiFetch('/api/v1/discovery/spaces?sort=recent');
   const next=Object.fromEntries(categoryOrder.map(cat=>[cat,{public:[],private:[]}]));
   for(const row of (Array.isArray(rows)?rows:[])){
     const cat=next[row.category]?row.category:'취미 · 생활';
     next[cat].public.push({id:row.id,title:row.title,meta:row.meta||'',desc:row.description||'',room:row.templateKey||'teach',recommend:Number(row.recommend||0),popular:Number(row.popular||0),visits:Number(row.visits||0),createdAt:row.createdAt||'',owner:row.owner||null});
   }
   planetCatalog=next;discoveryCatalogLoaded=true;return planetCatalog;
 })().finally(()=>{discoveryCatalogPromise=null});
 return discoveryCatalogPromise;
}
function planetAssetPath(asset){const map={language:'planet-language.webp','ai-dev':'planet-ai-dev.webp',design:'planet-design.webp','human-social':'planet-human-social.webp','science-math':'planet-science-math.webp','exam-cert':'planet-exam-cert.webp',business:'planet-business.webp','hobby-life':'planet-hobby-life.webp'};return `/assets/${map[asset]||'planet-hobby-life.webp'}`}
function formatVisits(n){return new Intl.NumberFormat('ko-KR').format(n)}
function planetThumbTheme(cat){return ({'언어':'language','AI · 개발':'ai','디자인':'design','인문 · 사회':'humanities','과학 · 수학':'science','시험 · 자격':'exam','비즈니스':'business','취미 · 생활':'life'})[cat]||'life'}
function publicPlanetCard(p,categoryLabel=''){
 const cat=categoryLabel||activePlanetCategory||p._category||'취미 · 생활',src=categoryIconSrc(cat),theme=planetThumbTheme(cat),owner=p.owner?.nickname?`<span class="planet-owner">🪐 ${escapeHtml(p.owner.nickname)}</span>`:'';
 return `<article class="discovery-planet planet-card-v37" data-space-id="${escapeHtml(p.id||'')}"><div class="card-thumbnail-banner thumb-${theme}">${src?`<img src="${src}" alt="" aria-hidden="true">`:''}<span class="thumb-category">${escapeHtml(cat)}</span><i class="thumb-dot d1"></i><i class="thumb-dot d2"></i><i class="thumb-dot d3"></i></div><div class="card-content">${categoryLabel?`<span class="planet-card-category">${escapeHtml(categoryLabel)}</span>`:''}<div class="planet-mini-meta"><span class="tag">공개</span><span class="meta-pill">${escapeHtml(p.meta||'')}</span></div><h4 class="card-title">${escapeHtml(p.title)}</h4><p class="card-description">${escapeHtml(p.desc)}</p>${owner}<div class="planet-card-foot card-meta"><strong>방문 ${formatVisits(p.visits)}</strong><span>${escapeHtml((p.createdAt||'').replaceAll('-','.'))}</span></div><div class="discovery-actions"><button type="button" data-planet-action="visit" data-room="${escapeHtml(p.room)}" data-space-id="${escapeHtml(p.id||'')}">방문</button><button type="button" class="join" data-planet-action="join" data-room="${escapeHtml(p.room)}" data-space-id="${escapeHtml(p.id||'')}">Join</button></div></div></article>`
}
function sortPlanetList(list,sortKey){const rows=[...list];if(sortKey==='recommend')return rows.sort((a,b)=>b.recommend-a.recommend||b.popular-a.popular);if(sortKey==='popular')return rows.sort((a,b)=>b.popular-a.popular||b.visits-a.visits);if(sortKey==='visits')return rows.sort((a,b)=>b.visits-a.visits);return rows.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))}
function renderPopupPublicPlanets(){const data=planetCatalog[activePlanetCategory];if(!data)return;const items=sortPlanetList(data.public,'recent').slice(0,3);$('#publicPlanets').innerHTML=items.length?items.map(p=>publicPlanetCard(p,activePlanetCategory)).join(''):'<div class="commons-empty">아직 공개된 행성이 없어요.</div>';$('#publicPlanetMore').hidden=data.public.length<=3;$('#publicPlanetHeading').textContent='최근 공개 행성'}
function renderPrivatePlanets(){const root=$('#privatePlanets');if(root)root.innerHTML='<div class="private-planet"><strong>비공개 행성은 광장 목록에 표시하지 않아요.</strong></div>'}
async function openPlanetDialog(cat,trigger){
 try{await ensureDiscoveryCatalog()}catch(_e){showToast('공개 스터디 목록을 불러오지 못했어요.');return}
 const data=planetCatalog[cat];if(!data)return;activePlanetCategory=cat;lastPlanetTrigger=trigger;$$('.planet-node').forEach(p=>p.setAttribute('aria-expanded',String(p===trigger)));const sourceIcon=trigger.querySelector('.planet-art img');$('#planetDialogIcon').src=sourceIcon?.currentSrc||sourceIcon?.src||planetAssetPath(trigger.dataset.asset);$('#planetDialogIcon').alt=`${cat} 아이콘`;$('#planetDialogTitle').textContent=`${cat}에서 시작해볼까요?`;$('#planetDialogDesc').textContent='실제 계정이 운영하는 공개 스터디룸을 둘러보고 참여할 수 있어요.';$('#planetCountLine').innerHTML=`<span class="planet-count-lead">지금</span><strong class="planet-count-number">${data.public.length}개의 공개 행성</strong><span class="planet-count-lead">이 있어요.</span>`;renderPopupPublicPlanets();renderPrivatePlanets();planetDialogBackdrop.hidden=false;document.body.style.overflow='hidden';requestAnimationFrame(()=>{planetDialog.scrollTop=0;const body=planetDialog.querySelector('.planet-dialog-body');if(body)body.scrollTop=0});setTimeout(()=>$('#planetDialogClose').focus(),30)
}
function closePlanetDialog(restoreFocus=true){if(planetDialogBackdrop.hidden)return;planetDialogBackdrop.hidden=true;document.body.style.overflow='';$$('.planet-node').forEach(p=>p.setAttribute('aria-expanded','false'));if(restoreFocus&&lastPlanetTrigger){lastPlanetTrigger.focus()}lastPlanetTrigger=null;activePlanetCategory=null}
function categoryIconSrc(cat){const node=$$('.planet-node').find(n=>n.dataset.category===cat);return node?.querySelector('.planet-art img')?.currentSrc||node?.querySelector('.planet-art img')?.src||''}
function renderCommonsCategories(){const root=$('#commonsCategories');if(!root)return;const items=['전체',...categoryOrder];root.innerHTML=items.map(cat=>{if(cat==='전체')return `<button class="commons-category ${commonsCategory==='전체'?'active':''}" type="button" data-commons-category="전체"><span class="commons-category-all">✦</span><span>전체</span></button>`;const src=categoryIconSrc(cat);return `<button class="commons-category ${commonsCategory===cat?'active':''}" type="button" data-commons-category="${escapeHtml(cat)}"><span class="commons-category-icon">${src?`<img src="${src}" alt="">`:''}</span><span>${escapeHtml(cat)}</span></button>`}).join('')}
function commonsPlanetRows(){if(commonsCategory==='전체')return categoryOrder.flatMap(cat=>planetCatalog[cat].public.map(p=>({...p,_category:cat})));return (planetCatalog[commonsCategory]?.public||[]).map(p=>({...p,_category:commonsCategory}))}
function renderCommons(){renderCommonsCategories();const rows=sortPlanetList(commonsPlanetRows(),commonsSort);$('#commonsTitle').textContent=commonsCategory==='전체'?'전체 공개 행성':`${commonsCategory} 공개 행성`;$('#commonsSummary').textContent=commonsCategory==='전체'?`지금 광장에 공개된 ${rows.length}개의 실제 스터디룸을 둘러볼 수 있어요.`:`${commonsCategory}에서 공개된 ${rows.length}개의 스터디룸을 보고 있어요.`;$('#commonsPlanetGrid').innerHTML=rows.length?rows.map(p=>publicPlanetCard(p,p._category||commonsCategory)).join(''):'<div class="commons-empty">아직 공개된 행성이 없어요.</div>';$$('[data-commons-sort]',$('#commonsSort')).forEach(b=>b.classList.toggle('active',b.dataset.commonsSort===commonsSort))}
async function openCommons(category=commonsCategory){await openSquareCategory(category)}
let planetFocusActive=false;
function enterPlanetFocus(){return false}
function exitPlanetFocus(){planetFocusActive=false;const hero=$('#view-home .hero');hero?.classList.remove('planet-focus');document.body.classList.remove('planet-focus-active')}
const homeWorld=$('#view-home .world'),homeHeroCopy=$('#view-home .hero-copy');
$$('#view-home .planet-node').forEach(node=>{node.removeAttribute('aria-hidden');node.setAttribute('aria-expanded','false');node.addEventListener('click',()=>openPlanetDialog(node.dataset.category,node))});
$('#planetDialogClose').addEventListener('click',()=>closePlanetDialog());
planetDialogBackdrop.addEventListener('click',e=>{if(e.target===planetDialogBackdrop)closePlanetDialog()});
async function openSquareCategory(category='전체'){
 try{await ensureDiscoveryCatalog()}catch(_e){showToast('공개 스터디 목록을 불러오지 못했어요.');return}
 const selected=category&&category!=='전체'&&planetCatalog[category]?category:'전체';commonsCategory=selected;renderCommons();switchView('commons');const query=selected==='전체'?'':`?category=${encodeURIComponent(selected)}`;try{if(location.protocol==='http:'||location.protocol==='https:')history.replaceState({view:'commons',category:selected},'',`/square${query}`);else history.replaceState({view:'commons',category:selected},'',`#/square${query}`)}catch(e){}
}
$('#publicPlanetMore').addEventListener('click',()=>{const category=activePlanetCategory||'전체';closePlanetDialog(false);openSquareCategory(category)});
$('#commonsCategories').addEventListener('click',e=>{const btn=e.target.closest('[data-commons-category]');if(!btn)return;commonsCategory=btn.dataset.commonsCategory;renderCommons();window.scrollTo({top:0,behavior:'smooth'})});
$('#commonsSort').addEventListener('click',e=>{const btn=e.target.closest('[data-commons-sort]');if(!btn)return;commonsSort=btn.dataset.commonsSort;renderCommons()});
async function handlePlanetAction(e){
 const btn=e.target.closest('[data-planet-action]');if(!btn)return;const room=btn.dataset.room,spaceId=btn.dataset.spaceId,action=btn.dataset.planetAction;if(!planetDialogBackdrop.hidden)closePlanetDialog(false);
 if(action==='join'){
   const profile=readDemoProfile();if(!profile){showToast('Join하려면 나만의 행성 열쇠가 필요해요.');if(typeof window.openPlanetKeyModal==='function')window.openPlanetKeyModal('Join하려면 먼저 내 행성 열쇠를 연결해 주세요.');return}
   try{await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.studySpaces}/${encodeURIComponent(spaceId)}/join`,{method:'POST'});await refreshMyStudySpaces();showToast('이 공개 스터디에 Join했어요. 내 행성에 연결했습니다.');openRoom(room,spaceId)}catch(error){showToast(error?.message||'이 스터디에 참여하지 못했어요.')}
   return;
 }
 if(spaceId)apiFetch(`/api/v1/discovery/spaces/${encodeURIComponent(spaceId)}/visit`,{method:'POST'}).catch(()=>{});
 openRoom(room);
}
planetDialog.addEventListener('click',handlePlanetAction);
$('#commonsPlanetGrid').addEventListener('click',handlePlanetAction);
$('#commonsCreate').addEventListener('click',()=>{switchView('home');setTimeout(()=>{heroInput.value='';activeSearchTab='purpose';activeSearchTag=null;renderSearchChips();syncSearchFieldState();heroInput.focus()},250)});

$('#myRooms').innerHTML='<article class="room-card room-empty"><div class="room-body"><h3>내 행성을 불러오는 중…</h3></div></article>';
$('#continueRooms').innerHTML=['paper','coding','language'].map(k=>roomCard(k,true)).join('');bindRoomClicks($('#continueRooms'));

function openRoom(key,spaceId=null){
 if(!rooms[key]) key='teach';
 if(spaceId)activeStudySpaceId=spaceId;
 state.currentRoom=key; if(typeof saveDemoSession==='function') saveDemoSession({currentRoom:key,lastView:'runtime'}); const r=rooms[key];
 document.body.dataset.runtimeRoom=key;
 $('#rtIcon').textContent=r.icon;$('#rtTitle').textContent=r.title;$('#rtSub').textContent=r.desc;
 $('#rtChips').innerHTML=`<span class="meta-pill">${r.recipe}</span><span class="meta-pill">Activity · ${r.activity}</span><span class="meta-pill">Agent · ${r.agent}</span><span class="meta-pill">Assessment · ${r.assessment}</span>`;
 $('#runtimeArea').innerHTML=renderRuntime(key);switchView('runtime');bindRuntime(key);
}
function renderRuntime(key){
 if(key==='paper')return readingRuntime();
 if(key==='coding')return codingRuntime();
 if(key==='language')return languageRuntime();
 if(key==='teach')return teachRuntime();
 if(key==='exam')return examRuntime();
 if(key==='memory')return memoryRuntime();
 if(key==='essay')return essayRuntime();
 return languageRuntime();
}
function readingRuntime(){return `<div class="reading-lab">
  <section class="reader-pane">
    <div class="reader-toolbar"><strong>Attention Is All You Need.pdf</strong><span>6 / 15</span><button type="button" class="reader-tool">−</button><span>100%</span><button type="button" class="reader-tool">＋</button></div>
    <article class="reader-paper" id="readerPaper"><div class="reader-page-label">SOURCE-FIRST READER</div><h2>Attention Is All You Need</h2><p class="reader-authors">Ashish Vaswani et al. · 2017</p><h3>Abstract</h3><p>We propose a new simple network architecture, the Transformer, based <mark data-reader-highlight="attention">solely on attention mechanisms</mark>, dispensing with recurrence and convolutions entirely.</p><h3>1. Introduction</h3><p>Sequence transduction models are traditionally based on recurrent or convolutional neural networks. <mark data-reader-highlight="parallel">The Transformer allows for more parallelization</mark> while retaining strong performance.</p><p>문장을 드래그하거나 형광펜 문장을 누르면 오른쪽 포스트잇에서 그 구간만 해설합니다.</p></article>
  </section>
  <aside class="reader-research-rail"><div class="reader-postit" id="readerPostit"><span>AI MARGIN NOTE</span><strong>궁금한 문장을 선택해보세요.</strong><p id="readerExplain">원문을 가리지 않고, 선택한 근거 바로 옆에서 짧게 설명해드릴게요.</p></div><div class="reader-notes"><div class="reader-note-title">나의 연구 노트 <small>자동 저장</small></div><div class="reader-note-paper" contenteditable="true">Self-Attention: 모든 위치를 동시에 참고할 수 있다는 점이 핵심.</div></div></aside>
</div>`}
function codingRuntime(){return `<div class="coding-dojo">
  <aside class="dojo-brief"><div class="dojo-label">CODING DOJO · PROBLEM</div><h2>두 수의 합</h2><p>정수 배열 <b>nums</b>와 target이 주어질 때, 합이 target이 되는 두 인덱스를 반환하세요.</p><pre>nums = [2,7,11,15]
target = 9
→ [0,1]</pre><div class="dojo-rule"><strong>정답은 숨김</strong><span>먼저 시도한 뒤에만 힌트가 열립니다.</span></div></aside>
  <main class="dojo-editor"><div class="dojo-editor-bar"><span><i></i><i></i><i></i></span><strong>solution.js</strong><div><span>JavaScript</span><button id="runTest" type="button">▶ Run tests</button></div></div><div class="dojo-code" contenteditable="true" spellcheck="false"><span class="kw">function</span> <span class="fn">twoSum</span>(nums, target) {
  const seen = new Map();

  for (let i = 0; i &lt; nums.length; i++) {
    // complement를 먼저 계산해보세요.
  }
}</div><div class="dojo-console" id="tests"><span>TEST RUNNER</span><div><b class="pass">PASS</b> Example 1</div><div><b class="fail">WAIT</b> Duplicate values</div><div><b class="fail">WAIT</b> Negative numbers</div></div></main>
  <aside class="dojo-coach"><div class="dojo-label">AI COACH · ON DEMAND</div><div class="coach-orb">✦</div><p id="codeHint">아직 정답은 말하지 않을게요. 현재 값의 짝을 이전에 본 적 있는지 빠르게 확인할 자료구조가 무엇인지 생각해보세요.</p><button id="hintBtn" type="button">다음 힌트 열기</button><small>AI는 요청할 때만 개입합니다.</small></aside>
</div>`}
function languageRuntime(){return `<div class="language-sim" aria-label="도쿄 편의점 음성 롤플레이 시뮬레이터">
  <section class="konbini-scene"><div class="store-sign">TOKYO · KONBINI · 24H</div><div class="store-shelves"><i></i><i></i><i></i></div><div class="clerk-character" aria-label="AI 편의점 점원"><span>いらっしゃいませ</span><div>🧑🏻‍💼</div></div><div class="ai-speech-card" id="npcSpeech" aria-live="polite"><div class="speech-top"><strong>AI 점원</strong><div class="voice-wave" id="voiceWave" aria-label="AI 음성 파형"><i></i><i></i><i></i><i></i><i></i></div></div><p>いらっしゃいませ。袋はご利用になりますか？</p><small>봉투 필요하세요?</small><div class="speech-audio-controls"><button id="replaySpeech" type="button">🔊 음성 재생</button><button id="slowSpeech" type="button">🐢 0.8배속 재생</button></div></div></section>
  <section class="language-live-panel" aria-label="라이브 음성 대화 컨트롤"><div class="live-goal"><span>LIVE ROLEPLAY</span><strong>말로 바로 대답해보세요</strong><p>대화 흐름은 유지하고, 교정은 상황이 끝난 뒤 한 번에 보여드려요.</p></div><button class="live-mic" id="micBtn" type="button" aria-pressed="false"><span class="mic-core">🎙️</span><span class="mic-status" id="micStatus">마이크로 대답하기</span><span class="mic-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="mic-rings" aria-hidden="true"><i></i><i></i><i></i></span></button><div class="live-transcript" id="liveTranscript" aria-live="polite">말하면 이곳에 실시간으로 들리는 문장이 표시돼요.</div><div class="inputbar language-text-input"><input id="langInput" placeholder="텍스트로 답하기 · 예: 袋はいりません。"><button type="button" id="langTextSend" aria-label="텍스트 답변 전송">→</button></div><div class="language-goal-row"><span>① 봉투 여부</span><span>② 결제 방법</span><span>③ 영수증</span></div></section>
</div>`}
function teachRuntime(){return `<div class="teachback-classroom">
  <section class="chalkboard-stage"><div class="chalk-dust" aria-hidden="true"></div><div class="chalk-label">TEACH-BACK CLASS</div><h2>오늘은 당신이 선생님이에요.</h2><p>“세포 호흡”을 학생에게 설명하듯 말하거나 적어보세요.</p><div class="chalk-input"><textarea id="teachInput" placeholder="세포 호흡은 포도당에서 에너지를 얻는 과정인데…"></textarea><button id="teachSubmit" type="button">설명 들려주기 →</button></div></section>
  <aside class="ai-student-seat"><div class="student-character"><div class="student-face">🌱</div><span class="student-reaction">궁금해요!</span></div><div class="student-question"><span>AI 학생의 질문</span><p id="studentQ">“포도당에서 에너지를 얻는다”는 건 알겠는데, 그 에너지가 바로 ATP가 되는 건가요?</p></div><div class="teach-coverage"><strong>설명 커버리지</strong><div><span>ATP 역할</span><i><b style="width:78%"></b></i><em>78%</em></div><div><span>미토콘드리아</span><i><b style="width:45%"></b></i><em>45%</em></div><div><span>산화·환원</span><i><b style="width:22%"></b></i><em>22%</em></div></div></aside>
</div>`}
function examRuntime(){return `<div class="workgrid" style="grid-template-columns:minmax(0,1fr) 330px">
 <section class="box"><div class="box-title">엄격한 시험실 <span class="tag">정답은 끝까지 숨김</span></div><div class="focus-stage"><div><div class="eyebrow">QUESTION 07 / 20</div><h2>훈민정음이 창제된 왕의 재위 기간에 있었던 일로 옳은 것은?</h2><div class="choicebar" style="max-width:720px;margin:24px auto 0;display:grid;grid-template-columns:1fr 1fr"><button>① 집현전이 폐지되었다</button><button>② 4군 6진을 개척하였다</button><button>③ 경국대전이 완성되었다</button><button>④ 대동법이 전국으로 확대되었다</button></div></div></div></section>
 <div class="stack"><section class="box"><div class="box-title">시험 상태 <span class="muted">힌트 없음</span></div><div class="box-pad"><div class="snapshot-grid"><div class="snapshot-card"><small>정답</small><strong>4</strong></div><div class="snapshot-card"><small>보류</small><strong>2</strong></div><div class="snapshot-card"><small>진행 문항</small><strong>7 / 20</strong></div><div class="snapshot-card"><small>난이도</small><strong>3/5</strong></div></div></div></section><section class="box"><div class="box-title">오답 복습은 시험 후</div><div class="box-pad"><div class="hint">시험 중에는 코칭과 해설을 섞지 않습니다. 종료 후 틀린 개념만 자동 복습 큐에 들어갑니다.</div></div></section></div></div>`}
function memoryRuntime(){return `<div class="workgrid" style="grid-template-columns:minmax(0,1fr) 330px">
 <section class="box"><div class="box-title">오늘의 플래시카드 <span class="tag">약점 우선</span></div><div class="box-pad"><div class="flashcard" id="flash"><div><div class="word">ubiquitous</div><p>뜻을 떠올린 뒤 카드를 눌러 확인</p></div></div><div class="choicebar"><button>다시</button><button>어려움</button><button>알겠음</button><button>쉬움</button></div></div></section>
 <div class="stack"><section class="box"><div class="box-title">복습 큐 <span class="muted">24장 남음</span></div><div class="box-pad"><div class="testrow"><span>오늘 틀린 카드</span><b>8</b></div><div class="testrow"><span>3회 연속 정답</span><b>12</b></div><div class="testrow"><span>오늘 제외 예정</span><b>5</b></div></div></section><section class="box"><div class="box-title">비용 정책</div><div class="box-pad"><div class="hint">카드는 한 번 생성해 저장하고, 반복 스케줄·진행도는 AI 없이 처리합니다.</div></div></section></div></div>`}
function essayRuntime(){return `<div class="workgrid" style="grid-template-columns:minmax(0,1.15fr) 360px">
 <section class="box"><div class="box-title">내 글 <span class="muted">2차 수정본</span></div><div class="box-pad"><div class="notepad" contenteditable="true" style="min-height:540px;font-size:13px">기술이 발전할수록 인간의 선택은 더 자유로워지는가. 편리함은 선택의 폭을 넓히지만, 동시에 선택을 대신하는 알고리즘에 의존하게 만들기도 한다...\n\n여기에 이어서 작성해보세요.</div></div></section>
 <div class="stack"><section class="box"><div class="box-title">비평가의 지적 3개 <span class="tag">대필 금지</span></div><div class="box-pad"><ol style="font-size:12px;line-height:1.7;padding-left:20px"><li>첫 문단의 핵심 주장이 아직 넓습니다.</li><li>‘편리함’의 예시가 추상적입니다.</li><li>반대 사례를 한 번 다루면 논지가 단단해집니다.</li></ol><div class="hint">수정문을 대신 써주지 않습니다. 사용자가 고친 뒤 다시 평가합니다.</div></div></section><section class="box"><div class="box-title">평가 기준</div><div class="box-pad rubric"><div class="rubric-row"><span>주장 명확성</span><div class="progress"><i style="width:66%"></i></div><b>66</b></div><div class="rubric-row"><span>근거 구체성</span><div class="progress"><i style="width:48%"></i></div><b>48</b></div><div class="rubric-row"><span>반론 처리</span><div class="progress"><i style="width:32%"></i></div><b>32</b></div></div></section></div></div>`}
function speakLanguageLine(rate=1){
 const line=$('#npcSpeech p')?.textContent?.trim()||'いらっしゃいませ。袋はご利用になりますか？';
 const wave=$('#voiceWave');
 if(!('speechSynthesis' in window)){showToast('이 브라우저에서는 음성 재생을 지원하지 않아요.');return}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(line);u.lang='ja-JP';u.rate=rate;u.pitch=1;u.volume=1;if(wave)wave.classList.add('speaking');u.onend=()=>wave?.classList.remove('speaking');u.onerror=()=>wave?.classList.remove('speaking');speechSynthesis.speak(u);
}
function bindRuntime(key){
 if(key==='paper'){
   const explain=(text)=>{const box=$('#readerExplain');if(!box)return;const clean=(text||'').trim();box.textContent=clean?`“${clean.slice(0,90)}${clean.length>90?'…':''}” 구간을 원문 맥락 안에서 설명합니다. 앞뒤 문장의 대비와 저자가 주장하는 기능을 먼저 확인해보세요.`:'궁금한 구간을 선택하면 여기서 바로 설명합니다.'};
   $$('[data-reader-highlight]').forEach(m=>m.onclick=()=>explain(m.textContent));
   $('#readerPaper')?.addEventListener('mouseup',()=>{const t=String(window.getSelection?.()||'').trim();if(t)explain(t)});
 }
 if(key==='coding'){let n=1;$('#hintBtn').onclick=()=>{$('#codeHint').textContent=n++===1?'좋아요. complement = target - nums[i]를 매 반복마다 계산해보세요. 아직 코드 전체는 말하지 않을게요.':'이제 Map에서 complement가 이미 존재하는지만 확인하면 됩니다.'};$('#runTest').onclick=()=>showToast('로컬 테스트를 실행했습니다. AI 호출 0회.')}
 if(key==='language'){
   $('#replaySpeech').onclick=()=>speakLanguageLine(1);$('#slowSpeech').onclick=()=>speakLanguageLine(.8);
   const npcRespond=(userText='袋はいりません。カードでお願いします。')=>{const t=(userText||'').trim()||'袋はいりません。カードでお願いします。';$('#liveTranscript').textContent=`나: ${t}`;const p=$('#npcSpeech')?.querySelector('p'),s=$('#npcSpeech')?.querySelector('small');if(/カード|card|카드/i.test(t)){p.textContent='かしこまりました。カードをこちらにお願いいたします。';s.textContent='알겠습니다. 카드를 이쪽에 대주세요.'}else if(/いりません|不要|괜찮|필요 없|no/i.test(t)){p.textContent='かしこまりました。お支払い方法はいかがなさいますか？';s.textContent='알겠습니다. 결제 방법은 어떻게 하시겠어요?'}else{p.textContent='はい、かしこまりました。ほかにご利用はございますか？';s.textContent='네, 알겠습니다. 그 밖에 필요한 것은 있으신가요?'}setTimeout(()=>speakLanguageLine(1),120);showToast('대화를 이어갈게요. 교정은 롤플레이가 끝난 뒤 보여드려요.')};
   $('#langTextSend').onclick=()=>{const input=$('#langInput');npcRespond(input?.value);if(input)input.value=''};
   $('#langInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#langTextSend')?.click()}});
   let mediaStream=null,recorder=null,recognition=null,finalTranscript='';
   const stopListening=(submit=true)=>{const btn=$('#micBtn'),status=$('#micStatus');btn?.classList.remove('listening');btn?.setAttribute('aria-pressed','false');if(status)status.textContent='마이크로 대답하기';try{if(recognition)recognition.stop()}catch(_e){}try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch(_e){}mediaStream?.getTracks().forEach(t=>t.stop());mediaStream=null;recorder=null;recognition=null;if(submit&&finalTranscript.trim())npcRespond(finalTranscript.trim())};
   $('#micBtn').onclick=async()=>{const btn=$('#micBtn'),status=$('#micStatus');if(btn.classList.contains('listening')){stopListening(true);return}finalTranscript='';try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});btn.classList.add('listening');btn.setAttribute('aria-pressed','true');status.textContent='음성 수신 중 · 누르면 완료';$('#liveTranscript').textContent='듣고 있어요… 일본어로 편하게 말해보세요.';const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(SR){recognition=new SR();recognition.lang='ja-JP';recognition.interimResults=true;recognition.continuous=true;recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const part=e.results[i][0].transcript;if(e.results[i].isFinal)finalTranscript+=part;else interim+=part}$('#liveTranscript').textContent=`듣는 중: ${(finalTranscript+interim).trim()||'…'}`};recognition.onerror=()=>{$('#liveTranscript').textContent='음성을 정확히 듣지 못했어요. 다시 말하거나 텍스트로 입력해 주세요.'};recognition.start()}else if(window.MediaRecorder){recorder=new MediaRecorder(mediaStream);recorder.start();$('#liveTranscript').textContent='음성 수신 중이에요. 브라우저 STT 미지원 환경이라 녹음 상태만 표시됩니다.'}}catch(e){showToast('마이크 권한을 허용하면 라이브 대화를 시작할 수 있어요.');stopListening(false)}};
 }
 if(key==='teach'){$('#teachSubmit').onclick=()=>{$('#studentQ').textContent='그럼 미토콘드리아 안에서 포도당이 그대로 ATP가 되는 건가요? 중간 과정이 궁금해요.';showToast('설명의 빈틈 1개를 찾았습니다.')}}
 if(key==='memory'){$('#flash').onclick=()=>{$('#flash').innerHTML='<div><div class="word">어디에나 존재하는</div><p>ubiquitous · 3번째 복습</p></div>'}}
}

const backdrop=$('#backdrop'),drawer=$('#drawer'),builder=$('#builderPrompt');
function inferPrompt(t){
 t=t.toLowerCase();let k='teach';
 if(/코딩|코드|개발|테스트/.test(t))k='coding';
 else if(/논문|pdf|원문|문서/.test(t))k='paper';
 else if(/면접|회화|영어|일본어|말하기|롤플레이/.test(t))k='language';
 else if(/설명|가르|학생처럼|teach/.test(t))k='teach';
 else if(/시험|자격|문제.*시험/.test(t))k='exam';
 else if(/암기|단어|플래시/.test(t))k='memory';
 else if(/에세이|글쓰기|논술|비평/.test(t))k='essay';
 state.builderRoom=k;const r=rooms[k];
 $('#recipeId').textContent=r.recipe;$('#cfgRecipe').textContent=r.title;$('#cfgActivity').textContent=r.activity;$('#cfgAgent').textContent=r.agent;$('#cfgAssessment').textContent=r.assessment;$('#cfgPolicy').textContent=r.policy;$('#cfgLayout').textContent=r.layout;
}
function openBuilder(text=''){builder.value=text;inferPrompt(text);backdrop.classList.add('show');drawer.classList.add('show');setTimeout(()=>builder.focus(),120)}
function closeBuilder(){backdrop.classList.remove('show');drawer.classList.remove('show')}
if($('#start')) $('#start').onclick=()=>openBuilder();$('#newRoom').onclick=()=>openBuilder();$('#close').onclick=closeBuilder;backdrop.onclick=closeBuilder;builder.addEventListener('input',e=>inferPrompt(e.target.value));
const SEARCH_EXAMPLES=[
 '예: 오늘 배운 개념 알려주고, 잘 이해했는지 맞춤 퀴즈 3개만 내줘',
 '예: 이 긴 자료 핵심만 요약해 주고, 중요한 키워드 빈칸 채우기 만들어 줘',
 '예: 면접관 역할 맡아줘. 내 답변 듣고 부족한 점이랑 꼬리 질문 던져줘',
 '예: 틀린 문제 원인 분석해 주고, 내가 약한 부분만 다시 시험 보게 해줘',
 '예: 어려운 전문 용어를 초등학생도 쉽게 이해할 수 있게 비유로 설명해 줘'
];
const SEARCH_TAGS={
 purpose:[
  {label:'🎯 자격증 단기 완성',prompt:'자격증 시험을 단기간에 준비하고 싶어. 핵심 개념과 약한 부분을 중심으로 반복 학습 환경을 만들어줘.'},
  {label:'📝 기출 문제 풀이',prompt:'기출 문제를 먼저 풀고, 틀린 문제의 원인을 분석한 뒤 약한 유형만 다시 시험 보게 해줘.'},
  {label:'🗣️ 비즈니스 영어',prompt:'비즈니스 영어 상황을 실제처럼 롤플레이하고, 내 답변이 끝난 뒤 표현과 발음을 피드백해줘.'},
  {label:'💡 개념 정립 & 암기',prompt:'핵심 개념을 이해한 뒤 내가 직접 설명하게 하고, 기억이 약한 부분은 반복해서 다시 물어봐줘.'}
 ],
 method:[
  {label:'✏️ 빈칸 퀴즈 만들기',prompt:'내 자료에서 핵심 키워드를 뽑아 빈칸 퀴즈를 만들고, 틀린 항목만 다시 출제해줘.'},
  {label:'📖 핵심 요약집 생성',prompt:'긴 학습 자료를 핵심 구조 중심으로 요약하고, 꼭 기억할 내용만 짧은 요약집으로 정리해줘.'},
  {label:'❌ 오답 노트 자동 정리',prompt:'내가 틀린 문제를 원인별로 분류하고, 오답 노트를 자동으로 정리한 뒤 유사 문제를 다시 내줘.'},
  {label:'🎙️ 소리 내어 말하며 암기',prompt:'내가 소리 내어 설명하며 암기할 수 있게 질문을 던지고, 빠진 내용을 마지막에만 알려줘.'}
 ],
 situation:[
  {label:'🏫 중·고등 내신 대비',prompt:'중·고등 내신 대비용으로 개념 확인, 학교 시험형 문제, 오답 복습이 이어지는 학습 공간을 만들어줘.'},
  {label:'📜 자격증 실기·서술형',prompt:'자격증 실기와 서술형 대비를 위해 답안을 직접 작성하고 채점 기준에 따라 피드백 받게 해줘.'},
  {label:'💼 실무 지식 빠르게 파악',prompt:'실무에서 필요한 지식을 빠르게 파악할 수 있게 핵심 개념, 사례, 확인 질문 순서로 구성해줘.'},
  {label:'🌍 외국어 말하기 수련',prompt:'외국어 말하기를 실제 상황처럼 연습하고 대화 흐름을 끊지 않은 뒤 마지막에 피드백해줘.'}
 ]
};
let activeSearchTab='purpose',activeSearchTag=null,rollingExampleIndex=0,rollingTimer=null,rollingResumeTimer=null;
const heroInput=$('#heroInput'),rollingPlaceholder=$('#rollingPlaceholder'),searchCommand=$('#searchCommand'),searchChipList=$('#searchChipList');
function renderSearchChips(){
 searchChipList.innerHTML=SEARCH_TAGS[activeSearchTab].map((item,i)=>`<button type="button" class="search-chip ${activeSearchTag===i?'active':''}" data-search-chip="${i}">${item.label}</button>`).join('');
 $$('[data-search-chip]',searchChipList).forEach(btn=>btn.onclick=()=>{
   activeSearchTag=Number(btn.dataset.searchChip);renderSearchChips();
   const item=SEARCH_TAGS[activeSearchTab][activeSearchTag];heroInput.value=item.prompt;syncSearchFieldState();heroInput.focus();
 });
}
function stopRollingPlaceholder(){clearInterval(rollingTimer);rollingTimer=null;clearTimeout(rollingResumeTimer)}
function showRollingExample(nextIndex,animate=true){
 const update=()=>{rollingExampleIndex=(nextIndex+SEARCH_EXAMPLES.length)%SEARCH_EXAMPLES.length;rollingPlaceholder.textContent=SEARCH_EXAMPLES[rollingExampleIndex];rollingPlaceholder.classList.remove('fade-out')};
 if(!animate){update();return}
 rollingPlaceholder.classList.add('fade-out');setTimeout(update,STUDYWORLD_SETTINGS.search.fadeMs);
}
function nextRollingExample(){showRollingExample(rollingExampleIndex+1,true)}
function startRollingPlaceholder(){
 stopRollingPlaceholder();if(document.activeElement===heroInput||heroInput.value.trim())return;
 rollingTimer=setInterval(nextRollingExample,STUDYWORLD_SETTINGS.search.rotateMs);
}
function syncSearchFieldState(){searchCommand.classList.toggle('has-value',!!heroInput.value.trim())}
$$('[data-search-tab]').forEach(btn=>btn.onclick=()=>{
 activeSearchTab=btn.dataset.searchTab;activeSearchTag=null;
 $$('[data-search-tab]').forEach(x=>{const on=x===btn;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on))});
 renderSearchChips();
});
$('#exampleRefresh').onclick=()=>{stopRollingPlaceholder();nextRollingExample();if(document.activeElement!==heroInput&&!heroInput.value.trim())startRollingPlaceholder()};
heroInput.addEventListener('focus',()=>{stopRollingPlaceholder();searchCommand.classList.add('is-input-active')});
heroInput.addEventListener('input',syncSearchFieldState);
heroInput.addEventListener('blur',()=>{searchCommand.classList.remove('is-input-active');syncSearchFieldState();if(!heroInput.value.trim())rollingResumeTimer=setTimeout(startRollingPlaceholder,STUDYWORLD_SETTINGS.search.resumeDelayMs)});
rollingPlaceholder.onclick=()=>heroInput.focus();
renderSearchChips();showRollingExample(0,false);startRollingPlaceholder();
$('#heroForm').onsubmit=e=>{e.preventDefault();requestStudySpaceCreation()};

$('#create').onclick=async()=>{const prompt=builder.value.trim();if(!prompt){showToast('만들고 싶은 학습 환경을 먼저 적어주세요.');builder.focus();return}savePendingStudy({version:1,prompt,source:'builder',createdAt:new Date().toISOString()});closeBuilder();if(!readDemoProfile()){openDemoAccount('pending-study');return}await continuePendingStudySetup()};$('#preview').onclick=()=>showToast(`${rooms[state.builderRoom].recipe} 구성을 미리 확인 중입니다.`);
$('#modifyRoom').onclick=()=>openBuilder(`현재 ${rooms[state.currentRoom].title}의 학습 로직은 유지하고, `);
const loginBtn=$('#login'); if(loginBtn) loginBtn.onclick=()=>showToast('데모에서는 별도 로그인을 사용하지 않습니다.');


// v21 planet-key identity + continuity flow
const DEMO_PROFILE_KEY='studyworld.demo.profile.v1';
const DEMO_SESSION_KEY='studyworld.demo.session.v1';
const supportModalBackdrop=$('#supportModalBackdrop');
const demoAccountBackdrop=$('#demoAccountBackdrop');
const planetKeyIssuedBackdrop=$('#planetKeyIssuedBackdrop');
const guestLaunch=$('#guestLaunch');
const guestLaunchLabel=$('#guestLaunchLabel');
const demoProfileStatus=$('#demoProfileStatus');
const demoNickname=$('#demoNickname');
let pendingDemoDestination='rooms';
const NICKNAME_PLACEHOLDER_EXAMPLES=['세계최강','㉠┤울공쥬☆','쿨ㅎ┼게살ㅈ┼','눈맑은 아이'];
function chooseRandomItem(items){return items[Math.floor(Math.random()*items.length)]}
function assignAuthPlaceholders(){
  if(demoNickname)demoNickname.placeholder='입력해 주세요.';
}
let nicknameAvailable=false;let nicknameCheckTimer=null;let nicknameCheckSeq=0;
let issuedProfile=null;

function readDemoProfile(){try{const profile=JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY)||'null');return profile?.id&&profile?.nickname?profile:null}catch(e){return null}}
function normalizePlanetKey(value=''){return value.trim().toUpperCase().replace(/\s+/g,'')}
function isValidPlanetKeyFormat(value=''){return /^ST-[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/.test(normalizePlanetKey(value))}
function maskPlanetKey(){return 'ST-•••••-•••••-•••••-•••••'}
function saveDemoSession(patch={}){
  if(!readDemoProfile()) return;
  let prev={};try{prev=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'{}')}catch(e){}
  localStorage.setItem(DEMO_SESSION_KEY,JSON.stringify({...prev,...patch,lastActiveAt:new Date().toISOString()}));
}
async function issuePlanetKey(nickname){
  const pendingStudy=readPendingStudy();const data=await apiFetch(STUDYWORLD_SETTINGS.endpoints.planetKeyIssue,{method:'POST',body:JSON.stringify({nickname,continuity:'planet-key',pendingStudy:pendingStudy||null})});const profile=data.profile||{};
  return{id:profile.id,nickname:profile.nickname||nickname,role:profile.role||'user',accountOrigin:profile.accountOrigin||'member',publicCode:profile.publicCode||'',planetImageUrl:profile.planetImageUrl||null,maskedPlanetKey:maskPlanetKey(),planetKey:data.planetKey,createdAt:profile.createdAt||new Date().toISOString(),serverBacked:true};
}

function updateDemoLaunchUI(){
  const p=readDemoProfile();
  const trigger=$('#profileMenuTrigger');
  const guestKeyLogin=$('#gnbKeyLogin');
  const guestKeyIssue=$('#gnbKeyIssue');
  const myPlanetsNav=$('#navMyPlanets');
  if(p){
    if(guestLaunch){guestLaunchLabel.textContent='즉시 학습 시작';demoProfileStatus.hidden=false;demoProfileStatus.innerHTML=`🪐 <strong>${escapeHtml(p.nickname)}</strong>님의 행성이 연결되어 있어요.${p.publicCode?` <span class="muted">${escapeHtml(p.publicCode)}</span>`:''}`}
    if(guestKeyLogin)guestKeyLogin.hidden=true;
    if(guestKeyIssue)guestKeyIssue.hidden=true;
    if(myPlanetsNav)myPlanetsNav.hidden=false;
    if(trigger){trigger.hidden=false;$('#profileMenuName').textContent=p.nickname;$('#profileDropdownName').textContent=`${p.nickname}님의 행성`;$('#profileDropdownKey').textContent=(p.publicCode||'공개 코드 준비 중');const img=$('#profileDropdownPlanetImage');if(img)img.src=p.planetImageUrl||'/favicon-192.png';const adminButton=$('#adminManagedUsers');if(adminButton)adminButton.hidden=p.role!=='admin'}
  }else{
    if(guestLaunch){guestLaunchLabel.textContent='즉시 학습 시작';demoProfileStatus.hidden=true;demoProfileStatus.textContent=''}
    if(guestKeyLogin)guestKeyLogin.hidden=false;
    if(guestKeyIssue)guestKeyIssue.hidden=false;
    if(myPlanetsNav)myPlanetsNav.hidden=true;
    if(trigger){trigger.hidden=true;trigger.setAttribute('aria-expanded','false');$('#profileDropdown').hidden=true}const adminButton=$('#adminManagedUsers');if(adminButton)adminButton.hidden=true
  }
  requestAnimationFrame(()=>{if(typeof syncGnbIndicator==='function')syncGnbIndicator(false)});
}
function openDemoAccount(destination='rooms'){
  pendingDemoDestination=destination;
  const existing=readDemoProfile();
  if(existing){ if(destination==='pending-study')continuePendingStudySetup(); else enterDemoApp(destination); return; }
  const notice=$('#pendingStudyNotice');if(notice)notice.hidden=destination!=='pending-study';
  assignAuthPlaceholders();
  nicknameAvailable=false;demoNickname.value='';$('#demoAccountSubmit').disabled=true;$('#nicknameStatus').className='nickname-status';$('#nicknameStatus').textContent='';
  demoAccountBackdrop.hidden=false;
  setTimeout(()=>demoNickname.focus(),50);
}
function closeDemoAccount(){demoAccountBackdrop.hidden=true}
function openPlanetKeyIssued(profile){
  issuedProfile=profile;
  $('#planetKeyIssuedTitle').textContent=`✨ 모험가 ${profile.nickname}님의 [나만의 행성 열쇠]가 발급되었습니다!`;
  $('#planetKeyCode').textContent=profile.planetKey;
  const image=$('#planetKeyIssuedImage');if(image)image.src=profile.planetImageUrl||'/favicon-192.png';
  $('#planetKeyServerNote').hidden=!profile.serverBacked;
  planetKeyIssuedBackdrop.hidden=false;
}
function clearIssuedPlanetSecret(){if(issuedProfile?.planetKey)issuedProfile={...issuedProfile,planetKey:null}}
function closePlanetKeyIssued(){planetKeyIssuedBackdrop.hidden=true;clearIssuedPlanetSecret();$('#planetKeyCode').textContent='ST-•••••-•••••-•••••-•••••'}
function syncAppRoute(destination){
  const routeMap={home:'/',rooms:'/my-planets',commons:'/square',community:'/community',launch:'/start',dashboard:'/dashboard',runtime:'/study'};
  const route=routeMap[destination];if(!route)return;
  try{
    if(location.protocol==='http:'||location.protocol==='https:')history.replaceState({view:destination},'',route);
    else history.replaceState({view:destination},'',`#${route}`);
  }catch(e){}
}
function enterDemoApp(destination='rooms'){
  const p=readDemoProfile(); if(!p){openDemoAccount(destination);return}
  document.body.classList.add('app-mode');
  switchView(destination);
  syncAppRoute(destination);
  saveDemoSession({lastView:destination});
  showToast(`${p.nickname}님의 행성을 열었습니다.`);
}
if(guestLaunch) guestLaunch.onclick=()=>openDemoAccount('rooms');
$('#demoAccountClose').onclick=closeDemoAccount;
demoAccountBackdrop.addEventListener('click',e=>{if(e.target===demoAccountBackdrop)closeDemoAccount()});
$('#planetKeyIssuedClose').onclick=closePlanetKeyIssued;
planetKeyIssuedBackdrop.addEventListener('click',e=>{if(e.target===planetKeyIssuedBackdrop)closePlanetKeyIssued()});

demoNickname.addEventListener('input',()=>{
  clearTimeout(nicknameCheckTimer);nicknameAvailable=false;const status=$('#nicknameStatus');const value=demoNickname.value.trim();
  status.className='nickname-status';$('#demoAccountSubmit').disabled=true;if(!value){status.textContent='';return}status.classList.add('checking');status.textContent='닉네임 사용 가능 여부를 확인하고 있어요…';
  const seq=++nicknameCheckSeq;nicknameCheckTimer=setTimeout(async()=>{const result=await checkNicknameAvailability(value);if(seq!==nicknameCheckSeq)return;nicknameAvailable=!!result.available;status.className='nickname-status '+(nicknameAvailable?'available':'unavailable');status.textContent=result.reason|| (nicknameAvailable?'사용 가능한 닉네임입니다.':'이 닉네임은 사용할 수 없습니다.');$('#demoAccountSubmit').disabled=!nicknameAvailable;},STUDYWORLD_SETTINGS.nickname.debounceMs);
});
$('#demoAccountForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const nickname=demoNickname.value.trim();
  if(!nickname){demoNickname.focus();return}
  const result=await checkNicknameAvailability(nickname);nicknameAvailable=!!result.available;
  const status=$('#nicknameStatus');status.className='nickname-status '+(nicknameAvailable?'available':'unavailable');status.textContent=result.reason|| (nicknameAvailable?'사용 가능한 닉네임입니다.':'이 닉네임은 사용할 수 없습니다.');
  if(!nicknameAvailable){demoNickname.focus();return}
  const submit=$('#demoAccountSubmit');submit.disabled=true;submit.textContent='행성 열쇠를 발급하고 있어요…';
  try{
    const profile=await issuePlanetKey(nickname);
    if(!profile.planetKey)throw new Error('PLANET_KEY_MISSING');
    localStorage.setItem(DEMO_PROFILE_KEY,JSON.stringify({id:profile.id,nickname:profile.nickname,role:profile.role,accountOrigin:profile.accountOrigin,publicCode:profile.publicCode,planetImageUrl:profile.planetImageUrl,maskedPlanetKey:maskPlanetKey(),createdAt:profile.createdAt}));
    localStorage.setItem(DEMO_SESSION_KEY,JSON.stringify({lastView:pendingDemoDestination,currentRoom:state.currentRoom,lastActiveAt:new Date().toISOString()}));
    closeDemoAccount();updateDemoLaunchUI();openPlanetKeyIssued(profile);
  }catch(err){status.className='nickname-status unavailable';status.textContent='열쇠 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.'}
  finally{submit.textContent='🔑 나만의 행성 열쇠 발급하기 →';submit.disabled=!nicknameAvailable}
});

$('#planetKeyCopy').addEventListener('click',async()=>{
  const key=issuedProfile?.planetKey||$('#planetKeyCode').textContent.trim();
  try{await navigator.clipboard.writeText(key);showToast('행성 열쇠를 클립보드에 복사했어요.')}catch(e){const ta=document.createElement('textarea');ta.value=key;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('행성 열쇠를 복사했어요.')}
});
async function savePlanetKeyCard(profile){
  if(!profile)return;
  if(document.fonts?.ready)try{await document.fonts.ready}catch(e){}
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;const ctx=canvas.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1200,720);grad.addColorStop(0,'#f7f4ea');grad.addColorStop(.58,'#f4f7ed');grad.addColorStop(1,'#e9f1e3');ctx.fillStyle=grad;ctx.fillRect(0,0,1200,720);
  ctx.strokeStyle='#d1ddd0';ctx.lineWidth=3;roundRect(ctx,48,48,1104,624,40);ctx.stroke();
  ctx.fillStyle='#0d4939';ctx.font='700 32px SchoolSafetyRoundedSmile, sans-serif';ctx.fillText('STUDYWORLD · MY PLANET',90,118);
  // simple planet mark
  ctx.beginPath();ctx.arc(170,278,86,0,Math.PI*2);ctx.fillStyle='#86b67c';ctx.fill();ctx.beginPath();ctx.arc(139,247,36,0,Math.PI*2);ctx.fillStyle='#dff0b5';ctx.fill();ctx.strokeStyle='#e3c85f';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(170,278,135,42,-.18,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#0d4939';ctx.font='700 46px Cafe24Surround, sans-serif';ctx.fillText(`모험가 ${profile.nickname}님의 행성`,315,238);
  ctx.fillStyle='#586860';ctx.font='400 26px SchoolSafetyRoundedSmile, sans-serif';ctx.fillText('공유용 행성 카드 · 복구용 비밀 열쇠는 이미지에 포함하지 않습니다',315,292);
  ctx.fillStyle='#ffffff';roundRect(ctx,315,340,750,112,24);ctx.fill();ctx.strokeStyle='#cbd8c9';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#0d4939';ctx.font='700 42px ui-monospace, monospace';ctx.fillText(profile.publicCode||'PL-STUDYWORLD',355,410);
  ctx.fillStyle='#748279';ctx.font='400 20px SchoolSafetyRoundedSmile, sans-serif';ctx.fillText('이 카드는 공유해도 되지만, 발급받은 전체 행성 열쇠는 절대 공유하지 마세요.',315,520);
  ctx.fillStyle='#0d4939';ctx.font='700 22px SchoolSafetyRoundedSmile, sans-serif';ctx.fillText('HOPE · STUDYWORLD',90,626);
  const a=document.createElement('a');a.download=`studyworld-${profile.nickname}-planet-card.png`;a.href=canvas.toDataURL('image/png');a.click();
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
$('#planetKeyCardSave').addEventListener('click',()=>savePlanetKeyCard(issuedProfile));
$('#planetKeyEnter').addEventListener('click',async()=>{closePlanetKeyIssued();if(pendingDemoDestination==='pending-study')await continuePendingStudySetup();else enterDemoApp(pendingDemoDestination)});
const profileMenuTrigger=$('#profileMenuTrigger'),profileDropdown=$('#profileDropdown'),planetKeyLockBackdrop=$('#planetKeyLockBackdrop');
function closeProfileDropdown(){if(!profileDropdown||!profileMenuTrigger)return;profileDropdown.hidden=true;profileMenuTrigger.setAttribute('aria-expanded','false')}
function openPlanetKeyLock(){const p=readDemoProfile();if(!p)return;closeProfileDropdown();$('#planetKeyLockMasked').textContent=maskPlanetKey();const copyButton=$('#planetKeyCopyAndLock');if(copyButton)copyButton.hidden=!issuedProfile?.planetKey;planetKeyLockBackdrop.hidden=false}
function closePlanetKeyLock(){planetKeyLockBackdrop.hidden=true}
async function detachPlanetKeyFromDevice(){try{await apiFetch(STUDYWORLD_SETTINGS.endpoints.logout,{method:'POST'})}catch(_e){}localStorage.removeItem(DEMO_PROFILE_KEY);localStorage.removeItem(DEMO_SESSION_KEY);localStorage.removeItem('studyworld.dynamic.space.v1');issuedProfile=null;document.body.classList.remove('app-mode');delete document.body.dataset.runtimeRoom;updateDemoLaunchUI();closePlanetKeyLock();switchView('launch');showToast('이 기기의 세션과 로컬 학습 작업을 안전하게 종료했어요.')}
if(profileMenuTrigger)profileMenuTrigger.addEventListener('click',e=>{e.stopPropagation();const open=profileDropdown.hidden;profileDropdown.hidden=!open;profileMenuTrigger.setAttribute('aria-expanded',String(open))});
document.addEventListener('click',e=>{if(profileDropdown&&!profileDropdown.hidden&&!e.target.closest('#profileSlot'))closeProfileDropdown()});
$('#profileLockKey')?.addEventListener('click',openPlanetKeyLock);$('#planetKeyLockClose')?.addEventListener('click',closePlanetKeyLock);planetKeyLockBackdrop?.addEventListener('click',e=>{if(e.target===planetKeyLockBackdrop)closePlanetKeyLock()});
$('#profileRotateKey')?.addEventListener('click',async()=>{
 const p=readDemoProfile();if(!p)return;closeProfileDropdown();
 if(!confirm('행성 열쇠를 다시 발급할까요? 이전 열쇠와 다른 기기의 기존 세션은 즉시 폐기됩니다.'))return;
 try{
  const result=await apiFetch(STUDYWORLD_SETTINGS.endpoints.planetKeyRotate,{method:'POST'});
  const profile={...p,maskedPlanetKey:maskPlanetKey(),planetKey:result.planetKey,serverBacked:true};
  localStorage.setItem(DEMO_PROFILE_KEY,JSON.stringify({...p,maskedPlanetKey:maskPlanetKey()}));
  updateDemoLaunchUI();openPlanetKeyIssued(profile);showToast('새 행성 열쇠를 발급했어요. 이전 열쇠는 더 이상 사용할 수 없습니다.');
 }catch(error){showToast(error?.message||'행성 열쇠를 다시 발급하지 못했어요.')}
});
$('#planetKeyLockPlain')?.addEventListener('click',detachPlanetKeyFromDevice);
$('#planetKeyCopyAndLock')?.addEventListener('click',async()=>{
 const key=issuedProfile?.planetKey;if(!key){showToast('전체 열쇠는 발급 직후 한 번만 표시됩니다. 보관한 열쇠를 확인한 뒤 로그아웃해 주세요.');return}
 try{await navigator.clipboard.writeText(key)}catch(e){const ta=document.createElement('textarea');ta.value=key;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
 await detachPlanetKeyFromDevice();showToast('복구용 열쇠를 복사하고 이 기기의 세션을 종료했어요.');
});


const adminManagedBackdrop=$('#adminManagedBackdrop'),adminManagedList=$('#adminManagedList'),adminManagedStatus=$('#adminManagedStatus');
const adminKeyResultBackdrop=$('#adminKeyResultBackdrop');
let adminManagedProfilesCache=[];let adminOneTimeKey='';
function closeAdminManaged(){if(adminManagedBackdrop)adminManagedBackdrop.hidden=true}
function closeAdminKeyResult(){if(adminKeyResultBackdrop)adminKeyResultBackdrop.hidden=true;adminOneTimeKey='';const code=$('#adminKeyResultCode');if(code)code.textContent=''}
function adminProfileOptions(currentId){return adminManagedProfilesCache.filter(p=>p.status==='active').map(p=>`<option value="${escapeHtml(p.id)}"${p.id===currentId?' selected':''}>${escapeHtml(p.nickname)} · ${escapeHtml(p.publicCode||'')}</option>`).join('')}
function renderAdminManagedProfiles(items){
 adminManagedProfilesCache=Array.isArray(items)?items:[];
 if(!adminManagedList)return;
 adminManagedList.innerHTML=adminManagedProfilesCache.length?adminManagedProfilesCache.map(profile=>`<article class="admin-managed-user" data-admin-profile="${escapeHtml(profile.id)}">
  <div class="admin-managed-user-head">
   <img class="admin-managed-avatar" src="${escapeHtml(profile.planetImageUrl||'/favicon-192.png')}" alt="" width="56" height="56" loading="lazy">
   <div><strong>${escapeHtml(profile.nickname)}</strong><small>${escapeHtml(profile.publicCode||'')} · 열쇠 v${escapeHtml(profile.credentialVersion||1)} · ${profile.status==='active'?'활성':'정지'}</small></div>
   <div class="admin-managed-actions">
    <button type="button" data-admin-rename="${escapeHtml(profile.id)}">별명 변경</button>
    <button type="button" data-admin-rotate="${escapeHtml(profile.id)}">열쇠 재발급</button>
    <button type="button" data-admin-status="${escapeHtml(profile.id)}" data-next-status="${profile.status==='active'?'suspended':'active'}">${profile.status==='active'?'계정 정지':'계정 복구'}</button>
   </div>
  </div>
  <div class="admin-managed-room-list">${(profile.rooms||[]).map(room=>`<div class="admin-managed-room" data-admin-room="${escapeHtml(room.id)}">
    <input type="text" maxlength="80" value="${escapeHtml(room.title)}" data-admin-room-title aria-label="스터디룸 제목">
    <input type="text" maxlength="40" value="${escapeHtml(room.category||'')}" data-admin-room-category aria-label="카테고리">
    <select data-admin-room-template aria-label="학습 템플릿">${Object.keys(rooms).map(k=>`<option value="${k}"${k===room.templateKey?' selected':''}>${escapeHtml(rooms[k].recipe)} · ${escapeHtml(k)}</option>`).join('')}</select>
    <div class="admin-room-options"><label><input type="checkbox" data-admin-room-discoverable${room.discoverable?' checked':''}> 광장 공개</label><button type="button" class="admin-room-save" data-admin-room-save="${escapeHtml(room.id)}">저장</button></div>
    <select data-admin-room-owner aria-label="방장 변경">${adminProfileOptions(profile.id)}</select><button type="button" class="admin-room-transfer" data-admin-room-transfer="${escapeHtml(room.id)}">방장 변경</button>
   </div>`).join('')||'<small>연결된 초기 공개 스터디룸이 없습니다.</small>'}</div>
 </article>`).join(''):'<div class="commons-empty">관리 중인 초기 사용자가 없습니다.</div>';
}
async function loadAdminManaged(){
 const p=readDemoProfile();if(!p||p.role!=='admin'){showToast('관리자 권한이 필요합니다.');return}
 if(adminManagedStatus)adminManagedStatus.textContent='불러오는 중…';
 try{const items=await apiFetch(STUDYWORLD_SETTINGS.endpoints.adminManagedProfiles);renderAdminManagedProfiles(items);if(adminManagedStatus)adminManagedStatus.textContent=`초기 사용자 ${items.length}명 · 실제 DB 계정/룸`;}
 catch(error){if(adminManagedStatus)adminManagedStatus.textContent=error?.message||'불러오지 못했습니다.'}
}
async function openAdminManaged(){closeProfileDropdown();if(!adminManagedBackdrop)return;adminManagedBackdrop.hidden=false;await loadAdminManaged()}
function showAdminOneTimeKey(nickname,key){adminOneTimeKey=key||'';$('#adminKeyResultOwner').textContent=`${nickname}님의 새 열쇠입니다. 이전 열쇠는 즉시 폐기되었습니다.`;$('#adminKeyResultCode').textContent=adminOneTimeKey;adminKeyResultBackdrop.hidden=false}
$('#adminManagedUsers')?.addEventListener('click',openAdminManaged);
$('#adminManagedClose')?.addEventListener('click',closeAdminManaged);adminManagedBackdrop?.addEventListener('click',e=>{if(e.target===adminManagedBackdrop)closeAdminManaged()});
$('#adminManagedRefresh')?.addEventListener('click',loadAdminManaged);
$('#adminKeyResultClose')?.addEventListener('click',closeAdminKeyResult);adminKeyResultBackdrop?.addEventListener('click',e=>{if(e.target===adminKeyResultBackdrop)closeAdminKeyResult()});
$('#adminKeyResultCopy')?.addEventListener('click',async()=>{if(!adminOneTimeKey)return;try{await navigator.clipboard.writeText(adminOneTimeKey);showToast('새 열쇠를 복사했어요.')}catch(_e){showToast('복사하지 못했어요. 화면의 열쇠를 직접 안전하게 저장해 주세요.')}});
adminManagedList?.addEventListener('click',async e=>{
 const rename=e.target.closest('[data-admin-rename]'),rotate=e.target.closest('[data-admin-rotate]'),status=e.target.closest('[data-admin-status]'),save=e.target.closest('[data-admin-room-save]'),transfer=e.target.closest('[data-admin-room-transfer]');
 try{
  if(rename){const profile=adminManagedProfilesCache.find(x=>x.id===rename.dataset.adminRename);const nickname=prompt('새 별명을 입력하세요.',profile?.nickname||'');if(!nickname||nickname===profile?.nickname)return;await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.adminManagedProfiles}/${encodeURIComponent(profile.id)}`,{method:'PATCH',body:JSON.stringify({nickname})});showToast('별명을 변경했어요. 공개 행성 이미지도 다시 생성됩니다.');discoveryCatalogLoaded=false;await loadAdminManaged();return}
  if(rotate){const profile=adminManagedProfilesCache.find(x=>x.id===rotate.dataset.adminRotate);if(!profile||!confirm(`${profile.nickname}님의 행성 열쇠를 다시 발급할까요? 이전 열쇠와 모든 기존 세션이 폐기됩니다.`))return;const result=await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.adminManagedProfiles}/${encodeURIComponent(profile.id)}/planet-key/rotate`,{method:'POST'});showAdminOneTimeKey(profile.nickname,result.planetKey);await loadAdminManaged();return}
  if(status){const profile=adminManagedProfilesCache.find(x=>x.id===status.dataset.adminStatus);const next=status.dataset.nextStatus;if(!profile||!confirm(`${profile.nickname} 계정을 ${next==='suspended'?'정지':'복구'}할까요?`))return;await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.adminManagedProfiles}/${encodeURIComponent(profile.id)}`,{method:'PATCH',body:JSON.stringify({status:next})});showToast(next==='suspended'?'계정을 정지했어요.':'계정을 다시 활성화했어요.');discoveryCatalogLoaded=false;await loadAdminManaged();return}
  if(save){const row=save.closest('[data-admin-room]');const id=save.dataset.adminRoomSave;const payload={title:row.querySelector('[data-admin-room-title]').value.trim(),category:row.querySelector('[data-admin-room-category]').value.trim(),templateKey:row.querySelector('[data-admin-room-template]').value,discoverable:row.querySelector('[data-admin-room-discoverable]').checked};await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.adminStudySpaces}/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});showToast('스터디룸 정보를 저장했어요.');discoveryCatalogLoaded=false;await loadAdminManaged();return}
  if(transfer){const row=transfer.closest('[data-admin-room]');const id=transfer.dataset.adminRoomTransfer;const ownerProfileId=row.querySelector('[data-admin-room-owner]').value;const current=adminManagedProfilesCache.find(p=>(p.rooms||[]).some(r=>r.id===id));if(!ownerProfileId||ownerProfileId===current?.id)return;if(!confirm('이 스터디룸의 방장을 변경할까요? 기존 방장은 소유권을 잃습니다.'))return;await apiFetch(`${STUDYWORLD_SETTINGS.endpoints.adminStudySpaces}/${encodeURIComponent(id)}/transfer`,{method:'POST',body:JSON.stringify({ownerProfileId})});showToast('방장을 변경했어요.');discoveryCatalogLoaded=false;await loadAdminManaged();return}
 }catch(error){showToast(error?.message||'관리 작업을 완료하지 못했어요.')}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(adminKeyResultBackdrop&&!adminKeyResultBackdrop.hidden){closeAdminKeyResult();return}if(adminManagedBackdrop&&!adminManagedBackdrop.hidden)closeAdminManaged()}},true);

function openSupportModal(){
  supportModalBackdrop.hidden=false;
  const supportChatInput=$('#supportChatInput');
  if(supportChatInput) setTimeout(()=>supportChatInput.focus(),60);
}
function closeSupportModal(){supportModalBackdrop.hidden=true}
window.openSupportModal=openSupportModal;
const fairySupportBtn=$('#fairySupportBtn'); if(fairySupportBtn) fairySupportBtn.onclick=openSupportModal;
$('#supportModalClose').onclick=closeSupportModal;
supportModalBackdrop.addEventListener('click',e=>{if(e.target===supportModalBackdrop)closeSupportModal()});

const supportChatLog=$('#supportChatLog');
const supportChatForm=$('#supportChatForm');
const supportChatInput=$('#supportChatInput');
function appendSupportMessage(role,text){
  if(!supportChatLog) return;
  const msg=document.createElement('div');
  msg.className=`chat-msg ${role}`;
  msg.innerHTML=role==='user'?`<strong>나</strong><p>${escapeHtml(text)}</p>`:`<strong>요정</strong><p>${text}</p>`;
  supportChatLog.appendChild(msg);
  supportChatLog.scrollTop=supportChatLog.scrollHeight;
}
function supportReplyFor(input){
  const q=input.toLowerCase();
  if(/faq|자주|이용법/.test(q)) return '자주 묻는 질문은 곧 정리해서 보여드릴게요. 지금은 <b>광장 탐색</b>, <b>커뮤니티 이용</b>, <b>행성 열쇠와 기록 연결</b> 관련 문의를 가장 많이 받고 있어요.';
  if(/오류|버그|맵|생성/.test(q)) return 'AI 맵 생성이나 데모 오류는 <b>어떤 단계에서</b>, <b>무슨 현상</b>이 있었는지 적어주시면 더 정확히 도와드릴 수 있어요. 필요하면 담당 팀에 전달할 수 있게 정리해드릴게요.';
  if(/계정|기록|저장|브라우저|복원/.test(q)) return '학습 기록은 행성 열쇠로 연결된 익명 프로필과 안전한 세션을 통해 이어갈 수 있어요. 전체 행성 열쇠는 발급 순간에만 표시되므로 별도로 안전하게 보관해 주세요.';
  return '알려주셔서 고마워요. 조금 더 자세히 적어주시면 요정이 바로 이어서 도와드릴게요. 예: “AI 맵 생성에서 멈췄어요”, “학습 기록은 어디에 저장되나요?”';
}
if(supportChatForm) supportChatForm.addEventListener('submit',e=>{
  e.preventDefault();
  const value=supportChatInput.value.trim();
  if(!value) return;
  appendSupportMessage('user',value);
  supportChatInput.value='';
  setTimeout(()=>appendSupportMessage('fairy',supportReplyFor(value)),360);
});
$$('[data-support-quick]').forEach(btn=>btn.addEventListener('click',()=>{
  const v=btn.dataset.supportQuick;
  appendSupportMessage('user',v);
  setTimeout(()=>appendSupportMessage('fairy',supportReplyFor(v)),260);
}));


const boardMeta={
 cert:{title:'공부 인증게시판',desc:'오늘 수련 완료 캡처와 기록을 공유해요.',eyebrow:'STUDY LOG ARCHIVE'},
 qa:{title:'Q&A 게시판',desc:'막히는 수학·자격증 문제를 서로 묻고 답해요.',eyebrow:'QUESTION & ANSWER'},
 share:{title:'맵 · 자료 공유',desc:'AI 프롬프트, 학습 맵과 노하우를 나눠요.',eyebrow:'MAP & RESOURCE ARCHIVE'}
};
let activeCommunityBoard='cert';let activePostId=null;
function relativeTime(iso){const ms=Date.now()-new Date(iso).getTime(),m=Math.max(1,Math.round(ms/60000));if(m<60)return `${m}분 전`;const h=Math.round(m/60);if(h<24)return `${h}시간 전`;return new Date(iso).toLocaleDateString('ko-KR')}
function renderArchiveCard(post){
 if(post.board==='cert')return `<button class="cert-card" type="button" data-post-id="${escapeHtml(post.id)}"><span class="cert-thumb">${post.image?`<img src="${escapeHtml(post.image)}" alt="">`:`<span class="cert-shot"><i></i><i></i><i></i><b><em></em><em></em><em></em><em></em><em></em></b></span>`}</span><span class="cert-body"><strong class="cert-title">${escapeHtml(post.title)}</strong><span class="cert-meta"><span class="cert-user"><i class="cert-avatar">${escapeHtml((post.author||'U')[0])}</i>${escapeHtml(post.author||'사용자')}</span><span>${relativeTime(post.createdAt)}</span></span></span></button>`;
 if(post.board==='qa')return `<button class="qa-row" type="button" data-post-id="${escapeHtml(post.id)}"><span class="qa-status ${post.status==='waiting'?'wait':''}">${post.status==='waiting'?'답변대기':'답변완료'}</span><strong class="qa-title">${escapeHtml(post.title)}</strong><span class="qa-meta"><span>💬 ${post.commentCount||0}</span><span>${relativeTime(post.createdAt)}</span></span></button>`;
 return `<button class="share-card" type="button" data-post-id="${escapeHtml(post.id)}"><span class="share-thumb">${post.image?`<img src="${escapeHtml(post.image)}" alt="">`:`<span class="share-world"></span>`}</span><span class="share-body"><strong class="share-title">${escapeHtml(post.title)}</strong><span class="share-tags">${(post.tags||[]).map(t=>`<span class="share-tag">#${escapeHtml(t.replace(/^#/,''))}</span>`).join('')}</span><span class="share-foot"><span class="share-download">📥 다운로드 ${post.downloads||0}</span><span>${relativeTime(post.createdAt)}</span></span></span></button>`;
}
function bindDynamicPostClicks(root=document){$$('[data-post-id]',root).forEach(btn=>{btn.onclick=()=>openCommunityPost(btn.dataset.postId)})}
function openCommunityBoard(board){
 activeCommunityBoard=board;const meta=boardMeta[board];
 $('#boardEyebrow').textContent=meta.eyebrow;$('#boardPageTitle').textContent=meta.title;$('#boardPageDesc').textContent=meta.desc;
 $$('#boardProductTabs button').forEach(b=>b.classList.toggle('active',b.dataset.boardOpen===board));
 $('#composerBoard').value=board;updateComposerOptionalFields();renderCommunityBoard();switchView('community-board');
}
async function renderCommunityBoard(){
 const sort=$('#boardSortSelect')?.value||'recent';const root=$('#boardArchiveContainer');if(!root)return;
 root.className='board-archive-container';root.innerHTML='<div class="archive-empty">게시물을 불러오고 있어요…</div>';
 try{const posts=await listCommunityPosts(activeCommunityBoard,sort);if(!posts.length){root.innerHTML='<div class="archive-empty">아직 게시물이 없어요. 첫 글을 작성해보세요.</div>';return}root.className='board-archive-container '+(activeCommunityBoard==='cert'?'archive-cert-grid':activeCommunityBoard==='qa'?'archive-qa-list':'archive-share-grid');root.innerHTML=posts.map(renderArchiveCard).join('');bindDynamicPostClicks(root)}catch(error){root.innerHTML=`<div class="archive-empty">${escapeHtml(error?.message||'게시물을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</div>`}
}
async function openCommunityPost(id){
 try{const post=await fetchCommunityPost(id);if(!post)return;activePostId=id;activeCommunityBoard=post.board;$('#postBoardChip').textContent=boardMeta[post.board].title;$('#postDetailTitle').textContent=post.title;$('#postDetailMeta').textContent=`${post.author||'사용자'} · ${relativeTime(post.createdAt)} · 조회 ${post.views||0}`;$('#postDetailBody').textContent=post.body||'';const media=$('#postDetailMedia');if(post.image){media.hidden=false;media.innerHTML=`<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" decoding="async">`}else{media.hidden=post.board!=='cert'&&post.board!=='share';media.innerHTML=media.hidden?'':'<span class="share-world" aria-hidden="true"></span>'}$('#postDetailTags').innerHTML=(post.tags||[]).map(t=>`<span>#${escapeHtml(t.replace(/^#/,''))}</span>`).join('');switchView('community-post');await renderComments()}catch(error){showToast(error?.message||'게시물을 불러오지 못했어요.')}
}
async function renderComments(){try{const comments=await listCommunityComments(activePostId);$('#commentCount').textContent=`${comments.length}개`;$('#commentList').innerHTML=comments.length?comments.map(c=>`<div class="comment-item"><strong>${escapeHtml(c.author||'사용자')} · ${relativeTime(c.createdAt)}</strong><p>${escapeHtml(c.body)}</p></div>`).join(''):'<div class="archive-empty" style="padding:18px">아직 댓글이 없어요.</div>'}catch(error){$('#commentList').innerHTML=`<div class="archive-empty" style="padding:18px">${escapeHtml(error?.message||'댓글을 불러오지 못했어요.')}</div>`}}
function updateComposerOptionalFields(){const b=$('#composerBoard').value;const root=$('#composerOptionalFields');if(b==='cert')root.innerHTML='<label>인증 이미지 (선택)<input id="composerImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>';else if(b==='share')root.innerHTML='<label>태그 (쉼표로 구분)<input id="composerTags" placeholder="중1수학, AI맵, 복습"></label><label>썸네일 이미지 (선택)<input id="composerImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>';else root.innerHTML='<label>질문 상태<select id="composerStatus"><option value="waiting">답변대기</option><option value="answered">답변완료</option></select></label>'}
function openCommunityComposer(){const p=readDemoProfile();if(!p){openDemoAccount('community');showToast('글을 작성하려면 먼저 별명을 정하고 행성 열쇠를 발급해 주세요.');return}$('#communityComposerBackdrop').hidden=false;$('#composerBoard').value=activeCommunityBoard;updateComposerOptionalFields();setTimeout(()=>$('#composerTitle').focus(),50)}
function closeCommunityComposer(){$('#communityComposerBackdrop').hidden=true}
$$('[data-board-open]').forEach(btn=>btn.addEventListener('click',()=>openCommunityBoard(btn.dataset.boardOpen)));
bindDynamicPostClicks();
$('#boardSortSelect').addEventListener('change',renderCommunityBoard);
$('#openComposerBtn').onclick=openCommunityComposer;$('#communityComposerClose').onclick=closeCommunityComposer;$('#communityComposerBackdrop').addEventListener('click',e=>{if(e.target.id==='communityComposerBackdrop')closeCommunityComposer()});
$('#composerBoard').addEventListener('change',updateComposerOptionalFields);
$('#communityComposerForm').addEventListener('submit',async e=>{e.preventDefault();const p=readDemoProfile();if(!p){openDemoAccount('community');return}const board=$('#composerBoard').value;const tags=($('#composerTags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);let image='';try{image=await uploadCommunityImage($('#composerImageFile')?.files?.[0]);const payload={board,title:$('#composerTitle').value.trim(),body:$('#composerBody').value.trim(),image,tags};await createCommunityPost(payload);closeCommunityComposer();e.target.reset();activeCommunityBoard=board;openCommunityBoard(board);showToast('게시물이 등록됐어요.')}catch(err){showToast(err?.code==='IMAGE_TOO_LARGE'?'이미지 파일은 5MB 이하로 올려주세요.':(err?.message||'게시물을 등록하지 못했어요.'))}});
$('#postBackBtn').onclick=()=>openCommunityBoard(activeCommunityBoard);
$('#commentForm').addEventListener('submit',async e=>{e.preventDefault();const p=readDemoProfile();if(!p){openDemoAccount('community');return}const body=$('#commentInput').value.trim();if(!body)return;try{await createCommunityComment(activePostId,{body});$('#commentInput').value='';await renderComments();showToast('댓글이 등록됐어요.')}catch(error){showToast(error?.message||'댓글을 등록하지 못했어요.')}});
const footerSupport=$('#footerSupport'); if(footerSupport) footerSupport.onclick=openSupportModal;
updateDemoLaunchUI();
assignAuthPlaceholders();

let fairyTimer=null;
function resetFairyAppearance(){
  clearTimeout(fairyTimer);
  if(!fairySupportBtn) return;
  fairySupportBtn.classList.remove('visible');
}
function revealFairy(){
  if(!fairySupportBtn||state.view==='home') return;
  fairySupportBtn.classList.add('visible');
}
function scheduleFairyAppearance(){
  if(!fairySupportBtn||state.view==='home') return resetFairyAppearance();
  clearTimeout(fairyTimer);
  fairyTimer=setTimeout(revealFairy,320);
}
const _switchView=switchView;
switchView=function(v){
  if(v!=='home'&&typeof exitPlanetFocus==='function'&&planetFocusActive)exitPlanetFocus();
  _switchView(v);
  if(readDemoProfile()||v!=='rooms')syncAppRoute(v);
  document.body.dataset.currentView=v;
  if(v!=='runtime') delete document.body.dataset.runtimeRoom;
  if(v==='home') resetFairyAppearance(); else scheduleFairyAppearance();
  requestAnimationFrame(()=>syncGnbIndicator(false));
};
document.body.dataset.currentView=state.view;
resetFairyAppearance();


// v20 GNB shooting-star indicator
const gnbNav=$('.nav');
const gnbIndicator=$('#gnbIndicator');
const gnbButtons=$$('.nav button[data-view]');
let gnbSparkTimer=0;
function getActiveGnbButton(){return $('.nav button[data-view].active')||gnbButtons[0]}
function moveGnbIndicator(target,spark=true){
  if(!gnbNav||!gnbIndicator||!target) return;
  const navRect=gnbNav.getBoundingClientRect();
  const rect=target.getBoundingClientRect();
  const inset=Math.max(4,rect.width*.08);
  gnbIndicator.style.left=`${rect.left-navRect.left+inset}px`;
  gnbIndicator.style.width=`${Math.max(18,rect.width-inset*2)}px`;
  if(spark){
    clearTimeout(gnbSparkTimer);
    gnbIndicator.classList.remove('is-shooting');
    void gnbIndicator.offsetWidth;
    gnbIndicator.classList.add('is-shooting');
    gnbSparkTimer=setTimeout(()=>gnbIndicator.classList.remove('is-shooting'),620);
  }
}
function syncGnbIndicator(spark=true){moveGnbIndicator(getActiveGnbButton(),spark)}
if(gnbNav&&gnbIndicator){
  gnbButtons.forEach(btn=>{
    btn.addEventListener('pointerenter',()=>moveGnbIndicator(btn,true));
    btn.addEventListener('focus',()=>moveGnbIndicator(btn,true));
    btn.addEventListener('click',()=>requestAnimationFrame(()=>syncGnbIndicator(true)));
  });
  gnbNav.addEventListener('pointerleave',()=>syncGnbIndicator(true));
  gnbNav.addEventListener('focusout',e=>{if(!gnbNav.contains(e.relatedTarget))syncGnbIndicator(false)});
  window.addEventListener('resize',()=>syncGnbIndicator(false),{passive:true});
  requestAnimationFrame(()=>syncGnbIndicator(false));
}

const launchCard=$('.launch-card');
if(launchCard){
  let launchGlowFrame=0;
  let pendingGlowPoint=null;
  const paintLaunchGlow=()=>{
    launchGlowFrame=0;
    if(!pendingGlowPoint)return;
    const {x,y}=pendingGlowPoint;
    launchCard.style.setProperty('--firefly-x',`${x}px`);
    launchCard.style.setProperty('--firefly-y',`${y}px`);
    launchCard.style.setProperty('--firefly-opacity','1');
    launchCard.classList.add('is-pointer-active');
  };
  const updateLaunchGlow=(e)=>{
    if(e.pointerType==='touch')return;
    const r=launchCard.getBoundingClientRect();
    pendingGlowPoint={
      x:Math.max(0,Math.min(r.width,e.clientX-r.left)),
      y:Math.max(0,Math.min(r.height,e.clientY-r.top))
    };
    if(!launchGlowFrame)launchGlowFrame=requestAnimationFrame(paintLaunchGlow);
  };
  launchCard.addEventListener('pointerenter',updateLaunchGlow);
  launchCard.addEventListener('pointermove',updateLaunchGlow);
  launchCard.addEventListener('pointerleave',()=>{
    pendingGlowPoint=null;
    if(launchGlowFrame){cancelAnimationFrame(launchGlowFrame);launchGlowFrame=0}
    launchCard.classList.remove('is-pointer-active');
    launchCard.style.setProperty('--firefly-opacity','0');
  });
}
let toastId;function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastId);toastId=setTimeout(()=>t.classList.remove('show'),2300)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#communityComposerBackdrop').hidden)closeCommunityComposer();else if(!planetKeyIssuedBackdrop.hidden)closePlanetKeyIssued();else if(planetKeyLockBackdrop&&!planetKeyLockBackdrop.hidden)closePlanetKeyLock();else if(!demoAccountBackdrop.hidden)closeDemoAccount();else if(!supportModalBackdrop.hidden)closeSupportModal();else if(!planetDialogBackdrop.hidden)closePlanetDialog();else if(planetFocusActive)exitPlanetFocus();else closeBuilder()}});


// v30 — restore Planet Key access and turn the home orbit into a draggable 360° showroom.
(function(){
  const $v=(s,r=document)=>r.querySelector(s);
  const $$v=(s,r=document)=>Array.from(r.querySelectorAll(s));

  // ---------- Planet Key entry ----------
  const keyModal=$v('#keyModal');
  const keyInput=$v('#keyModalInput');
  const keyStatus=$v('#keyModalStatus');
  function openKeyModal(message=''){
    if(!keyModal)return;
    keyStatus.className='nickname-status';keyStatus.textContent=message||'';keyInput.value='';keyInput.type='password';
    const reveal=$v('#keyModalReveal');if(reveal){reveal.textContent='보기';reveal.setAttribute('aria-pressed','false')}
    keyModal.hidden=false;setTimeout(()=>keyInput.focus(),60);
  }
  window.openPlanetKeyModal=openKeyModal;
  function closeKeyModal(){if(keyModal)keyModal.hidden=true}
  async function restorePlanetKeyV30(value){
    const key=normalizePlanetKey(value);if(!isValidPlanetKeyFormat(key))throw new Error('INVALID_FORMAT');
    const data=await apiFetch(STUDYWORLD_SETTINGS.endpoints.planetKeyRestore,{method:'POST',body:JSON.stringify({planetKey:key})});const profile=data.profile||{};
    return{id:profile.id,nickname:profile.nickname||'모험가',role:profile.role||'user',accountOrigin:profile.accountOrigin||'member',publicCode:profile.publicCode||'',planetImageUrl:profile.planetImageUrl||null,maskedPlanetKey:maskPlanetKey(),createdAt:profile.createdAt||new Date().toISOString(),serverBacked:true};
  }

  $v('#keyModalClose')?.addEventListener('click',closeKeyModal);
  $v('#keyModalReveal')?.addEventListener('click',e=>{const visible=keyInput.type==='text';keyInput.type=visible?'password':'text';e.currentTarget.textContent=visible?'보기':'숨기기';e.currentTarget.setAttribute('aria-pressed',String(!visible));keyInput.focus()});
  keyModal?.addEventListener('click',e=>{if(e.target===keyModal)closeKeyModal()});
  $v('#keyModalForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    keyStatus.className='nickname-status checking';keyStatus.textContent='열쇠를 확인하고 기록을 불러오고 있어요…';
    try{
      const profile=await restorePlanetKeyV30(keyInput.value);
      localStorage.setItem(DEMO_PROFILE_KEY,JSON.stringify(profile));
      updateDemoLaunchUI();saveDemoSession({lastView:'rooms'});
      keyStatus.className='nickname-status available';keyStatus.textContent='열쇠 확인 완료. 내 행성을 열고 있어요.';
      setTimeout(()=>{closeKeyModal();document.body.classList.add('app-mode');switchView('rooms');showToast(`${profile.nickname}님의 행성을 불러왔어요.`)},260);
    }catch(err){
      keyStatus.className='nickname-status unavailable';
      keyStatus.textContent='존재하지 않거나 형식이 올바르지 않은 열쇠 코드입니다.';
    }
  });
  const launchKey=$v('#guestLaunch');
  if(launchKey){launchKey.onclick=()=>openDemoAccount('rooms');$v('#guestLaunchLabel').textContent='행성 열쇠 발급받기'}
  const launchRestore=$v('#planetKeyRestoreFromLaunch');
  if(launchRestore) launchRestore.onclick=openKeyModal;
  const gnbKey=$v('#gnbKeyLogin');
  if(gnbKey){gnbKey.textContent='🪐 행성 입장';gnbKey.onclick=openKeyModal}
  const gnbIssue=$v('#gnbKeyIssue');
  if(gnbIssue)gnbIssue.onclick=()=>openDemoAccount('rooms');
  $v('#planetKeyIssueOpen')?.addEventListener('click',()=>openDemoAccount('rooms'));
  const guestBrowse=$v('#guestBrowse');
  if(guestBrowse) guestBrowse.addEventListener('click',()=>{
    switchView('commons');
    if(typeof syncAppRoute==='function') syncAppRoute('commons');
  });

  // Existing authenticated users still jump directly to their planet collection.
  const baseUpdateDemoLaunchUI=window.updateDemoLaunchUI||updateDemoLaunchUI;
  if(typeof baseUpdateDemoLaunchUI==='function'){
    window.updateDemoLaunchUI=updateDemoLaunchUI=function(){
      baseUpdateDemoLaunchUI();
      const profile=readDemoProfile();
      const label=$v('#guestLaunchLabel');
      if(label)label.textContent=profile?'나만의 행성으로 이동하기':'행성 열쇠 발급받기';
      if(launchKey)launchKey.onclick=profile?(()=>switchView('rooms')):(()=>openDemoAccount('rooms'));
      if(launchRestore) launchRestore.hidden=!!profile;
      const g=$v('#gnbKeyLogin');if(g&&!profile){g.textContent='🪐 행성 입장';g.onclick=openKeyModal}
      const issue=$v('#gnbKeyIssue');if(issue){issue.hidden=!!profile;if(!profile)issue.onclick=()=>openDemoAccount('rooms')}
    };
    updateDemoLaunchUI();
  }
  const p=readDemoProfile();
  if(p&&launchKey) launchKey.onclick=()=>switchView('rooms');

  // ---------- v33: original STUDYWORLD planet map restored ----------
  // The eight category planets are fixed around the center world again.
  // No drag, swipe, inertia, parallax, or carousel transforms are attached here.
  const originalWorld=$v('#view-home .world');
  if(originalWorld){
    originalWorld.classList.remove('is-orbit-dragging','is-carousel-dragging');
    originalWorld.querySelectorAll('img').forEach(img=>{img.draggable=false});
    originalWorld.querySelectorAll('.carousel-hint,.showcase-ring').forEach(el=>el.remove());
  }

  // ESC should also close the restored key modal.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&keyModal&&!keyModal.hidden){e.stopImmediatePropagation();closeKeyModal()}},true);
})();

// v42 — server-backed AI Intent + Context + Learning Engine
(function(){
  const DYN_STORAGE='studyworld.dynamic.space.v2';
  const ALLOWED_STUDY_TYPES=['coding','recall','brainstorm','reading'];
  const ALLOWED_LAYOUTS=['split_view','canvas','flashcard','focus_reader'];
  const ALLOWED_PERSONAS=['code_coach','recall_coach','reading_guide','brainstorm_partner'];
  const DYNAMIC_UI_PROTOCOL={
    study_type:ALLOWED_STUDY_TYPES,
    layout_mode:ALLOWED_LAYOUTS,
    active_tools:{code_editor:'boolean',terminal:'boolean',timer_type:'string|null',bgm_recommendation:'string|null'},
    ai_persona:{id:ALLOWED_PERSONAS,role:'server-defined string',system_prompt:'server-defined string'}
  };
  window.STUDYWORLD_DYNAMIC_UI_PROTOCOL=DYNAMIC_UI_PROTOCOL;

  let dynamicSpaceId='coding';
  let dynamicSchema=null;
  let dynamicContext={name:'',type:'',text:'',source:'',ephemeral:false,updatedAt:''};
  let transientCode='';
  let dynamicTimer={seconds:25*60,running:false,tick:null,startedAt:0};
  let engineSource='LOCAL SAFE FALLBACK';
  let canvasDrag=null;
  let lastAiMeta=null;
  let lastRoomModificationUsage=null;
  let roomModificationArmed=false;
  const DEFAULT_DYNAMIC_PLACEHOLDER='@AI 이 내용 기반으로 퀴즈 모드로 바꿔줘';
  const SAFE_CONTEXT_EXTENSIONS=new Set(['js','jsx','ts','tsx','py','json','csv','md','txt','pdf']);

  function defaultWorkspace(){return {code:`function solve(input) {\n  // 먼저 직접 시도해보세요.\n  return input;\n}\n`,reviewRequest:'',terminal:['$ ready · static check only'],flashIndex:0,flashRevealed:false,flashHintVisible:false,recallDraft:'',aiFlashcards:[],canvasNodes:[{id:'n1',x:110,y:150,text:'핵심 주제'},{id:'n2',x:390,y:90,text:'근거 / 예시'},{id:'n3',x:420,y:300,text:'반론 / 질문'}],aiNodeSuggestion:null,readerNotes:'',focusParagraph:0,aiSummary:null,aiParagraphExplain:null,aiCodeReview:null}}
  function sanitizeStoredEntry(entry){
    if(!entry||typeof entry!=='object')return entry;
    const context={...(entry.context||{})};delete context.text;
    const workspace={...(entry.workspace||{})};delete workspace.contextText;
    return {...entry,context:{...context,text:''},workspace};
  }
  function readDynamicStore(){
    try{
      const raw=JSON.parse(localStorage.getItem(DYN_STORAGE)||'{}');
      const safe={};Object.entries(raw||{}).forEach(([k,v])=>{safe[k]=sanitizeStoredEntry(v)});
      return safe;
    }catch(_e){return {}}
  }
  function writeDynamicStore(store){try{localStorage.setItem(DYN_STORAGE,JSON.stringify(store))}catch(_e){}}
  function stateStorageId(id=dynamicSpaceId){const profileId=readDemoProfile()?.id||'guest';return activeStudySpaceId?`profile:${profileId}:space:${activeStudySpaceId}`:`profile:${profileId}:template:${id}`}
  function getSpaceState(id=stateStorageId()){const store=readDynamicStore();return store[id]||{workspace:defaultWorkspace(),schema:null,context:{}}}
  let stateSyncTimer=null;
  function setSpaceState(patch,id=stateStorageId()){
    const store=readDynamicStore();const prev=store[id]||{workspace:defaultWorkspace(),schema:null,context:{}};
    const next={...prev,...patch,workspace:{...defaultWorkspace(),...(prev.workspace||{}),...(patch.workspace||{})}};
    next.context={...(next.context||{}),text:''};delete next.workspace.contextText;
    if(dynamicContext.ephemeral&&dynamicContext.source==='upload'){
      if(next.workspace.code===dynamicContext.text||transientCode)next.workspace.code='';
    }
    store[id]=next;writeDynamicStore(store);
    if(activeStudySpaceId){
      clearTimeout(stateSyncTimer);stateSyncTimer=setTimeout(()=>{
        const current=store[id];
        apiFetch(`${STUDYWORLD_SETTINGS.endpoints.studySpaces}/${encodeURIComponent(activeStudySpaceId)}/state`,{method:'PUT',body:JSON.stringify({schema:current.schema,context:current.context,workspace:current.workspace})}).catch(()=>{});
      },700);
    }
    return next;
  }

  function schemaForRoom(key){
    if(key==='coding')return {study_type:'coding',layout_mode:'split_view',active_tools:{code_editor:true,terminal:true,timer_type:null,bgm_recommendation:'lofi_cyber'},ai_persona:{id:'code_coach',role:'소크라테스식 코드 리뷰어',system_prompt:'정답을 먼저 주지 않고 시도·복잡도·테스트 관점에서 다음 한 단계를 묻습니다.'}};
    if(key==='paper')return {study_type:'reading',layout_mode:'focus_reader',active_tools:{code_editor:false,terminal:false,timer_type:null,bgm_recommendation:null},ai_persona:{id:'reading_guide',role:'근거 중심 리딩 튜터',system_prompt:'자료의 핵심 주장과 근거를 구분하고 필요한 범위만 짧게 설명합니다.'}};
    if(key==='exam'||key==='memory'||key==='language')return {study_type:'recall',layout_mode:'flashcard',active_tools:{code_editor:false,terminal:false,timer_type:'feynman_pomodoro',bgm_recommendation:null},ai_persona:{id:'recall_coach',role:'회상 훈련 코치',system_prompt:'정답을 먼저 보여주지 않고 회상 시도 뒤 단계적으로 피드백합니다.'}};
    return {study_type:'brainstorm',layout_mode:'canvas',active_tools:{code_editor:false,terminal:false,timer_type:null,bgm_recommendation:'quiet_focus'},ai_persona:{id:'brainstorm_partner',role:'사고 확장 코치',system_prompt:'기존 관점에서 빠진 질문·반론·검증 기준을 제안합니다.'}};
  }
  function normalizeSchema(raw,fallback){
    raw=raw&&typeof raw==='object'?raw:{};fallback=fallback||schemaForRoom(dynamicSpaceId);
    const study=ALLOWED_STUDY_TYPES.includes(raw.study_type)?raw.study_type:fallback.study_type;
    const layout=ALLOWED_LAYOUTS.includes(raw.layout_mode)?raw.layout_mode:fallback.layout_mode;
    const at=raw.active_tools&&typeof raw.active_tools==='object'?raw.active_tools:{};
    const ap=raw.ai_persona&&typeof raw.ai_persona==='object'?raw.ai_persona:{};
    return {study_type:study,layout_mode:layout,active_tools:{code_editor:Boolean(at.code_editor??fallback.active_tools.code_editor),terminal:Boolean(at.terminal??fallback.active_tools.terminal),timer_type:(typeof at.timer_type==='string'||at.timer_type===null)?at.timer_type:fallback.active_tools.timer_type,bgm_recommendation:(typeof at.bgm_recommendation==='string'||at.bgm_recommendation===null)?at.bgm_recommendation:fallback.active_tools.bgm_recommendation},ai_persona:{id:ALLOWED_PERSONAS.includes(ap.id)?ap.id:(fallback.ai_persona.id||'brainstorm_partner'),role:String(ap.role||fallback.ai_persona.role).slice(0,90),system_prompt:String(ap.system_prompt||fallback.ai_persona.system_prompt).slice(0,500)}};
  }
  function localIntentParser(prompt,context){
    const q=(prompt||'').toLowerCase();const ext=(context?.name||'').split('.').pop().toLowerCase();
    let mode='brainstorm';
    if(/^\/mode\s+(split|coding|code|split_view)/i.test(prompt)||/(코드|코딩|디버그|debug|review|리뷰|javascript|python|\.js|\.py)/i.test(q)||['js','jsx','ts','tsx','py','json','csv'].includes(ext))mode='coding';
    else if(/^\/mode\s+(flash|flashcard|recall|quiz)/i.test(prompt)||/(퀴즈|암기|회상|플래시|문제.*내|시험.*모드|빈칸)/i.test(q))mode='recall';
    else if(/^\/mode\s+(reader|reading|focus_reader)/i.test(prompt)||/(논문|독해|읽기|원문|pdf|문서.*요약|3줄 요약)/i.test(q)||ext==='pdf')mode='reading';
    else if(/^\/mode\s+(canvas|brainstorm)/i.test(prompt)||/(브레인스토밍|아이디어|기획|마인드맵|노드|캔버스)/i.test(q))mode='brainstorm';
    if(mode==='coding')return schemaForRoom('coding');if(mode==='recall')return schemaForRoom('memory');if(mode==='reading')return schemaForRoom('paper');return schemaForRoom('teach');
  }
  function contextExcerpt(limit=12000){return String(dynamicContext.text||'').slice(0,limit)}
  async function requestIntentSchema(prompt,{preview=false,roomModification=false}={}){
    const fallback=localIntentParser(prompt,dynamicContext);
    try{
      const result=await apiFetch(STUDYWORLD_SETTINGS.endpoints.studyIntent,{method:'POST',timeoutMs:STUDYWORLD_SETTINGS.aiRequestTimeoutMs,body:JSON.stringify({protocol_version:'1.1',spaceId:preview?null:(activeStudySpaceId||null),prompt,roomModification:Boolean(roomModification&&!preview&&activeStudySpaceId),context:{file_name:dynamicContext.name,file_type:dynamicContext.type,has_text:Boolean(dynamicContext.text),text:contextExcerpt()},current_schema:dynamicSchema})});
      lastAiMeta=result?.meta||null;lastRoomModificationUsage=result?.usage||null;engineSource=result?.meta?.fallback?'SAFE FALLBACK · AI UNAVAILABLE':`${String(result?.meta?.provider||'AI').toUpperCase()} · ${result?.meta?.model||'MODEL'}`;
      return normalizeSchema(result.schema||result,fallback);
    }catch(_error){lastAiMeta={fallback:true,errorCode:'NETWORK_OR_API'};lastRoomModificationUsage=null;engineSource='LOCAL SAFE FALLBACK';return normalizeSchema(fallback,fallback)}
  }

  function captureWorkspace(){
    if(!dynamicSchema)return;const current=getSpaceState().workspace;const patch={};
    if(dynamicSchema.layout_mode==='split_view'){if(!dynamicContext.ephemeral)patch.code=document.querySelector('#dynCodeEditor')?.value??current.code;patch.reviewRequest=document.querySelector('#dynReviewRequest')?.value??current.reviewRequest}
    if(dynamicSchema.layout_mode==='flashcard')patch.recallDraft=document.querySelector('#dynRecallDraft')?.value??current.recallDraft;
    if(dynamicSchema.layout_mode==='focus_reader'){patch.readerNotes=document.querySelector('#dynReaderNotes')?.value??current.readerNotes;const f=document.querySelector('.dyn-reader-paragraph.is-focused');if(f)patch.focusParagraph=Number(f.dataset.index||0)}
    setSpaceState({workspace:patch,schema:dynamicSchema,context:{name:dynamicContext.name,type:dynamicContext.type,source:dynamicContext.source,ephemeral:dynamicContext.ephemeral,updatedAt:dynamicContext.updatedAt}});
  }
  function escapeDyn(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function schemaLabel(s){return ({split_view:'Split View · 코드/데이터',flashcard:'Flashcard · 회상',canvas:'Canvas · 아이디어',focus_reader:'Focus Reader · 독해'})[s.layout_mode]||s.layout_mode}
  function updateProtocolUI(){
    const label=document.querySelector('#dynamicModeLabel');if(label)label.textContent=schemaLabel(dynamicSchema);
    const src=document.querySelector('#dynamicEngineSource');if(src)src.textContent=engineSource;
    const pre=document.querySelector('#dynamicSchemaJson');if(pre)pre.textContent=JSON.stringify({...dynamicSchema,_engine:lastAiMeta},null,2);
    const r=rooms[dynamicSpaceId]||rooms.teach;document.querySelector('#rtIcon').textContent=r.icon;document.querySelector('#rtTitle').textContent=r.title;document.querySelector('#rtSub').textContent='AI가 요청·자료 맥락·학습 패턴을 함께 보고 화면과 학습 도구를 정해진 프로토콜 안에서 재구성합니다.';
    document.querySelector('#rtChips').innerHTML=`<span class="meta-pill">${dynamicSchema.study_type}</span><span class="meta-pill">Layout · ${dynamicSchema.layout_mode}</span><span class="meta-pill">Persona · ${escapeDyn(dynamicSchema.ai_persona.role)}</span>`;
  }
  function toolbeltHTML(){
    const t=dynamicSchema.active_tools;let tools=[];if(t.code_editor)tools.push('<span class="dynamic-tool-chip">⌨️ Code editor</span>');if(t.terminal)tools.push('<span class="dynamic-tool-chip">▸ Static check</span>');if(t.timer_type)tools.push(`<span class="dynamic-tool-chip dynamic-timer">◷ <strong id="dynTimerValue">25:00</strong><button type="button" id="dynTimerToggle">시작</button></span>`);if(t.bgm_recommendation)tools.push(`<span class="dynamic-tool-chip">♫ <button type="button" id="dynBgmToggle">${escapeDyn(t.bgm_recommendation)}</button></span>`);return tools.join('')||'<span class="dynamic-tool-chip">필요한 도구만 활성화됨</span>';
  }
  function localFlashcards(){const ss=String(dynamicContext.text||'').replace(/\s+/g,' ').split(/(?<=[.!?。])\s+/).filter(s=>s.length>18).slice(0,5);return (ss.length?ss:['핵심 개념을 자신의 말로 설명해보세요.','가장 중요한 근거는 무엇인가요?','이 내용을 다른 상황에 어떻게 적용할까요?']).map((s,i)=>({question:`핵심 ${i+1}을 먼저 회상해보세요.`,answer:s.slice(0,220),hint:s.slice(0,60)}))}
  function activeFlashcards(work){return Array.isArray(work.aiFlashcards)&&work.aiFlashcards.length?work.aiFlashcards:localFlashcards()}
  function readerParagraphs(){const t=String(dynamicContext.text||'').trim();if(t){const arr=t.replace(/\r/g,'').split(/\n{2,}|(?<=[.!?。])\s+/).map(x=>x.trim()).filter(x=>x.length>25).slice(0,20);if(arr.length)return arr}return ['자료를 추가하면 이곳에서 실제 문단을 Focus Reader로 읽을 수 있어요.','문단을 선택한 뒤 AI에게 설명을 요청하면 선택한 부분을 근거 중심으로 풀어줍니다.','PDF는 서버에 저장하지 않고 AI 제공자에게 일시적으로 전달해 읽기용 텍스트를 추출합니다.']}

  function aiMetaLabel(meta){if(!meta)return '';if(meta.fallback)return '<span class="dyn-ai-source fallback">LOCAL FALLBACK</span>';return `<span class="dyn-ai-source">${escapeDyn(String(meta.provider||'AI').toUpperCase())} · ${escapeDyn(meta.model||'MODEL')}</span>`}
  function renderSplit(work){
    const code=transientCode||(dynamicContext.ephemeral&&dynamicContext.text?dynamicContext.text:(work.code||defaultWorkspace().code));
    const review=work.aiCodeReview;
    const reviewHtml=review?`<div class="dyn-ai-result"><strong>${escapeDyn(review.headline||'AI 코드 리뷰')}</strong><p>${escapeDyn(review.complexity||'')}</p>${(review.questions||[]).map(x=>`<div>Q · ${escapeDyn(x)}</div>`).join('')}${(review.hints||[]).map(x=>`<div>Hint · ${escapeDyn(x)}</div>`).join('')}${(review.risks||[]).map(x=>`<div>Risk · ${escapeDyn(x)}</div>`).join('')}</div>`:'';
    return `<div class="dyn-split"><section class="dyn-editor-pane"><div class="dyn-pane-bar"><strong>${escapeDyn(dynamicContext.name||'workspace.js')}</strong><span>EDITOR · SOURCE ${dynamicContext.ephemeral?'EPHEMERAL':'WORKSPACE'}</span></div><textarea class="dyn-code-editor" id="dynCodeEditor" spellcheck="false">${escapeDyn(code)}</textarea><div class="dyn-editor-actions"><button type="button" id="dynRunCode">✓ 빠른 정적 체크</button></div></section><aside class="dyn-side-pane"><div class="dyn-terminal" id="dynTerminal"><b>STATIC CHECK · 실제 실행 아님</b>${(work.terminal||[]).map(x=>`<div>${escapeDyn(x)}</div>`).join('')}</div><div class="dyn-reviewer"><h3>${escapeDyn(dynamicSchema.ai_persona.role)}</h3><p>${escapeDyn(dynamicSchema.ai_persona.system_prompt)}</p><textarea id="dynReviewRequest" placeholder="@AI 이 함수의 시간복잡도부터 질문해줘">${escapeDyn(work.reviewRequest||'')}</textarea><button type="button" id="dynAskReviewer">AI 리뷰 요청</button>${reviewHtml}</div></aside></div>`;
  }
  function renderFlash(work){
    const cards=activeFlashcards(work);const idx=Math.max(0,Math.min(Number(work.flashIndex||0),cards.length-1));const card=cards[idx];const revealed=Boolean(work.flashRevealed);const hintVisible=Boolean(work.flashHintVisible);const generated=Array.isArray(work.aiFlashcards)&&work.aiFlashcards.length>0;
    return `<div class="dyn-flash-layout"><main class="dyn-flash-main"><div class="dyn-flash-stack"><div class="dyn-flash-progress"><span>${generated?(lastAiMeta?.fallback?'안전 대체 회상 카드':'AI 회상 카드'):'로컬 미리보기 카드'} · ${idx+1}/${cards.length}</span><button type="button" id="dynRegenerateCards">✦ 자료로 다시 생성</button></div><button class="dyn-flash-card" id="dynFlashCard" type="button"><small>${revealed?'ANSWER':'RECALL FIRST'}</small><div><strong>${escapeDyn(revealed?card.answer:card.question)}</strong>${revealed?'<p>내 답과 비교하고 다음 카드를 평가해보세요.</p>':(hintVisible?`<p>힌트 · ${escapeDyn(card.hint||'핵심 용어부터 떠올려보세요.')}</p>`:'<p>답을 보기 전에 기억에서 먼저 꺼내보세요.</p>')}</div></button><input class="dyn-flash-answer" id="dynRecallDraft" value="${escapeDyn(work.recallDraft||'')}" placeholder="백지에 떠오르는 내용을 먼저 적어보세요"><div class="dyn-flash-buttons"><button type="button" id="dynFlashHint" ${revealed||hintVisible?'disabled':''}>힌트</button><button type="button" data-flash-grade="again">다시</button><button type="button" data-flash-grade="hard">어려움</button><button type="button" data-flash-grade="know">알겠음 →</button></div></div></main><aside class="dyn-recall-rail"><h3>${escapeDyn(dynamicSchema.ai_persona.role)}</h3><p>${work.aiFlashcards?.length?'AI가 현재 자료를 읽고 회상 카드를 생성했습니다.':'AI 생성 전에는 안전한 로컬 카드가 임시로 표시됩니다.'}</p><div class="dyn-recall-stat"><div><small>현재 카드</small><strong>${idx+1}</strong></div><div><small>총 카드</small><strong>${cards.length}</strong></div><div><small>자료 저장</small><strong>${dynamicContext.ephemeral?'NO':'N/A'}</strong></div></div></aside></div>`;
  }
  function renderCanvas(work){
    const nodes=(work.canvasNodes&&work.canvasNodes.length?work.canvasNodes:defaultWorkspace().canvasNodes);const idea=work.aiNodeSuggestion;
    return `<div class="dyn-canvas-layout"><section class="dyn-canvas-stage" id="dynCanvasStage"><svg class="dyn-node-lines" id="dynNodeLines" aria-hidden="true"></svg><div class="dyn-canvas-toolbar"><button type="button" id="dynAddNode">＋ 노드</button><button type="button" id="dynSuggestNode">✦ AI 노드 추천</button></div>${nodes.map(n=>`<div class="dyn-node-card" data-node-id="${escapeDyn(n.id)}" style="left:${Number(n.x)||80}px;top:${Number(n.y)||100}px"><small>IDEA NODE</small><div>${escapeDyn(n.text)}</div></div>`).join('')}</section><aside class="dyn-canvas-ai"><h3>${escapeDyn(dynamicSchema.ai_persona.role)}</h3><p>${escapeDyn(dynamicSchema.ai_persona.system_prompt)}</p><div class="dyn-ai-idea" id="dynAiIdea" data-idea="${escapeDyn(idea?.text||'')}">${idea?`<strong>${escapeDyn(idea.title)}</strong><p>${escapeDyn(idea.text)}</p><small>${escapeDyn(idea.rationale)}</small>`:'현재 노드와 자료를 보고 빠진 관점 하나를 실제 AI가 제안합니다.'}</div><button type="button" id="dynAcceptIdea" ${idea?'':'disabled'}>추천을 노드로 추가</button></aside></div>`;
  }
  function renderReader(work){
    const paras=readerParagraphs();const sums=work.aiSummary?.lines?.length?work.aiSummary.lines:[];const focus=Math.max(0,Math.min(Number(work.focusParagraph||0),paras.length-1));const explain=work.aiParagraphExplain;const summaryLabel=sums.length?(lastAiMeta?.fallback?'SAFE 3-LINE SUMMARY':'AI 3-LINE SUMMARY'):'3-LINE SUMMARY';
    return `<div class="dyn-reader-layout"><section class="dyn-reader-doc"><article class="dyn-reader-page is-focus" id="dynReaderPage"><h2>${escapeDyn(dynamicContext.name||'Focus Reader')}</h2><div class="dyn-reader-byline">SOURCE DOCUMENT · 문단을 누르면 포커스가 이동합니다. 업로드 원문은 STUDYWORLD DB에 저장하지 않습니다.</div>${paras.map((p,i)=>`<p class="dyn-reader-paragraph ${i===focus?'is-focused':''}" data-index="${i}">${escapeDyn(p)}</p>`).join('')}</article></section><aside class="dyn-reader-rail"><div class="dynamic-mode-meta" style="margin-bottom:14px"><span class="dynamic-live-dot"></span><div><small>${summaryLabel}</small><strong>${escapeDyn(dynamicSchema.ai_persona.role)}</strong></div></div><div class="dyn-reader-actions"><button type="button" id="dynRefreshSummary">✦ AI 3줄 요약</button><button type="button" id="dynExplainParagraph">선택 문단 설명</button></div>${sums.length?sums.map((s,i)=>`<div class="dyn-summary-pin"><small>PIN ${i+1}</small><p>${escapeDyn(s)}</p></div>`).join(''):'<div class="dyn-summary-empty">아직 AI 요약을 생성하지 않았습니다. 자료를 추가한 뒤 ‘AI 3줄 요약’을 눌러주세요.</div>'}${explain?`<div class="dyn-ai-result reader"><strong>선택 문단 AI 설명</strong><p>${escapeDyn(explain.explanation||'')}</p><div>근거 · ${escapeDyn(explain.evidence||'')}</div><div>확인 질문 · ${escapeDyn(explain.check_question||'')}</div></div>`:''}<textarea class="dyn-reader-notes" id="dynReaderNotes" placeholder="읽으면서 남길 나의 노트">${escapeDyn(work.readerNotes||'')}</textarea></aside></div>`;
  }
  function renderDynamicLayout(){const stateNow=getSpaceState();const work={...defaultWorkspace(),...(stateNow.workspace||{})};const frame=document.querySelector('#runtimeArea');if(!frame)return;const body=dynamicSchema.layout_mode==='split_view'?renderSplit(work):dynamicSchema.layout_mode==='flashcard'?renderFlash(work):dynamicSchema.layout_mode==='canvas'?renderCanvas(work):renderReader(work);frame.innerHTML=`<div class="dynamic-space-shell"><div class="dynamic-space-topline"><section class="dynamic-persona-card"><div class="dynamic-persona-orb">✦</div><div class="dynamic-persona-copy"><small>ACTIVE AI PERSONA</small><strong>${escapeDyn(dynamicSchema.ai_persona.role)}</strong><span>${escapeDyn(dynamicSchema.ai_persona.system_prompt)}</span></div>${aiMetaLabel(lastAiMeta)}</section><div class="dynamic-toolbelt">${toolbeltHTML()}</div></div><section class="dynamic-layout-frame">${body}</section></div>`;bindDynamicLayout(work);updateTimerUI()}

  function drawCanvasLines(){const stage=document.querySelector('#dynCanvasStage'),svg=document.querySelector('#dynNodeLines');if(!stage||!svg)return;const cards=[...stage.querySelectorAll('.dyn-node-card')];const sr=stage.getBoundingClientRect();svg.innerHTML='';for(let i=0;i<cards.length-1;i++){const a=cards[i].getBoundingClientRect(),b=cards[i+1].getBoundingClientRect();const x1=a.left-sr.left+a.width/2,y1=a.top-sr.top+a.height/2,x2=b.left-sr.left+b.width/2,y2=b.top-sr.top+b.height/2;svg.insertAdjacentHTML('beforeend',`<path d="M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}" fill="none" stroke="rgba(72,111,91,.42)" stroke-width="2" stroke-dasharray="6 6"/>`)}}
  function saveCanvasPositions(){const cards=[...document.querySelectorAll('.dyn-node-card')];if(!cards.length)return;const nodes=cards.map(c=>({id:c.dataset.nodeId,x:parseFloat(c.style.left)||0,y:parseFloat(c.style.top)||0,text:c.querySelector('div')?.textContent||'아이디어'}));setSpaceState({workspace:{canvasNodes:nodes}})}
  function bindCanvasDrag(){const stage=document.querySelector('#dynCanvasStage');if(!stage)return;stage.querySelectorAll('.dyn-node-card').forEach(card=>{card.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const r=card.getBoundingClientRect(),sr=stage.getBoundingClientRect();canvasDrag={card,stage,offsetX:e.clientX-r.left,offsetY:e.clientY-r.top,sr};card.setPointerCapture?.(e.pointerId);e.preventDefault()});card.addEventListener('pointermove',e=>{if(!canvasDrag||canvasDrag.card!==card)return;const maxX=stage.clientWidth-card.offsetWidth,maxY=stage.clientHeight-card.offsetHeight;card.style.left=Math.max(0,Math.min(maxX,e.clientX-canvasDrag.sr.left-canvasDrag.offsetX))+'px';card.style.top=Math.max(0,Math.min(maxY,e.clientY-canvasDrag.sr.top-canvasDrag.offsetY))+'px';drawCanvasLines();e.preventDefault()});card.addEventListener('pointerup',()=>{if(canvasDrag?.card===card){canvasDrag=null;saveCanvasPositions()}})});requestAnimationFrame(drawCanvasLines)}

  function currentNodes(){return [...document.querySelectorAll('.dyn-node-card')].map(n=>({text:n.querySelector('div')?.textContent||''}))}
  async function recordLearningEvent(eventType,{mode=dynamicSchema?.study_type||'',durationSeconds=0,metadata={}}={}){if(!readDemoProfile())return;try{await apiFetch(STUDYWORLD_SETTINGS.endpoints.learningEvents,{method:'POST',body:JSON.stringify({eventType,mode,durationSeconds,metadata})})}catch(_e){}}
  async function requestAiAction(action,{prompt='',selectedText=''}={}){
    const stateNow=getSpaceState();const code=document.querySelector('#dynCodeEditor')?.value||transientCode||stateNow.workspace.code||'';
    const payload={spaceId:activeStudySpaceId||null,action,personaId:dynamicSchema.ai_persona.id,prompt,selectedText,context:{name:dynamicContext.name,type:dynamicContext.type,text:contextExcerpt(24000)},workspace:{code,nodes:currentNodes()}};
    const result=await apiFetch(STUDYWORLD_SETTINGS.endpoints.studyActions,{method:'POST',timeoutMs:STUDYWORLD_SETTINGS.aiRequestTimeoutMs,body:JSON.stringify(payload)});lastAiMeta=result?.meta||null;await recordLearningEvent('ai_action',{metadata:{action,source:result?.meta?.fallback?'fallback':'ai'}});return result;
  }
  async function withButtonBusy(button,fn){if(!button)return fn();const old=button.textContent;button.disabled=true;button.textContent='AI 처리 중…';try{return await fn()}finally{button.disabled=false;button.textContent=old}}
  async function generateFlashcards(button){if(!dynamicContext.text){showToast('먼저 학습 자료를 추가해 주세요.');return}await withButtonBusy(button,async()=>{const r=await requestAiAction('flashcards',{prompt:'현재 자료로 회상형 플래시카드를 만들어줘'});setSpaceState({workspace:{aiFlashcards:r.data.cards,flashIndex:0,flashRevealed:false,flashHintVisible:false,recallDraft:''}});renderDynamicLayout();showToast(r.meta?.fallback?'AI 연결이 불안정해 안전한 로컬 카드로 계속합니다.':'현재 자료를 읽어 AI 플래시카드를 만들었어요.')})}
  async function generateSummary(button){if(!dynamicContext.text){showToast('먼저 읽을 자료를 추가해 주세요.');return}await withButtonBusy(button,async()=>{const r=await requestAiAction('summary',{prompt:'현재 자료를 정확히 3줄로 요약해줘'});setSpaceState({workspace:{aiSummary:r.data}});renderDynamicLayout();showToast(r.meta?.fallback?'로컬 요약으로 계속합니다.':'자료를 읽고 AI 3줄 요약을 만들었어요.')})}
  async function explainFocusedParagraph(button){const paras=readerParagraphs(),idx=Number(getSpaceState().workspace.focusParagraph||0),selected=paras[Math.max(0,Math.min(idx,paras.length-1))]||'';await withButtonBusy(button,async()=>{const r=await requestAiAction('paragraph_explain',{prompt:'선택한 문단을 근거 중심으로 쉽게 설명해줘',selectedText:selected});setSpaceState({workspace:{aiParagraphExplain:r.data}});renderDynamicLayout()})}
  async function suggestNode(button){await withButtonBusy(button,async()=>{const r=await requestAiAction('node_suggestion',{prompt:'현재 노드에서 빠진 관점 하나를 추천해줘'});setSpaceState({workspace:{aiNodeSuggestion:r.data}});renderDynamicLayout()})}
  async function reviewCode(button,work){const req=document.querySelector('#dynReviewRequest')?.value||'';if(!document.querySelector('#dynCodeEditor')?.value.trim()){showToast('리뷰할 코드를 먼저 입력해 주세요.');return}await withButtonBusy(button,async()=>{const r=await requestAiAction('code_review',{prompt:req||'이 코드를 질문과 힌트 중심으로 리뷰해줘'});setSpaceState({workspace:{reviewRequest:req,aiCodeReview:r.data,...(!dynamicContext.ephemeral?{code:document.querySelector('#dynCodeEditor')?.value||work.code}:{})}});renderDynamicLayout()})}

  function bindDynamicLayout(work){
    document.querySelector('#dynRunCode')?.addEventListener('click',()=>{const code=document.querySelector('#dynCodeEditor')?.value||'';const checks=[];checks.push(code.trim()?'✓ 코드 텍스트 감지':'! 코드가 비어 있음');checks.push(/[{}()]/.test(code)?'✓ 기본 구문 기호 감지':'! 구문 구조를 확인해보세요');checks.push(/return\b/.test(code)?'✓ return 키워드 감지':'· return 키워드 없음');if(!dynamicContext.ephemeral)setSpaceState({workspace:{code,terminal:['$ static-check',...checks]}});const terminal=document.querySelector('#dynTerminal');if(terminal)terminal.innerHTML=`<b>STATIC CHECK · 실제 실행 아님</b>${checks.map(x=>`<div>${escapeDyn(x)}</div>`).join('')}`;recordLearningEvent('tool_used',{metadata:{action:'static_check'}})});
    document.querySelector('#dynAskReviewer')?.addEventListener('click',e=>reviewCode(e.currentTarget,work).catch(err=>showToast(err?.message||'AI 코드 리뷰를 처리하지 못했어요.')));
    document.querySelector('#dynRegenerateCards')?.addEventListener('click',e=>generateFlashcards(e.currentTarget).catch(err=>showToast(err?.message||'AI 카드를 만들지 못했어요.')));
    document.querySelector('#dynFlashCard')?.addEventListener('click',()=>{const s=getSpaceState(),w=s.workspace;const draft=document.querySelector('#dynRecallDraft')?.value||'';const revealing=!w.flashRevealed;if(revealing)recordLearningEvent('tool_used',{mode:'recall',metadata:{action:'answer_reveal',attempted:Boolean(draft.trim()),hintUsed:Boolean(w.flashHintVisible)}});setSpaceState({workspace:{flashRevealed:!w.flashRevealed,recallDraft:draft}});renderDynamicLayout()});
    document.querySelector('#dynFlashHint')?.addEventListener('click',()=>{const w=getSpaceState().workspace;if(w.flashRevealed||w.flashHintVisible)return;setSpaceState({workspace:{flashHintVisible:true,recallDraft:document.querySelector('#dynRecallDraft')?.value||''}});recordLearningEvent('tool_used',{mode:'recall',metadata:{action:'hint'}});renderDynamicLayout()});
    document.querySelectorAll('[data-flash-grade]').forEach(b=>b.addEventListener('click',()=>{const cards=activeFlashcards(getSpaceState().workspace);const w=getSpaceState().workspace;const draft=document.querySelector('#dynRecallDraft')?.value||w.recallDraft||'';let next=(Number(w.flashIndex||0)+1)%cards.length;if(b.dataset.flashGrade==='again')next=Number(w.flashIndex||0);setSpaceState({workspace:{flashIndex:next,flashRevealed:false,flashHintVisible:false,recallDraft:''}});recordLearningEvent('flash_grade',{mode:'recall',metadata:{grade:b.dataset.flashGrade,attempted:Boolean(draft.trim()),hintUsed:Boolean(w.flashHintVisible)}});renderDynamicLayout()}));
    bindCanvasDrag();
    document.querySelector('#dynAddNode')?.addEventListener('click',()=>{const w=getSpaceState().workspace,arr=[...(w.canvasNodes||[])];arr.push({id:'n'+Date.now(),x:80+(arr.length%3)*205,y:380-(arr.length%2)*110,text:'새 아이디어'});setSpaceState({workspace:{canvasNodes:arr}});renderDynamicLayout()});
    document.querySelector('#dynSuggestNode')?.addEventListener('click',e=>suggestNode(e.currentTarget).catch(err=>showToast(err?.message||'AI 노드 추천을 처리하지 못했어요.')));
    document.querySelector('#dynAcceptIdea')?.addEventListener('click',()=>{const w=getSpaceState().workspace,arr=[...(w.canvasNodes||[])],idea=w.aiNodeSuggestion?.text;if(!idea)return;arr.push({id:'n'+Date.now(),x:170+(arr.length%2)*260,y:420,text:idea});setSpaceState({workspace:{canvasNodes:arr,aiNodeSuggestion:null}});recordLearningEvent('recommendation_accepted',{mode:'brainstorm',metadata:{source:'ai_node'}});renderDynamicLayout()});
    document.querySelectorAll('.dyn-reader-paragraph').forEach(p=>p.addEventListener('click',()=>{const page=document.querySelector('#dynReaderPage');page?.classList.add('is-focus');document.querySelectorAll('.dyn-reader-paragraph').forEach(x=>x.classList.toggle('is-focused',x===p));setSpaceState({workspace:{focusParagraph:Number(p.dataset.index||0),readerNotes:document.querySelector('#dynReaderNotes')?.value||''}})}));
    document.querySelector('#dynRefreshSummary')?.addEventListener('click',e=>generateSummary(e.currentTarget).catch(err=>showToast(err?.message||'AI 요약을 처리하지 못했어요.')));
    document.querySelector('#dynExplainParagraph')?.addEventListener('click',e=>explainFocusedParagraph(e.currentTarget).catch(err=>showToast(err?.message||'문단 설명을 처리하지 못했어요.')));
    document.querySelector('#dynReaderNotes')?.addEventListener('input',e=>setSpaceState({workspace:{readerNotes:e.target.value}}));
    document.querySelector('#dynCodeEditor')?.addEventListener('input',e=>{if(dynamicContext.ephemeral)transientCode=e.target.value;else setSpaceState({workspace:{code:e.target.value}})});
    document.querySelector('#dynRecallDraft')?.addEventListener('input',e=>setSpaceState({workspace:{recallDraft:e.target.value}}));
    document.querySelector('#dynTimerToggle')?.addEventListener('click',toggleDynamicTimer);
    document.querySelector('#dynBgmToggle')?.addEventListener('click',e=>{e.currentTarget.classList.toggle('active');const active=e.currentTarget.classList.contains('active');if(active)recordLearningEvent('tool_used',{metadata:{action:'bgm'}});showToast(active?'집중 BGM 추천을 켰어요. (오디오 연결 전)':'BGM 추천을 껐어요.')});
  }

  function updateTimerUI(){const el=document.querySelector('#dynTimerValue'),btn=document.querySelector('#dynTimerToggle');if(el){const m=Math.floor(dynamicTimer.seconds/60),s=dynamicTimer.seconds%60;el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}if(btn)btn.textContent=dynamicTimer.running?'정지':'시작'}
  function toggleDynamicTimer(){dynamicTimer.running=!dynamicTimer.running;if(dynamicTimer.tick)clearInterval(dynamicTimer.tick);if(dynamicTimer.running){recordLearningEvent('tool_used',{metadata:{action:'timer'}});dynamicTimer.startedAt=Date.now();dynamicTimer.tick=setInterval(()=>{dynamicTimer.seconds=Math.max(0,dynamicTimer.seconds-1);updateTimerUI();if(dynamicTimer.seconds<=0){clearInterval(dynamicTimer.tick);dynamicTimer.running=false;recordLearningEvent('session_completed',{durationSeconds:25*60});showToast('포커스 세션이 끝났어요.')}} ,1000)}updateTimerUI()}

  async function ensureAiMaterialForLayout(){const work=getSpaceState().workspace;if(!dynamicContext.text)return;try{if(dynamicSchema.layout_mode==='flashcard'&&!work.aiFlashcards?.length)await generateFlashcards(null);if(dynamicSchema.layout_mode==='focus_reader'&&!work.aiSummary?.lines?.length)await generateSummary(null)}catch(_e){}}
  async function applyIntent(prompt,{silent=false,recommendationAccepted=false,roomModification=false}={}){
    const q=(prompt||'').trim();if(!q)return;captureWorkspace();const form=document.querySelector('#dynamicCommandForm');form?.classList.add('is-loading');const input=document.querySelector('#dynamicCommandInput');if(input)input.disabled=true;
    try{const previousMode=dynamicSchema?.study_type||'';const next=await requestIntentSchema(q,{roomModification});dynamicSchema=next;setSpaceState({schema:next,context:{name:dynamicContext.name,type:dynamicContext.type,source:dynamicContext.source,ephemeral:dynamicContext.ephemeral,updatedAt:dynamicContext.updatedAt}});updateProtocolUI();renderDynamicLayout();const eventType=recommendationAccepted?'recommendation_accepted':(previousMode&&previousMode!==next.study_type?'mode_switched':'mode_selected');recordLearningEvent(eventType,{mode:next.study_type,metadata:{source:lastAiMeta?.fallback?'fallback':'ai'}});await ensureAiMaterialForLayout();if(!silent){const quota=lastRoomModificationUsage?` · 룸 수정 ${lastRoomModificationUsage.remaining}회 남음`:'';showToast(`${schemaLabel(next)}로 학습 공간을 재구성했어요.${quota}`)}}catch(error){showToast(error?.message||'학습 공간 수정 요청을 처리하지 못했어요.')}finally{form?.classList.remove('is-loading');roomModificationArmed=false;if(input){input.disabled=false;input.value='';input.placeholder=DEFAULT_DYNAMIC_PLACEHOLDER;input.focus()}}
  }
  function contextSuggestionFor(file){const ext=file.name.split('.').pop().toLowerCase();if(['js','jsx','ts','tsx','py','json','csv'].includes(ext))return {label:`${file.name} 분석 완료 · AI가 추천 모드를 판단하고 있어요.`,prompt:'업로드한 코드/데이터를 기준으로 가장 적합한 학습 모드를 추천해줘'};if(ext==='pdf'||['md','txt'].includes(ext))return {label:`${file.name} 분석 완료 · AI가 읽기/회상 중 적합한 모드를 추천하고 있어요.`,prompt:'업로드한 문서를 기준으로 가장 적합한 학습 모드를 추천해줘'};return {label:`${file.name}을 현재 학습 컨텍스트에 연결했어요.`,prompt:'이 자료에 가장 맞는 학습 모드를 추천해줘'}}
  async function loadPdfContext(file){const form=new FormData();form.append('file',file);if(activeStudySpaceId)form.append('spaceId',activeStudySpaceId);const result=await apiFetch(STUDYWORLD_SETTINGS.endpoints.studyPdfContext,{method:'POST',timeoutMs:60000,body:form});lastAiMeta=result.meta||null;return {name:result.title||file.name,type:'application/pdf',text:String(result.text||'').slice(0,24000),source:'upload',ephemeral:true,updatedAt:new Date().toISOString()}}
  async function handleContextFile(file){
    if(!file)return;const box=document.querySelector('#dynamicContextSuggestion');if(box){box.hidden=false;box.innerHTML='<span>자료를 안전하게 읽는 중… STUDYWORLD DB에는 원문을 저장하지 않으며, AI 분석에 필요한 범위는 설정된 AI 제공자에 일시 전송됩니다.</span>'}
    try{
      const ext=file.name.split('.').pop().toLowerCase();if(!SAFE_CONTEXT_EXTENSIONS.has(ext))throw new Error('지원하는 학습자료 형식이 아니에요.');let nextContext;
      if(ext==='pdf'){nextContext=await loadPdfContext(file)}else{if(file.size>2.5*1024*1024)throw new Error('텍스트/코드 자료는 2.5MB 이하만 임시로 읽을 수 있어요.');const text=await file.text();if(/\u0000/.test(text.slice(0,4096)))throw new Error('텍스트 파일로 읽을 수 없는 바이너리 자료예요.');nextContext={name:file.name,type:file.type||ext,text:text.slice(0,24000),source:'upload',ephemeral:true,updatedAt:new Date().toISOString()}}
      dynamicContext=nextContext;transientCode=['js','jsx','ts','tsx','py','json','csv'].includes(ext)?dynamicContext.text:'';setSpaceState({context:{name:dynamicContext.name,type:dynamicContext.type,source:'upload',ephemeral:true,updatedAt:dynamicContext.updatedAt},workspace:{aiFlashcards:[],aiSummary:null,aiParagraphExplain:null,aiCodeReview:null,aiNodeSuggestion:null}});
      const s=contextSuggestionFor(file);if(box){box.innerHTML=`<span>${escapeDyn(s.label)}</span><button type="button">AI 추천 모드 적용</button>`;box.querySelector('button').onclick=()=>{box.hidden=true;applyIntent(s.prompt,{recommendationAccepted:true})}}
      const suggested=await requestIntentSchema(s.prompt,{preview:true});const label=schemaLabel(suggested);if(box){box.querySelector('span').textContent=`${file.name} · AI 추천: ${label}`;box.dataset.recommendedPrompt=s.prompt}showToast('자료를 임시 컨텍스트로 연결했어요. 원문은 STUDYWORLD DB에 저장하지 않지만 AI 기능 사용 시 설정된 AI 제공자에 필요한 범위가 전달됩니다.');
    }catch(error){if(box){box.innerHTML=`<span>${escapeDyn(error?.message||'자료를 읽지 못했어요.')}</span>`}showToast(error?.message||'자료를 읽지 못했어요.')}
  }

  async function refreshPreferencePanel(){const panel=document.querySelector('#dynamicPreferencePanel');if(!panel||!readDemoProfile())return;panel.innerHTML='<span>학습 패턴을 불러오는 중…</span>';try{const p=await apiFetch(STUDYWORLD_SETTINGS.endpoints.learningPreferences);const labels=p.labels||[];const confidence=({early:'탐색 중',forming:'형성 중',established:'비교적 안정적'})[p.confidence]||'탐색 중';panel.innerHTML=`<strong>나의 학습 패턴 · ${confidence}</strong><span>${labels.length?labels.map(escapeDyn).join(' · '):'아직 데이터가 적어요. 여러 학습 방식을 경험하면 여기에 패턴이 생깁니다.'}</span><small>표본 ${Number(p.sampleCount||0)}회 · 답 보기 전 시도 ${Number(p.attemptBeforeAnswerCount||0)}회 · 힌트 ${Number(p.toolUse?.hint||0)}회 · AI 추천 수락 ${Number(p.recommendationAcceptCount||0)}회</small><small>학습 원문·질문 본문은 선호 프로필에 저장하지 않습니다.</small>`}catch(_e){panel.innerHTML='<span>학습 패턴을 불러오지 못했어요.</span>'}}
  function mountEngineControls(){
    const dock=document.querySelector('#dynamicCommandDock');if(dock)dock.hidden=false;
    document.querySelector('#dynamicCommandForm')?.addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#dynamicCommandInput');const v=input?.value.trim();if(v){const modify=roomModificationArmed;roomModificationArmed=false;applyIntent(v,{roomModification:modify})}});
    document.querySelector('#dynamicSchemaToggle')?.addEventListener('click',()=>{const p=document.querySelector('#dynamicSchemaPanel');if(p)p.hidden=!p.hidden});
    document.querySelector('#dynamicContextFile')?.addEventListener('change',e=>{roomModificationArmed=false;const input=document.querySelector('#dynamicCommandInput');if(input)input.placeholder=DEFAULT_DYNAMIC_PLACEHOLDER;const f=e.target.files?.[0];handleContextFile(f);e.target.value=''});
    document.querySelector('#dynamicPreferenceToggle')?.addEventListener('click',()=>{const p=document.querySelector('#dynamicPreferencePanel');if(!p)return;p.hidden=!p.hidden;if(!p.hidden)refreshPreferencePanel()});
    document.querySelector('#modifyRoom')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();roomModificationArmed=true;const input=document.querySelector('#dynamicCommandInput');if(input){input.value='@AI ';input.placeholder='룸 구조/기능 수정 요청 · 별도 사용량이 적용됩니다';input.focus()}showToast('다음 요청은 룸 수정 사용량으로 계산됩니다.')},true);
  }
  mountEngineControls();

  openRoom=function(key,spaceId=null){
    if(!rooms[key])key='teach';captureWorkspace();roomModificationArmed=false;lastRoomModificationUsage=null;const commandInput=document.querySelector('#dynamicCommandInput');if(commandInput){commandInput.placeholder=DEFAULT_DYNAMIC_PLACEHOLDER;commandInput.value=''}if(spaceId)activeStudySpaceId=spaceId;dynamicSpaceId=key;state.currentRoom=key;transientCode='';dynamicContext={name:'',type:'',text:'',source:'',ephemeral:false,updatedAt:''};if(typeof saveDemoSession==='function')saveDemoSession({currentRoom:key,lastView:'runtime',activeStudySpaceId:activeStudySpaceId||null});
    const saved=getSpaceState();const savedContext=saved.context||{};dynamicContext={...dynamicContext,...savedContext,text:''};dynamicSchema=normalizeSchema(saved.schema||schemaForRoom(key),schemaForRoom(key));engineSource=saved.schema?'SAVED DYNAMIC SCHEMA':'ROOM SEED → DYNAMIC SCHEMA';
    document.body.dataset.runtimeRoom='dynamic';document.querySelector('#dynamicCommandDock').hidden=false;updateProtocolUI();renderDynamicLayout();switchView('runtime');
    if(activeStudySpaceId){apiFetch(`${STUDYWORLD_SETTINGS.endpoints.studySpaces}/${encodeURIComponent(activeStudySpaceId)}/state`).then(remote=>{if(!remote||(!remote.schema&&!remote.context&&!remote.workspace))return;const id=stateStorageId();const store=readDynamicStore();store[id]=sanitizeStoredEntry({schema:remote.schema||dynamicSchema,context:remote.context||dynamicContext,workspace:{...defaultWorkspace(),...(remote.workspace||{})}});writeDynamicStore(store);dynamicContext={...dynamicContext,...(store[id].context||{}),text:''};dynamicSchema=normalizeSchema(store[id].schema||schemaForRoom(key),schemaForRoom(key));engineSource='CLOUDFLARE D1 · SYNCED';updateProtocolUI();renderDynamicLayout()}).catch(()=>{})}
  };
  window.openRoom=openRoom;
  window.studyworldDynamicEngine={protocol:DYNAMIC_UI_PROTOCOL,applyIntent,getSchema:()=>dynamicSchema,getContext:()=>({...dynamicContext,text:dynamicContext.text?'[ephemeral source loaded]':''}),openSpace:openRoom};
})();


/* v36 firefly pointer engine — render work is isolated to rAF. */
(()=>{
  const coarse=window.matchMedia('(pointer: coarse)').matches;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(coarse||reduced)return;

  const canvas=document.createElement('canvas');
  canvas.className='firefly-cursor-canvas';
  canvas.setAttribute('aria-hidden','true');
  const core=document.createElement('div');
  core.className='firefly-cursor-core';
  core.setAttribute('aria-hidden','true');
  document.body.append(canvas,core);
  document.documentElement.classList.add('firefly-cursor-enabled');

  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  let width=0,height=0,dpr=1,resizeRAF=0;
  const mouse={x:-100,y:-100,visible:false,hover:false,text:false,moved:false};
  let renderedX=-100,renderedY=-100,lastParticleX=-100,lastParticleY=-100;
  let particles=[];
  let lastTime=performance.now();
  let raf=0;
  let running=false;
  const MAX_PARTICLES=110;
  function ensureRunning(){if(running||document.hidden)return;running=true;lastTime=performance.now();raf=requestAnimationFrame(frame)}

  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    width=window.innerWidth;height=window.innerHeight;
    canvas.width=Math.max(1,Math.round(width*dpr));
    canvas.height=Math.max(1,Math.round(height*dpr));
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function queueResize(){
    if(resizeRAF)return;
    resizeRAF=requestAnimationFrame(()=>{resizeRAF=0;resize()});
  }
  resize();
  window.addEventListener('resize',queueResize,{passive:true});

  const textSelector='input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"],.monaco-editor,.dyn-code-editor';
  const hoverSelector='a,button,[role="button"],.clickable,.planet-node,.discovery-planet,.community-post-card,.dyn-node-card';
  function classify(target){
    if(!(target instanceof Element)){mouse.text=false;mouse.hover=false;return}
    mouse.text=Boolean(target.closest(textSelector));
    mouse.hover=!mouse.text&&Boolean(target.closest(hoverSelector));
  }
  window.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    mouse.x=e.clientX;mouse.y=e.clientY;mouse.visible=true;mouse.moved=true;
    classify(e.target);ensureRunning();
  },{passive:true});
  document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')classify(e.target)},{passive:true});
  document.addEventListener('pointerout',e=>{if(e.pointerType!=='touch'&&e.relatedTarget)classify(e.relatedTarget)},{passive:true});
  document.documentElement.addEventListener('mouseleave',()=>{mouse.visible=false;ensureRunning()},{passive:true});
  document.documentElement.addEventListener('mouseenter',()=>{mouse.visible=true;ensureRunning()},{passive:true});

  function spawnParticle(x,y,speed){
    if(particles.length>=MAX_PARTICLES)particles.splice(0,particles.length-MAX_PARTICLES+1);
    const life=0.34+Math.random()*0.28;
    particles.push({
      x:x+(Math.random()-.5)*4,
      y:y+(Math.random()-.5)*4,
      size:0.8+Math.random()*2.2,
      life,maxLife:life,
      vx:(Math.random()-.5)*(18+speed*.08),
      vy:-8-Math.random()*18+(Math.random()-.5)*speed*.05
    });
  }
  function drawParticle(p){
    const alpha=Math.max(0,p.life/p.maxLife);
    ctx.save();
    ctx.globalAlpha=alpha*0.9;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fillStyle=alpha>.55?'#E2F58B':'#D4FC79';
    ctx.shadowColor='#96E6A1';ctx.shadowBlur=4+p.size*1.8;
    ctx.fill();ctx.restore();
  }
  function drawGlow(x,y,hover){
    const radius=hover?20:12;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0,hover?'rgba(255,255,255,.96)':'rgba(226,245,139,.76)');
    gradient.addColorStop(.34,hover?'rgba(255,235,59,.46)':'rgba(188,242,70,.38)');
    gradient.addColorStop(1,'rgba(155,224,42,0)');
    ctx.save();ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function frame(now){
    if(!running)return;
    const dt=Math.min(.034,Math.max(.001,(now-lastTime)/1000));lastTime=now;
    ctx.clearRect(0,0,width,height);

    if(mouse.visible&&!mouse.text){
      renderedX=mouse.x;renderedY=mouse.y;
      core.style.opacity='1';
      core.classList.toggle('is-hovering',mouse.hover);
      const scale=mouse.hover?1.45:1;
      core.style.transform=`translate3d(${renderedX}px,${renderedY}px,0) scale(${scale})`;
      drawGlow(renderedX,renderedY,mouse.hover);

      if(mouse.moved){
        const dx=renderedX-lastParticleX,dy=renderedY-lastParticleY;
        const dist=Math.hypot(dx,dy);
        const speed=dist/Math.max(dt,0.001);
        if(dist>3){
          const count=Math.min(3,1+Math.floor(dist/24));
          const chance=mouse.hover?.72:.48;
          for(let i=0;i<count;i++)if(Math.random()<chance)spawnParticle(renderedX,renderedY,speed);
          lastParticleX=renderedX;lastParticleY=renderedY;
        }
        mouse.moved=false;
      }
    }else{
      core.style.opacity='0';
      if(mouse.visible){lastParticleX=mouse.x;lastParticleY=mouse.y}
    }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=4*dt;p.life-=dt;
      if(p.life<=0){particles.splice(i,1);continue}
      drawParticle(p);
    }
    if((mouse.visible&&!mouse.text)||particles.length){raf=requestAnimationFrame(frame)}else{running=false;raf=0;ctx.clearRect(0,0,width,height)}
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){running=false;cancelAnimationFrame(raf);raf=0;particles.length=0;ctx.clearRect(0,0,width,height);core.style.opacity='0'}
    else if(mouse.visible||particles.length)ensureRunning();
  });
})();
window.addEventListener('DOMContentLoaded',()=>{const el=$('#todayDateLabel');if(el){const d=new Date();el.textContent=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}});
window.addEventListener('DOMContentLoaded',async()=>{const local=readDemoProfile();if(local){try{const session=await apiFetch(STUDYWORLD_SETTINGS.endpoints.session);if(!session?.authenticated){localStorage.removeItem(DEMO_PROFILE_KEY);localStorage.removeItem(DEMO_SESSION_KEY);updateDemoLaunchUI();return}const server=session.profile||{};const merged={...local,id:server.id||local.id,nickname:server.nickname||local.nickname,role:server.role||local.role||'user',accountOrigin:server.accountOrigin||local.accountOrigin||'member',publicCode:server.publicCode||local.publicCode||'',planetImageUrl:server.planetImageUrl||local.planetImageUrl||null,maskedPlanetKey:maskPlanetKey()};localStorage.setItem(DEMO_PROFILE_KEY,JSON.stringify(merged));updateDemoLaunchUI();await refreshMyStudySpaces()}catch(_e){}}});
