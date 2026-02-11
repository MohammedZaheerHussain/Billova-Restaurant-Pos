// Add Client Page - Like Billova Medical
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap, Building2, User, MapPin, FileText, Crown, Check, Copy, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { superAdminAPI } from '../api';
import './AddClient.css';

interface Plan {
    id: string;
    name: string;
    price: number;
    duration: string;
    features: string;
    type: 'demo' | 'yearly' | 'lifetime';
    badge?: string;
}

const plans: Plan[] = [
    // Demo
    { id: 'demo', name: 'Demo Account', price: 0, duration: '3 Days Trial', features: 'Full features for 3 days • Auto-expires', type: 'demo' },
    // 1 Year Plans
    { id: 'basic-yearly', name: 'Basic', price: 1000, duration: '1 Year', features: '200 bills/month', type: 'yearly' },
    { id: 'pro-yearly', name: 'Professional', price: 2000, duration: '1 Year', features: 'Unlimited + Reports', type: 'yearly' },
    { id: 'premium-yearly', name: 'Premium', price: 3000, duration: '1 Year', features: 'Everything + Multi-user', type: 'yearly' },
    // Lifetime Plans
    { id: 'basic-lifetime', name: 'Basic', price: 5000, duration: 'Lifetime', features: '200 bills/month', type: 'lifetime' },
    { id: 'pro-lifetime', name: 'Professional', price: 7000, duration: 'Lifetime', features: 'Unlimited + Reports', type: 'lifetime' },
    { id: 'premium-lifetime', name: 'Premium', price: 10000, duration: 'Lifetime', features: 'Everything + Multi-user', type: 'lifetime', badge: 'BEST VALUE' },
];

// Demo tier options (when Quick Demo is ON)
const demoTiers = [
    { id: 'basic', name: 'Basic', features: '200 bills/month' },
    { id: 'pro', name: 'Pro', features: 'Unlimited + Reports' },
    { id: 'premium', name: 'Premium', features: 'Everything + Multi-user' },
];

