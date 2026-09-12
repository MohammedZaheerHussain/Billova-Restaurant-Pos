// Login Page - Split Screen Hero Auth (Supabase Auth Only)
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Eye, EyeOff, ShieldCheck, Phone } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import api from '../api';
import { loadBranchSettings } from '../api/branches';
import './Login.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);

    // Check if setup is needed (cached per session to prevent rate limits)
    useEffect(() => {
        const checkSetup = async () => {
            try {
                const cached = sessionStorage.getItem('billova_setup_checked');
                if (cached === 'complete' || import.meta.env.VITE_SUPABASE_AUTH_ONLY === 'true') {
                    setCheckingSetup(false);
                    return;
                }

                const res = await api.get('/auth/check-setup');
                if (!res.data.isSetupComplete) {
                    navigate('/setup');
                    return;
                }
                sessionStorage.setItem('billova_setup_checked', 'complete');
            } catch (error) {
                logger.debug('Setup check skipped due to error');
            } finally {
                setCheckingSetup(false);
            }
        };
        checkSetup();

        // Load remembered email
        const rememberedEmail = localStorage.getItem('billova_remembered_email');
        if (rememberedEmail) {
            setEmail(rememberedEmail);
            setRememberMe(true);
        }

        // Detect email signup confirmation hash in URL
        if (window.location.hash.includes('type=signup') || window.location.hash.includes('access_token')) {
            toast.success('🎉 Email verified successfully! Logging you into Billova POS...', { duration: 5000 });
            window.history.replaceState(null, '', window.location.pathname);
        }

        // Check if already logged in via Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                fetchUserProfile(session.user.id);
            }
        });

        // Listen for SIGNED_IN event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                fetchUserProfile(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    // Fetch user profile from profiles table
    const fetchUserProfile = async (userId: string) => {
        logger.debug('[Login] fetchUserProfile started for:', userId);
        try {
            logger.debug('[Login] Querying profiles table...');
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            logger.debug('[Login] Profile query result:', { profile, error });

            if (error) {
                logger.error('[Login] Profile query error:', error);
                throw error;
            }

            if (profile) {
                let branchData = undefined;
                let activeBranchId = profile.branch_id;

                if (!activeBranchId) {
                    logger.debug('[Login] No branch_id on profile, discovering available branch...');
                    const { data: firstBranch } = await supabase
                        .from('branches')
                        .select('id, name, subscription_plan, subscription_expiry')
                        .limit(1)
                        .maybeSingle();

                    if (firstBranch) {
                        activeBranchId = firstBranch.id;
                        await supabase
                            .from('profiles')
                            .update({ branch_id: firstBranch.id })
                            .eq('id', profile.id);
                    }
                }

                if (activeBranchId) {
                    logger.debug('[Login] Fetching branch:', activeBranchId);
                    const { data: branch } = await supabase
                        .from('branches')
                        .select('*')
                        .eq('id', activeBranchId)
                        .maybeSingle();

                    if (branch) {
                        branchData = {
                            id: branch.id,
                            name: branch.name,
                            subscriptionPlan: branch.subscription_plan,
                            subscriptionExpiry: branch.subscription_expiry,
                        };
                    }
                }

                const user = {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: profile.role?.toUpperCase() || 'CASHIER',
                    branch: branchData,
                };

                logger.debug('[Login] User constructed:', user.email, user.role);

                login('supabase-session', user);

                if (activeBranchId) {
                    loadBranchSettings(activeBranchId).catch(() => {});
                }

                toast.success('Welcome back!');

                logger.debug('[Login] Navigating based on role:', user.role);
                if (user.role === 'SUPER_ADMIN') {
                    navigate('/super-admin');
                } else {
                    navigate('/');
                }
            }
        } catch (error) {
            logger.error('[Login] Error fetching profile:', error);

            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (authUser) {
                const meta = authUser.user_metadata;
                const fallbackUser = {
                    id: authUser.id,
                    name: meta?.name || authUser.email?.split('@')[0] || 'User',
                    email: authUser.email || '',
                    role: (meta?.role || 'CASHIER').toUpperCase(),
                    branch: undefined,
                };

                logger.debug('[Login] Fallback user:', fallbackUser);
                login('supabase-session', fallbackUser);

                if (fallbackUser.role === 'SUPER_ADMIN') {
                    navigate('/super-admin');
                } else {
                    navigate('/');
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            logger.debug('[Login] Starting login...');

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            if (rememberMe) {
                localStorage.setItem('billova_remembered_email', email);
            } else {
                localStorage.removeItem('billova_remembered_email');
            }

            if (data.user) {
                logger.debug('[Login] Sign in successful, user:', data.user.email);
                await fetchUserProfile(data.user.id);
            }
        } catch (error: any) {
            logger.error('[Login] Login error:', error);
            toast.error(error.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    if (checkingSetup) {
        return (
            <div className="login-split-page">
                <div className="login-loading-state"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="login-split-page">
            <Toaster position="top-center" />

            {/* ═══════════════════════════════════════════════
               LEFT PANE: Ambient Video & Brand Showcase
               ═══════════════════════════════════════════════ */}
            <div className="login-visual-pane">
                <video
                    className="login-bg-video-stream"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster="/login-video-poster.webp"
                >
                    <source src="/1786010883001336.mp4" type="video/mp4" />
                </video>

                <div className="visual-pane-overlay" />

                {/* Top Brand Header */}
                <div className="visual-pane-header">
                    <div className="brand-pill-badge">
                        <img src="/logo.png" alt="Billova POS" className="brand-logo-img" />
                        <span className="brand-name-text">Billova POS</span>
                    </div>
                </div>

                {/* Bottom Hero Text & Indicators */}
                <div className="visual-pane-footer">
                    <motion.div
                        className="hero-text-block"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <h2 className="hero-title">Restaurant POS & Operations System</h2>
                        <p className="hero-subtitle">
                            Streamlined table billing, kitchen KOTs, godown inventory & real-time business insights.
                        </p>
                    </motion.div>

                    {/* Pagination / Feature Indicator Bars */}
                    <div className="hero-carousel-pills">
                        <span className="pill-bar active" />
                        <span className="pill-bar" />
                        <span className="pill-bar" />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               RIGHT PANE: Modern Form Card & Auth Controls
               ═══════════════════════════════════════════════ */}
            <div className="login-form-pane">
                {/* Top Right Secure Access Pill */}
                <div className="form-pane-top-bar">
                    <div className="secure-badge">
                        <ShieldCheck size={14} />
                        <span>Secure Access</span>
                    </div>
                </div>

                {/* Form Card Container */}
                <div className="login-form-container">
                    <motion.div
                        className="auth-box-card"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Title Header */}
                        <div className="auth-header">
                            <h1 className="auth-title">Welcome Back!</h1>
                            <p className="auth-subtitle">Sign in to your Billova account</p>
                        </div>

                        {/* Login Form */}
                        <form onSubmit={handleSubmit} className="auth-form-fields">
                            <div className="auth-field-group">
                                <label htmlFor="login-email">Email or Username</label>
                                <div className="auth-input-wrapper">
                                    <Mail size={18} className="auth-field-icon" />
                                    <input
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        placeholder="admin or your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="username email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="auth-field-group">
                                <label htmlFor="login-password">Password</label>
                                <div className="auth-input-wrapper">
                                    <Lock size={18} className="auth-field-icon" />
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="auth-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="auth-options-row">
                                <label className="auth-remember-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span className="auth-custom-box" />
                                    <span className="auth-remember-label">Remember Me</span>
                                </label>

                                <Link to="/forgot-password" className="auth-forgot-link">
                                    Forgot Password?
                                </Link>
                            </div>

                            <button type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading ? (
                                    <div className="spinner" />
                                ) : (
                                    <>
                                        <LogIn size={18} />
                                        <span>Login</span>
                                    </>
                                )}
                            </button>

                            {/* Security Notice Card */}
                            <div className="auth-security-notice">
                                <ShieldCheck size={16} className="security-notice-icon" />
                                <p>This system is restricted to authorized Billova personnel only. Unauthorized access is prohibited.</p>
                            </div>
                        </form>

                        {/* License / Contact Card */}
                        <div className="auth-license-card">
                            <h4>New User? Need a License?</h4>
                            <p>For subscriptions, licensing, or more details contact us:</p>
                            <div className="auth-contact-chips">
                                <a href="tel:9789399389" className="auth-contact-chip">
                                    <Phone size={12} />
                                    <span>9789399389</span>
                                </a>
                                <a href="mailto:billovabilling@gmail.com" className="auth-contact-chip">
                                    <Mail size={12} />
                                    <span>billovabilling@gmail.com</span>
                                </a>
                            </div>
                        </div>

                        {/* Barakah Tech Credit Footer */}
                        <div className="auth-developer-footer">
                            <a
                                href="https://www.barakahtechnologies.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="auth-barakah-link"
                            >
                                <span>Developed by</span>
                                <span className="barakah-badge-img">
                                    <img src="/barakah-logo.png" alt="Barakah Tech" />
                                </span>
                                <strong>BARAKAH TECH</strong>
                            </a>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
