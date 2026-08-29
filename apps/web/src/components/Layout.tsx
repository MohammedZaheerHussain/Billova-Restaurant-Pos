import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutGrid, ShoppingBag, Grid3X3, UtensilsCrossed,
    BarChart3, Users, Settings, LogOut, Shield, Package, Lock, Warehouse,
    Puzzle, LayoutDashboard, Sun, Moon, Search,
    Menu as MenuIcon
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import useSubscription, { FeatureKey } from '../hooks/useSubscription';
import { useSync, useSyncInit } from '../hooks/useSync';
import { OfflineIndicator } from './sync';
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
    const { hasFeature, isExpired } = useSubscription();

    const [cmdOpen, setCmdOpen] = useState(false);

    // Initialize offline sync
    useSyncInit();
    const { isOnline } = useSync();

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



    // Update last_seen on Supabase profile so LastActivity shows correctly
    useEffect(() => {
        if (!user?.id || isSuperAdmin) return;
        supabase.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', user.id).then(() => {});
    }, [user?.id, isSuperAdmin]);

    // ── Demo / Subscription Expired Lock Screen ─────────────────────────────
    if (!isSuperAdmin && isExpired) {
        return (
            <div className="subscription-lock-container">
                <div className="subscription-lock-card">
                    <div className="lock-icon-badge">
                        <Lock size={32} />
                    </div>
                    <h2>Demo Period Ended</h2>
                    <p className="lock-subtitle">Your free trial access has expired.</p>
                    <div className="lock-message-box">
                        <p>🔒 This software has been locked as the 3-day demo period is over.</p>
                        <p>📞 Please contact the owner to continue using Billova POS and activate a full subscription plan.</p>
                    </div>
                    <button className="btn-lock-logout" onClick={handleLogout}>
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

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
                {/* Logo Header */}
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
                        {sidebarOpen && (
                            <div className="logo-text-group">
                                <span className="logo-text">Billova</span>
                                <span className="logo-tagline">Restaurant POS</span>
                            </div>
                        )}
                    </div>
                </div>

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

                {/* Sidebar Footer — User Profile + Actions */}
                <div className="sidebar-footer">
                    {/* User Profile Card */}
                    <div className="user-profile-card">
                        <div className="user-avatar">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        {sidebarOpen && (
                            <div className="user-details">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-role">{user?.role?.replace('_', ' ')}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Action Buttons */}
                    {sidebarOpen && (
                        <div className="sidebar-footer-actions">
                            <button
                                className="footer-action-btn"
                                onClick={toggleTheme}
                                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                            <button
                                className="footer-action-btn logout"
                                onClick={handleLogout}
                                title="Sign out"
                                aria-label="Sign out"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
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

