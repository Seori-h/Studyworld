import { useEffect, useState } from 'react';

export function navigate(path: string): void {
  if (location.pathname === path) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new Event('studyworld:navigate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPathname(location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener('studyworld:navigate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('studyworld:navigate', update);
    };
  }, []);
  return pathname;
}
