import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
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
import LoadingScreen from './components/LoadingScreen';
import { Toaster } from './components/ui/toaster';

function App() {
  const [user, setUser] = useAtom(userAtom);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data);
        // Add a small delay for smooth transition
        setTimeout(() => setIsLoading(false), 500);
      })
      .catch(() => {
        setUser(null);
        setTimeout(() => setIsLoading(false), 500);
      });
  }, [setUser]);

  if (isLoading) {
    return <LoadingScreen message="Loading StudyBuddy" />;
  }

  // Check if user needs onboarding
  const needsOnboarding = user && !(user as any).onboardingDone;

  return (
    <>
      <Routes>
        {/* Public route - accessible to everyone */}
        <Route
          path="/"
          element={
            user ? (
              needsOnboarding ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Landing />
            )
          }
        />

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
          </Route>
        ) : (
          <Route path="*" element={<Navigate to={needsOnboarding ? '/onboarding' : '/'} replace />} />
        )}

        <Route
          path="*"
          element={
            <Navigate to={user ? (needsOnboarding ? '/onboarding' : '/dashboard') : '/'} replace />
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
