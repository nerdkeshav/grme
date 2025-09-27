import React, { Suspense, Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationToast from './components/shared/NotificationToast';
import LoadingSpinner from './components/shared/LoadingSpinner';
import ConnectionErrorPage from './components/shared/ConnectionErrorPage';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';
import { forceCleanAllTokens, cleanAndRotateAuthStorage } from './utils/supabaseClient';
import { markPageAsLoaded, isPageLoaded } from './utils/connectionMiddleware';
import { usePreventRefresh } from './utils/preventRefresh';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './fix-contrast-issues.css';
import ResetConnectionButton from './components/shared/ResetConnectionButton';

// Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import Landing from "./pages/Landing";
import PaymentVerification from './pages/PaymentVerification';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import ConnectionTroubleshooting from './pages/ConnectionTroubleshooting';

// Lazy load components to improve initial loading time
const FaceRating = React.lazy(() => import('./components/face-rating/FaceRating'));
const Progress = React.lazy(() => import('./components/progress/Progress'));
const Tips = React.lazy(() => import('./components/tips/Tips'));
const Profile = React.lazy(() => import('./components/profile/Profile'));
const UserProfile = React.lazy(() => import('./components/profile/UserProfile'));
const Subscription = React.lazy(() => import('./components/subscription/Subscription'));
const SavedTips = React.lazy(() => import('./components/tips/SavedTips'));
const Search = React.lazy(() => import('./components/search/Search'));
const Leaderboard = React.lazy(() => import('./components/leaderboard/Leaderboard'));
const Habits = React.lazy(() => import('./components/habits/Habits'));

// Error boundary
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="mb-4">We're sorry, an error occurred. Please try refreshing the page.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-accent text-buttonText rounded-md"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Common loading fallback component - wrapped with React.memo to prevent unnecessary re-renders
const LoadingFallback = React.memo(() => (
  <LoadingSpinner fullScreen type="logo" size="lg" />
));
LoadingFallback.displayName = 'LoadingFallback';

// ProtectedRoute component wrapped with memo to prevent re-renders
const ProtectedRoute = React.memo(({ children }: { children: ReactNode }) => {
  const { user, loading, connectionError } = useAuth();
  const location = useLocation();
  
  // Check if this is already a login-related path
  const isAuthPath = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  if (loading) {
    return <LoadingSpinner fullScreen type="logo" size="xl" text="Loading GRME" subText="Please wait..." />;
  }
  
  // Only show connection error if there's an issue AND we're not already redirecting to an auth page
  if (connectionError && !user && !isAuthPath) {
    return <ConnectionErrorPage />;
  }
  
  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
});
ProtectedRoute.displayName = 'ProtectedRoute';

// Public route component that doesn't redirect logged-in users
const PublicRoute = React.memo(({ children }: { children: ReactNode }) => {
  return <>{children}</>;
});
PublicRoute.displayName = 'PublicRoute';

// Admin-only route component
const AdminRoute = React.memo(({ children }: { children: ReactNode }) => {
  const { user, loading, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  
  if (loading) {
    return <LoadingSpinner fullScreen type="logo" size="xl" text="Loading GRME" subText="Please wait..." />;
  }
  
  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
});
AdminRoute.displayName = 'AdminRoute';

// OAuth callback handler component
const OAuthCallbackHandler = React.memo(() => {
  const { user, loading, connectionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Only run this effect if we're not currently loading
    if (loading) {
      return;
    }
    
    // Log authentication information to help debug
    console.log('OAuth callback handler:', {
      hasUser: !!user,
      isLoading: loading,
      hasCodeParam: location.search.includes('code='),
      pathname: location.pathname,
      search: location.search,
      hasConnectionError: connectionError
    });
    
    // If there's a connection error and we're in an OAuth flow, show a warning
    if (connectionError && location.search.includes('code=')) {
      console.error('Connection error detected during OAuth callback');
      // We'll let the Login/Register component handle the error display
    }
    
      // If we have a code parameter and we're at an unexpected route (not login/register)
      // redirect to login with the code parameter intact
      if (location.search.includes('code=')) {
        // Only redirect if we're not already on login/register and don't have a user yet
        const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
        
        if (!isAuthPage && !user) {
          console.log('OAuth callback detected at unexpected route, redirecting to login');
          
          // Extract the path without the code parameter to use as the redirect destination
          const basePath = location.pathname;
          const redirectPath = basePath !== '/' ? basePath : '/face-rating';
            
          // Preserve the code parameter but also store the intended redirect destination
          const params = new URLSearchParams(location.search);
          params.set('redirect', redirectPath);
          
          // Add a timestamp to prevent redirect loops
          params.set('ts', Date.now().toString());
          
          navigate('/login?' + params.toString(), { replace: true });
        }
    }
    
    // If we have a user and a code parameter, clean up the URL
      // This will remove the code parameter from the URL after successful login
    if (user && location.search.includes('code=')) {
        // User is authenticated, redirect to the appropriate page without code parameter
        const params = new URLSearchParams(location.search);
        const redirectPath = params.get('redirect') || 
          (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/' 
            ? '/face-rating' 
            : location.pathname);
            
        // Remove the auth code from the URL to clean it up
        console.log('User authenticated with OAuth, cleaning up URL and redirecting to:', redirectPath);
        navigate(redirectPath, { replace: true });
    }
  }, [loading, user, location, navigate, connectionError]);
  
  return null; // This is a utility component, no UI
});
OAuthCallbackHandler.displayName = 'OAuthCallbackHandler';

// Custom PersistentSuspense to prevent re-loading on tab switches
const PersistentSuspense = React.memo(({ children }: { children: ReactNode }) => {
  // Use a ref to track if component has been loaded
  const hasLoaded = React.useRef(false);
  const location = useLocation();
  const path = location.pathname;
  
  // Use prevent refresh hook
  usePreventRefresh(`suspense-${path}`);
      
  // Check if this page was previously loaded
  const wasLoadedBefore = isPageLoaded(path);
  
  // After first successful render, mark as loaded
  React.useEffect(() => {
    hasLoaded.current = true;
    markPageAsLoaded(path);
  }, [path]);
  
  // Only show loading state on initial load, not on tab switches
  if (hasLoaded.current || wasLoadedBefore) {
    return <>{children}</>;
  }
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  );
});
PersistentSuspense.displayName = 'PersistentSuspense';

