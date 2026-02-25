// @ts-nocheck
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { userAtom } from '../store/atoms';
import { apiFetch } from '../config/api';
import LoadingScreen from '../components/LoadingScreen';

/**
 * GoogleAuthCallback
 *
 * Landing page after the server-side Google OAuth redirect.
 * The server redirects here as:
 *   /auth/google/callback?next=dashboard   (or onboarding)
 *
 * Why this page exists:
 *   After OAuth the session cookie is written to MongoDB asynchronously.
 *   We retry /auth/me with exponential back-off so even a slow MongoStore
 *   write still succeeds before we give up.
 */

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 400; // 400 → 800 → 1600 → 3200 ms …

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [, setUser] = useAtom(userAtom);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const next = searchParams.get('next') || 'dashboard';
    const targetPath = `/${next}`;

    const tryFetchUser = async (attempt: number): Promise<void> => {
      try {
        const res = await apiFetch('/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setUser({
              ...data,
              totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
              streak: typeof data.streak === 'number' ? data.streak : 0,
            });
            navigate(targetPath, { replace: true });
            return;
          }
        }
      } catch {
        // network error — fall through to retry
      }

      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
        return tryFetchUser(attempt + 1);
      }

      // All retries exhausted
      console.error('❌ GoogleAuthCallback: could not verify session after OAuth');
      navigate('/auth?error=google_session_failed', { replace: true });
    };

    tryFetchUser(1);
  }, [navigate, searchParams, setUser]);

  return <LoadingScreen />;
}
