// Login Page
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { authAPI } from '../api';
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

    // Check if setup is needed
    useEffect(() => {
        const checkSetup = async () => {
            try {
                const res = await api.get('/auth/check-setup');
                if (!res.data.isSetupComplete) {
                    navigate('/setup');
                    return;
                }
            } catch (error) {
                // API might fail, continue to login
            } finally {
                setCheckingSetup(false);
            }
        };
        checkSetup();

        // Load remembered email
        const rememberedEmail = localStorage.getItem('dfc_remembered_email');
        if (rememberedEmail) {
            setEmail(rememberedEmail);
            setRememberMe(true);
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            const response = await authAPI.login(email, password);

            // Handle remember me
            if (rememberMe) {
                localStorage.setItem('dfc_remembered_email', email);
            } else {
                localStorage.removeItem('dfc_remembered_email');
            }

            login(response.data.token, response.data.user);
            toast.success('Welcome back!');
            navigate('/');
        } catch (error: any) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.error || 'Login failed');
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
                        <label>Email</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
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
                </form>

                <div className="login-footer">
                    <p>Don't have an account?</p>
                    <Link to="/register" className="create-account-link">
                        Create Account
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
