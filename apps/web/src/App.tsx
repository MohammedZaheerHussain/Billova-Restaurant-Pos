// Billova POS - Main App
import { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import { PWAUpdatePrompt } from './components/pwa';

// Lazy-loaded pages (code splitting)
const LoginPage = lazy(() => import('./pages/Login'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
const SetupPage = lazy(() => import('./pages/Setup'));
const POSPage = lazy(() => import('./pages/POS'));
const OrdersPage = lazy(() => import('./pages/Orders'));
const TablesPage = lazy(() => import('./pages/Tables'));
const MenuPage = lazy(() => import('./pages/Menu'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const UsersPage = lazy(() => import('./pages/Users'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdmin'));
const InventoryPage = lazy(() => import('./pages/Inventory'));
const CustomerOrderPage = lazy(() => import('./pages/CustomerOrder'));
const PublicMenuPage = lazy(() => import('./pages/PublicMenu'));
const OnlineOrderPage = lazy(() => import('./pages/OnlineOrder'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTracking'));
const CaptainPage = lazy(() => import('./pages/Captain'));
const WarehousePage = lazy(() => import('./pages/Warehouse'));
const DeliveryPage = lazy(() => import('./pages/Delivery'));
const PrinterSettingsPage = lazy(() => import('./pages/PrinterSettings'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const AddClientPage = lazy(() => import('./pages/AddClient'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetail'));

// Route loading fallback
function PageLoader() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--bg-primary, #0a0a0f)',
            color: 'var(--text-secondary, #888)',
            fontSize: '14px',
            gap: '8px',
        }}>
            <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: '2px solid var(--accent-primary, #6C63FF)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            Loading...
        </div>
    );
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

// Redirect to appropriate page based on role
function RoleBasedRedirect() {
    const user = useAuthStore((state) => state.user);

    if (user?.role === 'SUPER_ADMIN') {
        return <Navigate to="/super-admin" replace />;
    }
    return <POSPage />;
}

// Get redirect path based on role
function useRedirectPath() {
    const user = useAuthStore((state) => state.user);
    return user?.role === 'SUPER_ADMIN' ? '/super-admin' : '/';
}

function App() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const redirectPath = useRedirectPath();
    const [showSplash, setShowSplash] = useState(false);
    const [splashComplete, setSplashComplete] = useState(false);

    // Show splash screen when user becomes authenticated
    useEffect(() => {
        const splashShown = sessionStorage.getItem('splashShown');

        if (isAuthenticated && !splashShown) {
            setShowSplash(true);
            sessionStorage.setItem('splashShown', 'true');

            // Hide splash after 2.5 seconds
            const timer = setTimeout(() => {
                setShowSplash(false);
                setSplashComplete(true);
            }, 2500);

            return () => clearTimeout(timer);
        } else if (isAuthenticated) {
            // Already shown - immediately mark as complete without showing splash
            setShowSplash(false);
            setSplashComplete(true);
        }
    }, [isAuthenticated]);

    // Failsafe: ensure splash is hidden after 3 seconds max
    useEffect(() => {
        if (showSplash) {
            const failsafe = setTimeout(() => {
                setShowSplash(false);
                setSplashComplete(true);
            }, 3000);
            return () => clearTimeout(failsafe);
        }
    }, [showSplash]);

    // Clear splash flag when user logs out
    useEffect(() => {
        if (!isAuthenticated) {
            sessionStorage.removeItem('splashShown');
            setSplashComplete(false);
        }
    }, [isAuthenticated]);

    return (
        <>
            {/* Splash Screen */}
            <SplashScreen show={showSplash} />

            {/* PWA Update Prompt */}
            <PWAUpdatePrompt />

            {/* Main App Routes */}
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            isAuthenticated && splashComplete ? <Navigate to={redirectPath} replace /> : <LoginPage />
                        }
                    />
                    {/* /register disabled - redirect to login */}
                    <Route
                        path="/register"
                        element={<Navigate to="/login" replace />}
                    />
                    <Route
                        path="/forgot-password"
                        element={
                            isAuthenticated ? <Navigate to={redirectPath} replace /> : <ForgotPasswordPage />
                        }
                    />
                    <Route
                        path="/setup"
                        element={
                            isAuthenticated ? <Navigate to={redirectPath} replace /> : <SetupPage />
                        }
                    />
                    <Route
                        path="/reset-password"
                        element={
                            isAuthenticated ? <Navigate to={redirectPath} replace /> : <ForgotPasswordPage />
                        }
                    />

                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<RoleBasedRedirect />} />
                        <Route path="orders" element={<OrdersPage />} />
                        <Route path="tables" element={<TablesPage />} />
                        <Route path="menu" element={<MenuPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="super-admin" element={<SuperAdminPage />} />
                        <Route path="super-admin/add-client" element={<AddClientPage />} />
                        <Route path="super-admin/client/:id" element={<ClientDetailPage />} />
                        <Route path="inventory" element={<InventoryPage />} />
                        <Route path="captain" element={<CaptainPage />} />
                        <Route path="warehouse" element={<WarehousePage />} />
                        <Route path="delivery" element={<DeliveryPage />} />
                        <Route path="printer-settings" element={<PrinterSettingsPage />} />
                        <Route path="dashboard" element={<OwnerDashboard />} />
                    </Route>

                    {/* Public Route - Customer Self Order (No Auth) */}
                    <Route path="/order/:token" element={<CustomerOrderPage />} />

                    {/* Public Route - Online Menu (No Auth) */}
                    <Route path="/m/:branchId" element={<PublicMenuPage />} />

                    {/* Public Route - Online Order (No Auth) */}
                    <Route path="/o/:branchId" element={<OnlineOrderPage />} />

                    {/* Public Route - Order Tracking (No Auth) */}
                    <Route path="/track/:orderId" element={<OrderTrackingPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </>
    );
}

export default App;
