import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { Analytics } from '@vercel/analytics/react';
import { userAtom } from './store/atoms';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Reports from './pages/Reports';
import Leaderboard from './pages/Leaderboard';
import Notices from './pages/Notices';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import LoadingScreen from './components/LoadingScreen';
import { Toaster } from './components/ui/toaster';
import { apiFetch } from './config/api';
import { soundManager } from './lib/sounds';
import FormsDashboard from './pages/forms/FormsDashboard';
import FormBuilder from './pages/forms/FormBuilder';
import PublicForm from './pages/forms/PublicForm';
import FormResponses from './pages/forms/FormResponses';
import FormAnalytics from './pages/forms/FormAnalytics';
import WebhookLogs from './pages/forms/WebhookLogs';

function getRedirectPath(user: unknown, needsOnboarding: boolean): string {
  if (!user) return '/';
  if (needsOnboarding) return '/onboarding';
  return '/dashboard';
}

function App() {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let soundPlayed = false;
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setUser(null);
      setIsLoading(false);
    }, 5000); // 5 second timeout

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
  }, [setUser]);

  if (isLoading) {
    return <LoadingScreen message="Loading StudyBuddy" />;
  }

  // Check if user needs onboarding
  const needsOnboarding = user && !('onboardingDone' in user && user.onboardingDone);

  const getDefaultRoute = () => {
    if (!user) return <Landing />;
    if (needsOnboarding) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
  };

  return (
    <>
      <Routes>
        {/* Public routes - accessible to everyone */}
        <Route path="/" element={getDefaultRoute()} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/forms/f/:identifier" element={<PublicForm />} />

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
            <Route path="settings" element={<Settings />} />
            <Route path="forms" element={<FormsDashboard />} />
            <Route path="forms/:formId/builder" element={<FormBuilder />} />
            <Route path="forms/:formId/responses" element={<FormResponses />} />
            <Route path="forms/:formId/analytics" element={<FormAnalytics />} />
            <Route path="forms/:formId/webhook-logs" element={<WebhookLogs />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to={needsOnboarding ? '/onboarding' : '/'} replace />} />
        )}

        <Route path="*" element={<Navigate to={getRedirectPath(user, Boolean(needsOnboarding))} replace />} />
      </Routes>
      <Toaster />
      <Analytics />
    </>
  );
}

export default App;
