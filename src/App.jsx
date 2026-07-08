import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ConsigtecAuthProvider } from '@/lib/ConsigtecAuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import PageNotFound from './lib/PageNotFound';
// Add page imports here
import Login from '@/pages/Login';
import AppLayout from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import AreaPage from '@/pages/AreaPage';
import Pendencias from '@/pages/Pendencias';
import Users from '@/pages/admin/Users';
import Vinculos from '@/pages/admin/Vinculos';
import AreasAdmin from '@/pages/admin/Areas';
import Auditoria from '@/pages/Auditoria';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <ConsigtecAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pendencias" element={<Pendencias />} />
            <Route path="/area/:codigo" element={<AreaPage />} />
            <Route path="/admin/usuarios" element={<Users />} />
            <Route path="/admin/vinculos" element={<Vinculos />} />
            <Route path="/admin/areas" element={<AreasAdmin />} />
            <Route path="/admin/auditoria" element={<Auditoria />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </ConsigtecAuthProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App