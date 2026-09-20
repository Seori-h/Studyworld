import { RESERVED_NICKNAMES } from '../config.js';
import { HttpError } from './http.js';
export function normalizeNickname(value='') { return String(value).normalize('NFKC').trim().replace(/\s+/g,' '); }
export function nicknameKey(value='') { return normalizeNickname(value).toLocaleLowerCase('ko-KR'); }
export function validateNickname(value='') { const nickname=normalizeNickname(value); const length=[...nickname].length; if(length<2||length>16)throw new HttpError(400,'INVALID_NICKNAME','닉네임은 2~16자로 입력해 주세요.'); if([...nickname].some((c)=>{const cp=c.codePointAt(0);return cp<=0x1f||cp===0x7f||c==='<'||c==='>';}))throw new HttpError(400,'INVALID_NICKNAME','닉네임에 사용할 수 없는 문자가 포함되어 있습니다.'); if(RESERVED_NICKNAMES.has(nickname.toLocaleLowerCase('ko-KR')))throw new HttpError(409,'NICKNAME_RESERVED','사용할 수 없는 닉네임입니다.'); return nickname; }
export function cleanText(value,maxLength,field='text') { const text=String(value??'').trim(); if(text.length>maxLength)throw new HttpError(400,'TEXT_TOO_LONG',`${field} 길이가 너무 깁니다.`); return text; }
export function requireEnum(value,allowed,field) { if(!allowed.includes(value))throw new HttpError(400,'INVALID_VALUE',`${field} 값이 올바르지 않습니다.`); return value; }
export function safeJson(value,maxLength=50000) { const serialized=JSON.stringify(value??null); if(serialized.length>maxLength)throw new HttpError(400,'JSON_TOO_LARGE','저장하려는 상태가 너무 큽니다.'); return serialized; }
