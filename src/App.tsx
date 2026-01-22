import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from './store/atoms';
import LoadingScreen from './components/LoadingScreen';
import ServerWakeup from './components/ServerWakeup';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { apiFetch } from './config/api';
import { soundManager } from './lib/sounds';
import { wakeupServer } from './lib/serverWakeup';
import { useNetworkStatus } from './lib/networkStatus';

// OPTIMIZATION: Lazy load Analytics (non-critical, loads after hydration)
const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics }))
);

// Lazy load components for better performance
const Layout = lazy(() => import('./components/Layout'));
const Landing = lazy(() => import('./pages/Landing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Reports = lazy(() => import('./pages/Reports'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Notices = lazy(() => import('./pages/Notices'));
const Chat = lazy(() => import('./pages/Chat'));
const Friends = lazy(() => import('./pages/Friends'));
const Messages = lazy(() => import('./pages/Messages'));
const Settings = lazy(() => import('./pages/Settings'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const News = lazy(() => import('./pages/News'));

function getRedirectPath(user: unknown, needsOnboarding: boolean): string {
  if (!user) return '/';
  if (needsOnboarding) return '/onboarding';
  return '/dashboard';
}

function App() {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize network status monitoring
  useNetworkStatus();
  const [showWakeup, setShowWakeup] = useState(true);

  useEffect(() => {
    let soundPlayed = false;

    const initializeApp = async () => {
      // Pre-initialize audio to prevent first-click delay
      soundManager.initialize();

      // First, wake up the server if needed
      await wakeupServer();
      setShowWakeup(false);

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setUser(null);
        setIsLoading(false);
      }, 10000); // 10 second timeout (increased for cold starts)

      apiFetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          clearTimeout(timeoutId);
          setUser(data);
          // Play login sound when user successfully authenticates
          if (data && !soundPlayed) {
            setTimeout(() => soundManager.playLogin(), 100);
            soundPlayed = true;
          }
          // Add a small delay for smooth transition
          setTimeout(() => setIsLoading(false), 500);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          setUser(null);
          setTimeout(() => setIsLoading(false), 500);
        });

      return () => clearTimeout(timeoutId);
    };

    initializeApp();
  }, [setUser]);

  if (showWakeup) {
    return <ServerWakeup />;
  }

  if (isLoading) {
    return <LoadingScreen message="Loading StudyBuddy" />;
  }

  // Check if user needs onboarding
  const needsOnboarding = user && !('onboardingDone' in user && user.onboardingDone);

  const getDefaultRoute = () => {
    if (!user)
      return (
        <Suspense fallback={<LoadingScreen message="Loading..." />}>
          <Landing />
        </Suspense>
      );
    if (needsOnboarding) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <Routes>
          {/* Public routes - accessible to everyone */}
          <Route path="/" element={getDefaultRoute()} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Onboarding route */}
          {user && needsOnboarding && <Route path="/onboarding" element={<Onboarding />} />}

          {/* Protected routes - require authentication and onboarding */}
          {user && !needsOnboarding ? (
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="reports" element={<Reports />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="notices" element={<Notices />} />
              <Route path="chat" element={<Chat />} />
              <Route path="friends" element={<Friends />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<Messages />} />
              <Route path="news" element={<News />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          ) : (
            <Route
              path="*"
              element={<Navigate to={needsOnboarding ? '/onboarding' : '/'} replace />}
            />
          )}

          <Route
            path="*"
            element={<Navigate to={getRedirectPath(user, Boolean(needsOnboarding))} replace />}
          />
        </Routes>
      </Suspense>
      <Toaster />
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
