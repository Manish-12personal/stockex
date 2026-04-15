import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTO_REFRESH_EVENT } from '../lib/autoRefresh';

const USER_REFRESH_MS = 30_000;

/**
 * Periodically signals open user pages to refetch API data (no full page reload).
 * Pauses while the tab is hidden; refires once when the tab becomes visible again.
 */
export default function UserAutoRefresh() {
  const { user } = useAuth();
  const location = useLocation();
  const intervalRef = useRef(null);

  useEffect(() => {
    const path = location.pathname;
    const active = user?.token && path.startsWith('/user');
    if (!active) return;

    const fire = () => {
      if (document.visibilityState !== 'visible') return;
      window.dispatchEvent(new CustomEvent(AUTO_REFRESH_EVENT));
    };

    intervalRef.current = setInterval(fire, USER_REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user?.token, location.pathname]);

  return null;
}
