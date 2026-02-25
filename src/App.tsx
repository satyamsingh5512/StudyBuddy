
// @ts-nocheck
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
import Maintenance from './components/Maintenance';

// OPTIMIZATION: Lazy load Analytics (non-critical, loads after hydration)
const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics }))
);

// Lazy load components for better performance
const Layout = lazy(() => import('./components/Layout'));
const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Reports = lazy(() => import('./pages/Reports'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Notices = lazy(() => import('./pages/Notices'));
const Friends = lazy(() => import('./pages/Friends'));
const Messages = lazy(() => import('./pages/Messages'));
const Settings = lazy(() => import('./pages/Settings'));
const Privacy = lazy(() => import('./pages/Privacy'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Support = lazy(() => import('./pages/Support'));
const News = lazy(() => import('./pages/News'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Admin = lazy(() => import('./pages/Admin'));
const GoogleAuthCallback = lazy(() => import('./pages/GoogleAuthCallback'));

function getRedirectPath(user: unknown, needsOnboarding: boolean): string {
  if (!user) return '/';
  if (needsOnboarding) return '/onboarding';
  return '/dashboard';
}

function App() {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState(true);

  // Maintenance Mode Check
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return <Maintenance />;
  }

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
      const timeoutId = window.setTimeout(() => {
        setUser(null);
        setIsLoading(false);
      }, 10000); // 10 second timeout (increased for cold starts)

      apiFetch('/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          window.clearTimeout(timeoutId);
          // Ensure user data is clean
          const cleanUser = data ? {
            ...data,
            totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
            streak: typeof data.streak === 'number' ? data.streak : 0,
          } : null;
          setUser(cleanUser);
          // Play login sound when user successfully authenticates
          if (data && !soundPlayed) {
            window.setTimeout(() => soundManager.playLogin(), 100);
            soundPlayed = true;
          }
          // Add a small delay for smooth transition
          window.setTimeout(() => setIsLoading(false), 500);
        })
        .catch(() => {
          window.clearTimeout(timeoutId);
          setUser(null);
          window.setTimeout(() => setIsLoading(false), 500);
        });

      return () => window.clearTimeout(timeoutId);
    };

    initializeApp();
  }, [setUser]);

  if (showWakeup) {
    return <ServerWakeup />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Check if user needs onboarding
  const needsOnboarding = user && !('onboardingDone' in user && user.onboardingDone);

  const getDefaultRoute = () => {
    if (!user)
      return (
        <Suspense fallback={<LoadingScreen />}>
          <Landing />
        </Suspense>
      );
    if (needsOnboarding) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public routes - always accessible */}
          <Route path="/auth" element={<Auth />} />
          {/* Google OAuth callback — must be public and rendered before auth check */}
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/support" element={<Support />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Root route */}
          <Route path="/" element={getDefaultRoute()} />

          {/* Onboarding route - only for authenticated users who need onboarding */}
          {user && needsOnboarding && <Route path="/onboarding" element={<Onboarding />} />}

          {/* Protected routes - require authentication and completed onboarding */}
          {user && !needsOnboarding && (
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="reports" element={<Reports />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="notices" element={<Notices />} />
              <Route path="friends" element={<Friends />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<Messages />} />
              <Route path="news" element={<News />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          )}

          {/* Catch-all redirect */}
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
