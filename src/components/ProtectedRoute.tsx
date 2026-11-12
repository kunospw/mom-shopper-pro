import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const Landing = lazy(() => import('@/pages/Landing'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const spinner = (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return spinner;

  if (!user) {
    // A visitor at the front door gets the introduction. The installed app
    // (start_url "/?source=pwa") and every deep link go straight to sign-in.
    const installed = new URLSearchParams(location.search).get('source') === 'pwa';
    if (location.pathname === '/' && !installed) return <Suspense fallback={spinner}><Landing /></Suspense>;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
