// Register Page
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, Eye, EyeOff, User, Phone, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../api';
import './Register.css';

export default function RegisterPage() {
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !password || !confirmPassword) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        try {
            setLoading(true);
            const response = await authAPI.register({ name, email, password, phone: phone || undefined });
            toast.success(response.data.message);
            navigate('/login');
        } catch (error: any) {
            console.error('Registration error:', error);
            toast.error(error.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = () => {
        if (!password) return { level: 0, text: '', color: '' };
        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        if (strength <= 2) return { level: strength, text: 'Weak', color: 'var(--secondary)' };
        if (strength <= 3) return { level: strength, text: 'Medium', color: '#f59e0b' };
        return { level: strength, text: 'Strong', color: 'var(--success)' };
    };

    const passwordStrength = getPasswordStrength();

    return (
        <div className="register-page">
            <motion.div
                className="register-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="register-header">
                    <img src="/billova-logo.png" alt="Billova" className="register-logo" style={{ width: '64px', height: '64px' }} />
                    <h1>Create Account</h1>
                    <p>Join Billova POS</p>
                </div>

                <form onSubmit={handleSubmit} className="register-form">
                    <div className="form-group">
                        <label>Full Name *</label>
                        <div className="input-wrapper">
                            <User size={18} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email *</label>
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
                        <label>Phone (Optional)</label>
                        <div className="input-wrapper">
                            <Phone size={18} className="input-icon" />
                            <input
                                type="tel"
                                placeholder="Enter your phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password *</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                        {password && (
                            <div className="password-strength">
                                <div className="strength-bars">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="strength-bar"
                                            style={{
                                                backgroundColor: i <= passwordStrength.level ? passwordStrength.color : 'var(--border)'
                                            }}
                                        />
                                    ))}
                                </div>
                                <span style={{ color: passwordStrength.color }}>{passwordStrength.text}</span>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Confirm Password *</label>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                            <span className="field-error">Passwords do not match</span>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? (
                            <div className="spinner" />
                        ) : (
                            <>
                                <UserPlus size={20} />
                                Create Account
                            </>
                        )}
                    </button>
                </form>

                <div className="register-footer">
                    <Link to="/login" className="back-to-login">
                        <ArrowLeft size={16} />
                        Back to Sign In
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
