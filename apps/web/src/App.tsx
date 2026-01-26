// Billova POS - Main App
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import { PWAUpdatePrompt } from './components/pwa';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import ForgotPasswordPage from './pages/ForgotPassword';
import SetupPage from './pages/Setup';
import POSPage from './pages/POS';
import OrdersPage from './pages/Orders';
import TablesPage from './pages/Tables';
import MenuPage from './pages/Menu';
import ReportsPage from './pages/Reports';
import UsersPage from './pages/Users';
import SettingsPage from './pages/Settings';
import SuperAdminPage from './pages/SuperAdmin';
import InventoryPage from './pages/Inventory';
import CustomerOrderPage from './pages/CustomerOrder';
import PublicMenuPage from './pages/PublicMenu';
import OnlineOrderPage from './pages/OnlineOrder';
import OrderTrackingPage from './pages/OrderTracking';
import CaptainPage from './pages/Captain';
import WarehousePage from './pages/Warehouse';
import DeliveryPage from './pages/Delivery';
import PrinterSettingsPage from './pages/PrinterSettings';

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
            <Routes>
                <Route
                    path="/login"
                    element={
                        isAuthenticated && splashComplete ? <Navigate to={redirectPath} replace /> : <LoginPage />
                    }
                />
                <Route
                    path="/register"
                    element={
                        isAuthenticated ? <Navigate to={redirectPath} replace /> : <RegisterPage />
                    }
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
                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="captain" element={<CaptainPage />} />
                    <Route path="warehouse" element={<WarehousePage />} />
                    <Route path="delivery" element={<DeliveryPage />} />
                    <Route path="printer-settings" element={<PrinterSettingsPage />} />
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
        </>
    );
}

export default App;
