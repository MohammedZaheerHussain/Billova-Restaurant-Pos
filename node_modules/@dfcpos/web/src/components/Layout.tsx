// Main Layout with Sidebar
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutGrid, ShoppingBag, Grid3X3, UtensilsCrossed,
    BarChart3, Users, Settings, LogOut, ChevronLeft, ChevronRight, Shield, Package, Lock
} from 'lucide-react';
import { useAuthStore, useUIStore } from '../store';
import useSubscription, { FeatureKey } from '../hooks/useSubscription';
import './Layout.css';

interface NavItem {
    path: string;
    icon: typeof LayoutGrid;
    label: string;
    requiredFeature?: FeatureKey;
}

const navItems: NavItem[] = [
    { path: '/', icon: LayoutGrid, label: 'POS', requiredFeature: 'pos' },
    { path: '/orders', icon: ShoppingBag, label: 'Orders', requiredFeature: 'orderHistory' },
    { path: '/tables', icon: Grid3X3, label: 'Tables', requiredFeature: 'tables' },
    { path: '/menu', icon: UtensilsCrossed, label: 'Menu', requiredFeature: 'menuManagement' },
    { path: '/reports', icon: BarChart3, label: 'Reports', requiredFeature: 'reports' },
    { path: '/inventory', icon: Package, label: 'Inventory', requiredFeature: 'inventory' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { sidebarOpen, toggleSidebar } = useUIStore();
    const { hasFeature, currentPlan, getPlanColor } = useSubscription();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    return (
        <div className="layout">
            {/* Sidebar */}
            <motion.aside
                className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}
                animate={{ width: sidebarOpen ? 220 : 70 }}
                transition={{ duration: 0.2 }}
            >
                {/* Logo */}
                <div className="sidebar-header">
                    <div className="logo">
                        <img src="/logo.png" alt="Billova POS" className="logo-icon-img" />
                        {sidebarOpen && <span className="logo-text">Billova</span>}
                    </div>
                    <button className="toggle-btn" onClick={toggleSidebar}>
                        {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                </div>

                {/* Subscription Badge */}
                {sidebarOpen && !isSuperAdmin && (
                    <div className="subscription-badge" style={{ borderColor: getPlanColor() }}>
                        <span style={{ color: getPlanColor() }}>{currentPlan}</span>
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav">
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
                        navItems.map(({ path, icon: Icon, label, requiredFeature }) => {
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
                    <button className="logout-btn" onClick={handleLogout} title="Logout">
                        <LogOut size={18} />
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

