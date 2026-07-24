import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { BrandingProvider } from './lib/BrandingContext';
import ScrollToTop from './components/ScrollToTop';
import { OrgProvider } from '@/lib/OrgContext';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from '@/components/RequireAuth';
import GuestMaintenanceGuard from '@/components/GuestMaintenanceGuard';

import Dashboard from '@/pages/Dashboard';
import DocumentForm from '@/pages/DocumentForm';
import DocumentView from '@/pages/DocumentView';
import Settings from '@/pages/Settings';

const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" style={{ borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <OrgProvider>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<AppLayout />}>
          <Route element={<GuestMaintenanceGuard />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents/:id" element={<DocumentView />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/documents/new" element={<DocumentForm />} />
            <Route path="/documents/:id/edit" element={<DocumentForm />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </OrgProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <BrandingProvider>
            <ScrollToTop />
            <AppRoutes />
          </BrandingProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