function App() {
  // Apply the prevent refresh hook to the entire app
  usePreventRefresh('app-root');
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <ConnectionStatusBanner />
            <NotificationToast />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={
                <PublicRoute>
                  <OAuthCallbackHandler />
                  <Landing />
                </PublicRoute>
              } />
              <Route path="/login" element={
                <PublicRoute>
                  <OAuthCallbackHandler />
                  <Login />
                </PublicRoute>
              } />
              <Route path="/register" element={
                <PublicRoute>
                  <OAuthCallbackHandler />
                  <Register />
                </PublicRoute>
              } />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/payment-verification" element={<PaymentVerification />} />
              <Route path="/connection-troubleshooting" element={
                <AdminRoute>
                  <ConnectionTroubleshooting />
                </AdminRoute>
              } />
              
              {/* Protected routes */}
              <Route path="/face-rating" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <OAuthCallbackHandler />
                    <FaceRating />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/progress" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Progress />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Profile />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/profile/:id" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <UserProfile />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/subscription" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Subscription />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/leaderboard" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Leaderboard />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/habits" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Habits />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/tips" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Tips />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/saved-tips" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <SavedTips />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute>
                  <PersistentSuspense>
                    <Search />
                  </PersistentSuspense>
                </ProtectedRoute>
              } />
              
              {/* Redirect dashboard to face-rating */}
              <Route path="/dashboard" element={<Navigate to="/face-rating" replace />} />
              
              {/* Catch all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App; 