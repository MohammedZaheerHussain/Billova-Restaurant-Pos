import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutGrid, ShoppingBag, Grid3X3, UtensilsCrossed,
    BarChart3, Users, Settings, LogOut, Shield, Package, Lock, Bell, Warehouse, RefreshCw,
    Puzzle, LayoutDashboard, Sun, Moon, Search,
    Menu as MenuIcon
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import useSubscription, { FeatureKey } from '../hooks/useSubscription';
import { ordersAPI } from '../api';
import { useSync, useSyncInit } from '../hooks/useSync';
import { SyncStatusBadge, OfflineIndicator } from './sync';
import SyncIndicator from './SyncIndicator';
import { CommandPalette } from './ui/CommandPalette';
import { supabase } from '../lib/supabase';
import './Layout.css';
import { logger } from '../utils/logger';

interface NavItem {
    path: string;
    icon: typeof LayoutGrid;
    label: string;
    requiredFeature?: FeatureKey;
    requiredRoles?: string[]; // New: restrict to specific roles
}

const navItems: NavItem[] = [
    { path: '/', icon: LayoutGrid, label: 'POS', requiredFeature: 'pos' },
    { path: '/orders', icon: ShoppingBag, label: 'Orders', requiredFeature: 'orderHistory' },
    { path: '/tables', icon: Grid3X3, label: 'Tables', requiredFeature: 'tables' },
    { path: '/menu', icon: UtensilsCrossed, label: 'Menu', requiredFeature: 'menuManagement' },
    { path: '/reports', icon: BarChart3, label: 'Reports', requiredFeature: 'reports' },
    { path: '/inventory', icon: Package, label: 'Inventory', requiredFeature: 'inventory' },
    { path: '/warehouse', icon: Warehouse, label: 'Warehouse', requiredFeature: 'inventory' },
    { path: '/addons', icon: Puzzle, label: 'Addons', requiredFeature: 'inventory' },
    { path: '/users', icon: Users, label: 'Users', requiredRoles: ['OWNER', 'ADMIN', 'SUPER_ADMIN'] },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', requiredRoles: ['OWNER', 'ADMIN', 'owner', 'admin'] },
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
    const navigate = useNavigate();
    const { user, logout, checkAuth } = useAuthStore();
    const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();
    const { hasFeature, currentPlan, getPlanColor } = useSubscription();

    const [cmdOpen, setCmdOpen] = useState(false);

    // Initialize offline sync
    useSyncInit();
    const { triggerSync, status: syncStatus, isOnline, pendingCount } = useSync();

    // Check token expiry on mount and periodically
    useEffect(() => {
        if (!checkAuth()) {
            navigate('/login');
            return;
        }
        // Check every 5 minutes
        const interval = setInterval(() => {
            if (!checkAuth()) {
                navigate('/login');
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkAuth, navigate]);

    const handleLogout = async () => {
        try {
            // Sign out from Supabase first
            await supabase.auth.signOut();
        } catch (e) {
            logger.error('Supabase signOut error:', e);
        }
        // Clear Zustand state
        logout();
        // Clear session storage
        sessionStorage.removeItem('splashShown');
        // Navigate to login
        navigate('/login');
    };

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    // Online orders notification
    const [pendingOnlineOrders, setPendingOnlineOrders] = useState(0);

    useEffect(() => {
        if (isSuperAdmin) return;

        const fetchPendingOrders = async () => {
            try {
                const res = await ordersAPI.getAll();
                const pending = res.data.filter((o: any) =>
                    (o.orderType === 'DELIVERY' || o.orderType === 'TAKEAWAY') &&
                    o.status === 'PENDING'
                ).length;
                setPendingOnlineOrders(pending);
            } catch (e) {
                logger.error('Error fetching pending orders:', e);
            }
        };

        fetchPendingOrders();
        const interval = setInterval(fetchPendingOrders, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [isSuperAdmin]);

    return (
        <div className="layout">
            {/* Skip to content link for keyboard users */}
            <a href="#main-content" className="skip-to-content">Skip to main content</a>

            {/* Sidebar */}
            <motion.aside
                className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}
                animate={{ width: sidebarOpen ? 220 : 70 }}
                transition={{ duration: 0.2 }}
                role="navigation"
                aria-label="Main navigation"
            >
                {/* Logo - Click to toggle sidebar */}
                <div className="sidebar-header">
                    <div
                        className="logo clickable"
                        onClick={toggleSidebar}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSidebar(); } }}
                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        role="button"
                        tabIndex={0}
                        aria-expanded={sidebarOpen}
                        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        style={{ cursor: 'pointer' }}
                    >
                        <img src="/logo.png" alt="Billova POS" className="logo-icon-img" />
                        {sidebarOpen && <span className="logo-text">Billova</span>}
                    </div>
                </div>

                {/* Subscription Badge */}
                {sidebarOpen && !isSuperAdmin && (
                    <div className="subscription-badge" style={{ borderColor: getPlanColor() }}>
                        <span style={{ color: getPlanColor() }}>{currentPlan}</span>
                    </div>
                )}

                {/* Online Order Notifications */}
                {!isSuperAdmin && (
                    <button
                        className={`notification-bell ${pendingOnlineOrders > 0 ? 'has-orders' : ''}`}
                        onClick={() => navigate('/orders')}
                        aria-label={pendingOnlineOrders > 0 ? `${pendingOnlineOrders} pending online orders` : 'No pending orders'}
                        title={pendingOnlineOrders > 0 ? `${pendingOnlineOrders} pending online orders` : 'No pending orders'}
                    >
                        <Bell size={20} />
                        {pendingOnlineOrders > 0 && (
                            <span className="notification-badge">{pendingOnlineOrders}</span>
                        )}
                        {sidebarOpen && <span className="notification-label">Online Orders</span>}
                    </button>
                )}

                {/* Sync Status & Controls */}
                {!isSuperAdmin && (
                    <div className="sync-controls">
                        <SyncStatusBadge showLabel={sidebarOpen} onClick={triggerSync} />
                        {sidebarOpen && !isOnline && (
                            <OfflineIndicator variant="badge" />
                        )}
                        {sidebarOpen && pendingCount > 0 && isOnline && (
                            <button
                                className="sync-now-btn"
                                onClick={triggerSync}
                                disabled={syncStatus === 'syncing'}
                                title="Sync pending orders now"
                            >
                                <RefreshCw size={16} className={syncStatus === 'syncing' ? 'spinning' : ''} />
                                <span>Sync Now ({pendingCount})</span>
                            </button>
                        )}
                        {/* New Cloud Sync Indicator */}
                        <SyncIndicator />
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav" aria-label="Pages">
                    {/* Super Admin sees ONLY Super Admin link */}
                    {isSuperAdmin ? (
                        <NavLink
                            to="/super-admin"
                            className={({ isActive }) => `nav-item super-admin-nav ${isActive ? 'active' : ''}`}
                        >
                            <Shield size={20} />
                            {sidebarOpen && <span>Dashboard</span>}
                        </NavLink>
                    ) : (
                        /* Customers see regular POS navigation */
                        navItems.map(({ path, icon: Icon, label, requiredFeature, requiredRoles }) => {
                            // Check role restriction first
                            if (requiredRoles && user?.role && !requiredRoles.includes(user.role)) {
                                return null; // Hide for unauthorized roles
                            }

                            const locked = requiredFeature ? !hasFeature(requiredFeature) : false;

                            if (locked) {
                                return (
                                    <div
                                        key={path}
                                        className="nav-item locked"
                                        title={`Upgrade to access ${label}`}
                                    >
                                        <Icon size={20} />
                                        {sidebarOpen && (
                                            <>
                                                <span>{label}</span>
                                                <Lock size={14} className="lock-icon" />
                                            </>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <NavLink
                                    key={path}
                                    to={path}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    end={path === '/'}
                                >
                                    <Icon size={20} />
                                    {sidebarOpen && <span>{label}</span>}
                                </NavLink>
                            );
                        })
                    )}
                </nav>

                {/* User Profile */}
                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        {sidebarOpen && (
                            <div className="user-details">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-role">{user?.role}</span>
                            </div>
                        )}
                    </div>
                    <div className="sidebar-footer-actions">
                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button className="logout-btn" onClick={handleLogout} title="Logout" aria-label="Sign out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </motion.aside>

            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={toggleSidebar}
                />
            )}

            {/* Offline Banner - shown when offline at top */}
            {!isOnline && (
                <OfflineIndicator variant="banner" />
            )}

            {/* Main Content */}
            <main className="main-content" id="main-content" role="main" aria-label="Page content">
                {/* Top Command Bar */}
                <header className="top-command-bar">
                    <button
                        className="mobile-menu-btn"
                        onClick={toggleSidebar}
                        aria-label="Open menu"
                    >
                        <MenuIcon size={20} />
                    </button>
                    <button
                        className="cmd-trigger-btn"
                        onClick={() => setCmdOpen(true)}
                        title="Open command palette (Cmd + K)"
                    >
                        <Search size={15} />
                        <span>Search commands or pages...</span>
                        <kbd>⌘K</kbd>
                    </button>
                </header>

                <Outlet />
            </main>

            {/* Global Command Palette */}
            <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
        </div>
    );
}

