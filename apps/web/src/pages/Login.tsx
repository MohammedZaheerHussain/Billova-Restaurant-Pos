// Login Page - Supabase Auth Only
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import api from '../api';
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
                // Check cache first
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
                // Cache the result
                sessionStorage.setItem('billova_setup_checked', 'complete');
            } catch (error) {
                // API might fail, continue to login
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

        // Check if already logged in via Supabase
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Already logged in, fetch user profile and redirect
                fetchUserProfile(session.user.id);
            }
        });
    }, [navigate]);

    // Fetch user profile from profiles table
    const fetchUserProfile = async (userId: string) => {
        logger.debug('[Login] fetchUserProfile started for:', userId);
        try {
            // Fetch profile first without branch join
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

                // Only fetch branch if branch_id exists
                if (profile.branch_id) {
                    logger.debug('[Login] Fetching branch:', profile.branch_id);
                    const { data: branch } = await supabase
                        .from('branches')
                        .select('*')
                        .eq('id', profile.branch_id)
                        .single();

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

                // Store user in Zustand (token not needed for Supabase auth)
                login('supabase-session', user);
                toast.success('Welcome back!');

                logger.debug('[Login] Navigating based on role:', user.role);
                // Redirect based on role
                if (user.role === 'SUPER_ADMIN') {
                    navigate('/super-admin');
                } else {
                    navigate('/');
                }
            }
        } catch (error) {
            logger.error('[Login] Error fetching profile:', error);

            // FALLBACK: Try to use Supabase user metadata
            logger.debug('[Login] Attempting fallback with user metadata...');
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

            // Supabase Auth Sign In
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            // Handle remember me
            if (rememberMe) {
                localStorage.setItem('billova_remembered_email', email);
            } else {
                localStorage.removeItem('billova_remembered_email');
            }

            if (data.user) {
                logger.debug('[Login] Sign in successful, user:', data.user.email);

                // Fetch full profile with branch data
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
            <div className="login-page">
                <div className="loading-state"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <motion.div
                className="login-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="login-header">
                    <img src="/logo.png" alt="Billova POS" className="login-logo-img" />
                    <h1>Billova POS</h1>
                    <p>Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="login-email">Email</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                id="login-email"
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="username email"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="login-password">Password</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="login-options">
                        <label className="remember-me">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span className="checkmark"></span>
                            Remember me
                        </label>
                        <Link to="/forgot-password" className="forgot-password-link">
                            Forgot Password?
                        </Link>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? (
                            <div className="spinner" />
                        ) : (
                            <>
                                <LogIn size={20} />
                                Sign In
                            </>
                        )}
                    </button>

                    <p className="forgot-hint">Contact your restaurant admin if you forgot your password</p>
                </form>

                {/* Contact Panel - Like Billova Medical */}
                <div className="license-panel">
                    <h4>New User? Need a License?</h4>
                    <p>For subscriptions, licensing, or more details contact us:</p>
                    <div className="contact-info">
                        <a href="tel:9789399389" className="contact-item">📞 9789399389</a>
                        <a href="mailto:billovabilling@gmail.com" className="contact-item">✉️ billovabilling@gmail.com</a>
                    </div>
                </div>

                <p className="powered-by">Powered by Billova</p>
            </motion.div>
        </div>
    );
}
