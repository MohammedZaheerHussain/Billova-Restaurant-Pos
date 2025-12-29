// First-Time Setup Page - Create Super Admin Account
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, User, Mail, Lock, Building2, Phone, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import billovaLogo from '../assets/billova-logo.png';
import './Setup.css';

export default function SetupPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        // Super Admin details
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
        // Company details
        companyName: 'Billova',
        companyAddress: '',
    });

    useEffect(() => {
        checkSetup();
    }, []);

    const checkSetup = async () => {
        try {
            const res = await api.get('/auth/check-setup');
            if (res.data.isSetupComplete) {
                // Already set up, go to login
                navigate('/login');
            }
        } catch (error) {
            // Setup API might not exist yet, continue with setup
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (step === 1) {
            if (!formData.adminName || !formData.adminEmail || !formData.adminPassword) {
                toast.error('Please fill all required fields');
                return;
            }
            setStep(2);
            return;
        }

        // Step 2 - Final submit
        try {
            setSaving(true);
            await api.post('/auth/setup', {
                adminName: formData.adminName,
                adminEmail: formData.adminEmail,
                adminPassword: formData.adminPassword,
                adminPhone: formData.adminPhone,
                companyName: formData.companyName,
            });

            toast.success('Setup complete! Please login.');
            navigate('/login');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Setup failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="setup-page">
                <div className="loading-state"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="setup-page">
            <motion.div
                className="setup-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="setup-header">
                    <img src={billovaLogo} alt="Billova" className="setup-logo" />
                    <h1>Welcome to Billova</h1>
                    <p>Let's set up your admin account</p>
                </div>

                {/* Progress Steps */}
                <div className="setup-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <span>Admin Account</span>
                    </div>
                    <div className="progress-line" />
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <span>Confirm</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="setup-form">
                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="form-step"
                        >
                            <h3><Shield size={20} /> Create Your Admin Account</h3>
                            <p className="step-desc">This will be your master account to manage everything.</p>

                            <div className="form-group">
                                <label><User size={16} /> Your Name *</label>
                                <input
                                    type="text"
                                    value={formData.adminName}
                                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                                    placeholder="Enter your name"
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label><Mail size={16} /> Email *</label>
                                <input
                                    type="email"
                                    value={formData.adminEmail}
                                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                                    placeholder="admin@yourcompany.com"
                                />
                            </div>

                            <div className="form-group">
                                <label><Lock size={16} /> Password *</label>
                                <input
                                    type="password"
                                    value={formData.adminPassword}
                                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                                    placeholder="Create a strong password"
                                />
                            </div>

                            <div className="form-group">
                                <label><Phone size={16} /> Phone (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.adminPhone}
                                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                                    placeholder="+91 9876543210"
                                />
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg">
                                Continue <ArrowRight size={18} />
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="form-step"
                        >
                            <h3><Building2 size={20} /> Confirm Setup</h3>
                            <p className="step-desc">Review your details before creating your account.</p>

                            <div className="review-box">
                                <div className="review-item">
                                    <span className="review-label">Name</span>
                                    <span className="review-value">{formData.adminName}</span>
                                </div>
                                <div className="review-item">
                                    <span className="review-label">Email</span>
                                    <span className="review-value">{formData.adminEmail}</span>
                                </div>
                                <div className="review-item">
                                    <span className="review-label">Role</span>
                                    <span className="review-value role-badge">Super Admin</span>
                                </div>
                            </div>

                            <div className="info-box">
                                <p>✅ After setup, you can:</p>
                                <ul>
                                    <li>Create customer accounts</li>
                                    <li>Manage licenses & subscriptions</li>
                                    <li>Handle password resets</li>
                                    <li>View support tickets</li>
                                </ul>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                                    Back
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <div className="spinner" /> : 'Complete Setup'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </form>
            </motion.div>
        </div>
    );
}