export default function AddClientPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [quickDemo, setQuickDemo] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>('');
    const [selectedDemoTier, setSelectedDemoTier] = useState<string>('premium'); // Default Premium for demo

    // Credentials modal state
    const [showCredentials, setShowCredentials] = useState(false);
    const [credentials, setCredentials] = useState({ email: '', password: '' });

    const [form, setForm] = useState({
        restaurantName: '',
        ownerName: '',
        ownerEmail: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        gstNumber: '',
        fssaiNumber: '',
        ownerPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    // Generate strong password
    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const special = '@#$%&*';
        let password = '';
        for (let i = 0; i < 8; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
        password += special.charAt(Math.floor(Math.random() * special.length));
        password += Math.floor(Math.random() * 100);
        return password;
    };

    const handleQuickDemo = async () => {
        setLoading(true);
        try {
            const timestamp = Date.now();
            const demoEmail = `demo_${timestamp}@billova.test`;
            const demoPassword = generatePassword();

            await superAdminAPI.createRestaurant({
                restaurantName: `Demo Restaurant`,
                ownerName: 'Demo User',
                ownerEmail: demoEmail,
                ownerPassword: demoPassword,
                phone: '',
                address: '',
                plan: `DEMO_${selectedDemoTier.toUpperCase()}`,
                isDemo: true,
            });

            // Show credentials modal
            setCredentials({ email: demoEmail, password: demoPassword });
            setShowCredentials(true);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create demo');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) {
            toast.error('Please select a plan');
            return;
        }
        if (!form.restaurantName || !form.ownerEmail || !form.ownerPassword) {
            toast.error('Restaurant name, email, and password are required');
            return;
        }

        const plan = plans.find(p => p.id === selectedPlan);
        const isDemo = plan?.type === 'demo';
        const planName = plan?.type === 'lifetime' ? `${plan.name.toUpperCase()}_LIFETIME` : plan?.name.toUpperCase() || 'BASIC';
        const duration = plan?.type === 'lifetime' ? 120 : plan?.type === 'demo' ? 0 : 12;

        setLoading(true);
        try {
            await superAdminAPI.createRestaurant({
                restaurantName: form.restaurantName,
                ownerName: form.ownerName,
                ownerEmail: form.ownerEmail,
                ownerPassword: form.ownerPassword,
                phone: form.phone,
                address: `${form.address}, ${form.city}, ${form.state} - ${form.pincode}`,
                gstNumber: form.gstNumber,
                plan: planName,
                licenseDuration: duration,
                isDemo,
            });

            // Show credentials modal
            setCredentials({ email: form.ownerEmail, password: form.ownerPassword });
            setShowCredentials(true);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="add-client-page">
            {/* Credentials Success Modal */}
            <AnimatePresence>
                {showCredentials && (
                    <motion.div
                        className="credentials-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="credentials-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="credentials-icon">
                                <Key size={32} />
                            </div>
                            <h2>Client Created! 🎉</h2>
                            <p className="credentials-subtitle">Share these login credentials with the restaurant</p>

                            <div className="credential-field">
                                <label>EMAIL</label>
                                <div className="credential-value">
                                    <span>{credentials.email}</span>
                                    <button onClick={() => copyToClipboard(credentials.email, 'Email')}>
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="credential-field">
                                <label>PASSWORD</label>
                                <div className="credential-value password">
                                    <span>{credentials.password}</span>
                                    <button onClick={() => copyToClipboard(credentials.password, 'Password')}>
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="credentials-warning">
                                ⚠️ Save this password! It won't be shown again.
                            </div>

                            <button
                                className="btn btn-done"
                                onClick={() => navigate('/super-admin')}
                            >
                                Done - Go to Clients
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="add-client-header">
                <button className="back-btn" onClick={() => navigate('/super-admin')}>
                    <ArrowLeft size={18} />
                    Back to Clients
                </button>
            </div>

            <motion.div
                className="add-client-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1>Add New Client</h1>

                {/* Quick Demo Toggle */}
                <div className={`quick-demo-card ${quickDemo ? 'active' : ''}`}>
                    <div className="quick-demo-info">
                        <Zap size={20} className="zap-icon" />
                        <div>
                            <h4>Quick Demo Mode</h4>
                            <p>Create a 3-day demo with one click</p>
                        </div>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={quickDemo}
                            onChange={(e) => setQuickDemo(e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                {/* Quick Demo UI - Simplified */}
                {quickDemo ? (
                    <div className="quick-demo-section">
                        <p className="demo-tier-label">Select Feature Tier:</p>
                        <div className="demo-tiers">
                            {demoTiers.map(tier => (
                                <div
                                    key={tier.id}
                                    className={`demo-tier-card ${selectedDemoTier === tier.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedDemoTier(tier.id)}
                                >
                                    <span className="tier-name">{tier.name}</span>
                                    {selectedDemoTier === tier.id && <Check size={18} className="check" />}
                                </div>
                            ))}
                        </div>
                        <p className="demo-warning-text">⚡ Demo will auto-expire after 3 days</p>

                        <button
                            type="button"
                            className="btn btn-demo full-width"
                            onClick={handleQuickDemo}
                            disabled={loading}
                        >
                            {loading ? <div className="spinner" /> : <>🚀 Create Client</>}
                        </button>
                    </div>
                ) : (
                    /* Full Form */
                    <form onSubmit={handleSubmit}>
                        {/* Restaurant Details */}
                        <section className="form-section">
                            <h3><Building2 size={18} /> RESTAURANT DETAILS</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Restaurant Name *</label>
                                    <input
                                        name="restaurantName"
                                        value={form.restaurantName}
                                        onChange={handleChange}
                                        placeholder="e.g., Pizza Palace"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Owner Name</label>
                                    <input
                                        name="ownerName"
                                        value={form.ownerName}
                                        onChange={handleChange}
                                        placeholder="Owner's name"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        name="ownerEmail"
                                        value={form.ownerEmail}
                                        onChange={handleChange}
                                        placeholder="restaurant@email.com"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                        placeholder="9876543210"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Address */}
                        <section className="form-section">
                            <h3><MapPin size={18} /> ADDRESS</h3>
                            <div className="form-group full-width">
                                <label>Street Address</label>
                                <input
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    placeholder="Street address"
                                />
                            </div>
                            <div className="form-row three-col">
                                <div className="form-group">
                                    <label>City</label>
                                    <input
                                        name="city"
                                        value={form.city}
                                        onChange={handleChange}
                                        placeholder="City"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>State</label>
                                    <input
                                        name="state"
                                        value={form.state}
                                        onChange={handleChange}
                                        placeholder="State"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Pincode</label>
                                    <input
                                        name="pincode"
                                        value={form.pincode}
                                        onChange={handleChange}
                                        placeholder="500001"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Legal Info */}
                        <section className="form-section">
                            <h3><FileText size={18} /> LEGAL INFO</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>GST Number</label>
                                    <input
                                        name="gstNumber"
                                        value={form.gstNumber}
                                        onChange={handleChange}
                                        placeholder="GST Number"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>FSSAI Number</label>
                                    <input
                                        name="fssaiNumber"
                                        value={form.fssaiNumber}
                                        onChange={handleChange}
                                        placeholder="FSSAI License"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Owner Account */}
                        <section className="form-section">
                            <h3><User size={18} /> OWNER ACCOUNT</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Password *</label>
                                    <input
                                        type="password"
                                        name="ownerPassword"
                                        value={form.ownerPassword}
                                        onChange={handleChange}
                                        placeholder="Initial password"
                                        required
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Subscription Plans */}
                        <section className="form-section plans-section">
                            <h3><Crown size={18} /> SUBSCRIPTION PLAN</h3>

                            {/* Demo Plan */}
                            <p className="plan-category demo-label">🎯 DEMO (for client presentations)</p>
                            <div
                                className={`plan-card demo-plan ${selectedPlan === 'demo' ? 'selected' : ''}`}
                                onClick={() => setSelectedPlan('demo')}
                            >
                                <div className="plan-info">
                                    <h4>Demo Account</h4>
                                    <p className="plan-price free">FREE</p>
                                    <p className="plan-duration">3 Days Trial</p>
                                    <p className="plan-features">Full features for 3 days • Auto-expires</p>
                                </div>
                                <div className="plan-badge-area">
                                    <span className="use-case">Perfect for<br />Client Demos</span>
                                    {selectedPlan === 'demo' && <Check size={20} className="check-icon" />}
                                </div>
                            </div>

                            {/* 1 Year Plans */}
                            <p className="plan-category">🏷️ 1 YEAR PLANS</p>
                            <div className="plans-grid">
                                {plans.filter(p => p.type === 'yearly').map(plan => (
                                    <div
                                        key={plan.id}
                                        className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedPlan(plan.id)}
                                    >
                                        <h4>{plan.name}</h4>
                                        <p className="plan-price">₹{plan.price.toLocaleString()}</p>
                                        <p className="plan-duration">{plan.duration}</p>
                                        <p className="plan-features">{plan.features}</p>
                                        {selectedPlan === plan.id && <Check size={18} className="check-icon" />}
                                    </div>
                                ))}
                            </div>

                            {/* Lifetime Plans */}
                            <p className="plan-category">∞ LIFETIME PLANS</p>
                            <div className="plans-grid">
                                {plans.filter(p => p.type === 'lifetime').map(plan => (
                                    <div
                                        key={plan.id}
                                        className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.badge ? 'has-badge' : ''}`}
                                        onClick={() => setSelectedPlan(plan.id)}
                                    >
                                        {plan.badge && <span className="best-value-badge">{plan.badge}</span>}
                                        <h4>{plan.name}</h4>
                                        <p className="plan-price lifetime">₹{plan.price.toLocaleString()}</p>
                                        <p className="plan-duration">{plan.duration}</p>
                                        <p className="plan-features">{plan.features}</p>
                                        {selectedPlan === plan.id && <Check size={18} className="check-icon" />}
                                    </div>
                                ))}
                            </div>

                            <p className="selected-plan">
                                <strong>Selected:</strong> {selectedPlan ? plans.find(p => p.id === selectedPlan)?.name : 'Click a plan to select'}
                            </p>
                        </section>

                        {/* Submit */}
                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <div className="spinner" /> : <><Building2 size={18} /> Create Client</>}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
