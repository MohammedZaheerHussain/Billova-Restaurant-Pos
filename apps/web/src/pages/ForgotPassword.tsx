// Forgot Password Page
import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../api';
import './ForgotPassword.css';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    // Request reset mode
    const [email, setEmail] = useState('');
    const [resetLink, setResetLink] = useState('');

    // Reset password mode
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email');
            return;
        }

        try {
            setLoading(true);
            const response = await authAPI.forgotPassword(email);
            toast.success('Reset link generated!');
            if (response.data.resetLink) {
                setResetLink(response.data.resetLink);
            }
        } catch (error: any) {
            console.error('Forgot password error:', error);
            toast.error(error.response?.data?.error || 'Failed to process request');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newPassword || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        try {
            setLoading(true);
            const response = await authAPI.resetPassword(token!, newPassword);
            toast.success(response.data.message);
            navigate('/login');
        } catch (error: any) {
            console.error('Reset password error:', error);
            toast.error(error.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    // Reset password mode (with token)
    if (token) {
        return (
            <div className="forgot-password-page">
                <motion.div
                    className="forgot-password-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="forgot-password-header">
                        <span className="forgot-password-logo">🔐</span>
                        <h1>Reset Password</h1>
                        <p>Enter your new password</p>
                    </div>

                    <form onSubmit={handleResetPassword} className="forgot-password-form">
                        <div className="form-group">
                            <label>New Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoComplete="new-password"
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

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                            {loading ? (
                                <div className="spinner" />
                            ) : (
                                <>
                                    <KeyRound size={20} />
                                    Reset Password
                                </>
                            )}
                        </button>
                    </form>

                    <div className="forgot-password-footer">
                        <Link to="/login" className="back-to-login">
                            <ArrowLeft size={16} />
                            Back to Sign In
                        </Link>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Request reset mode
    return (
        <div className="forgot-password-page">
            <motion.div
                className="forgot-password-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="forgot-password-header">
                    <span className="forgot-password-logo">🔑</span>
                    <h1>Forgot Password?</h1>
                    <p>Enter your email to reset your password</p>
                </div>

                <form onSubmit={handleRequestReset} className="forgot-password-form">
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

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? (
                            <div className="spinner" />
                        ) : (
                            <>
                                <Send size={20} />
                                Send Reset Link
                            </>
                        )}
                    </button>
                </form>

                {resetLink && (
                    <motion.div
                        className="reset-link-box"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <p>Reset link generated! Copy this link:</p>
                        <code>{resetLink}</code>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                navigator.clipboard.writeText(resetLink);
                                toast.success('Link copied!');
                            }}
                        >
                            Copy Link
                        </button>
                    </motion.div>
                )}

                <div className="forgot-password-footer">
                    <Link to="/login" className="back-to-login">
                        <ArrowLeft size={16} />
                        Back to Sign In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
