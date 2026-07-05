import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ unauthenticatedElement }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!isAuthenticated) return unauthenticatedElement ?? <Navigate to="/login" replace />;

  return <Outlet />;
}