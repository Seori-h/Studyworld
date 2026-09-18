import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import type { SessionState } from './domain/types';
import { api } from './lib/api';
import { usePathname } from './app/router';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Commons } from './pages/Commons';
import { Rooms } from './pages/Rooms';
import { RoomDetail } from './pages/RoomDetail';
import { Support } from './pages/Support';

const emptySession: SessionState = { kind: 'none' };
export default function App() {
  const pathname=usePathname(); const [session,setSession]=useState<SessionState>(emptySession);
  useEffect(()=>{void api.get<SessionState>('/api/v1/session').then(setSession).catch(()=>setSession(emptySession));},[]);
  let content=<Home session={session}/>;
  if(pathname==='/login')content=<Login/>;
  else if(pathname==='/commons')content=<Commons session={session}/>;
  else if(pathname==='/rooms')content=<Rooms session={session}/>;
  else if(pathname.startsWith('/rooms/'))content=<RoomDetail id={pathname.slice('/rooms/'.length)}/>;
  else if(pathname==='/support')content=<Support/>;
  return <Shell session={session}>{content}</Shell>;
}
