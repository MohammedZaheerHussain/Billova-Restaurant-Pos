// Settings Page
import { useState } from 'react';
import { Store, Printer, Database, Globe, Share2, Copy, ExternalLink, Settings as SettingsIcon, Save } from 'lucide-react';
import { useAuthStore } from '../store';
import { usePrinterConfigStore } from '../printing/printer-config-store';
import { useBranchSettingsStore } from '../store/branch-settings-store';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Settings.css';

export default function SettingsPage() {
    const user = useAuthStore((state) => state.user);
    const [saving, setSaving] = useState(false);

    // Printer settings from store (already persisted)
    const { settings: printerSettings, updateSettings: updatePrinterSettings, printers } = usePrinterConfigStore();

    // Branch settings from store (persisted to localStorage)
    const { settings: branchSettings, updateSettings: updateBranchSettings } = useBranchSettingsStore();

    // Save all settings (just shows confirmation since Zustand auto-saves)
    const handleSaveChanges = async () => {
        try {
            setSaving(true);
            // Zustand with persist middleware already saves to localStorage automatically
            // This is just a UX confirmation
            await new Promise(resolve => setTimeout(resolve, 300));
            toast.success('Settings saved successfully!');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <div className="page-header">
                <div>
                    <h1>Settings</h1>
                    <p>Configure your POS system</p>
                </div>
                {/* Save All Button */}
                <button
                    className="btn btn-primary save-all-btn"
                    onClick={handleSaveChanges}
                    disabled={saving}
                >
                    {saving ? (
                        <>Saving...</>
                    ) : (
                        <>
                            <Save size={18} /> Save Changes
                        </>
                    )}
                </button>
            </div>

            <div className="settings-grid">
                <div className="settings-card">
                    <div className="settings-card-header">
                        <Store size={20} />
                        <h3>Branch Details</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label>Branch Name</label>
                            <input
                                type="text"
                                value={branchSettings.name}
                                onChange={(e) => updateBranchSettings({ name: e.target.value })}
                                placeholder="Enter branch name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address</label>
                            <input
                                type="text"
                                value={branchSettings.address}
                                onChange={(e) => updateBranchSettings({ address: e.target.value })}
                                placeholder="Enter address"
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                type="text"
                                value={branchSettings.phone}
                                onChange={(e) => updateBranchSettings({ phone: e.target.value })}
                                placeholder="+91 XXXXXXXXXX"
                            />
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <SettingsIcon size={20} />
                        <h3>Order Settings</h3>
                    </div>
                    <div className="settings-form">
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Daily Order Reset</span>
                                <span className="toggle-desc">Order numbers reset to #1 at midnight</span>
                            </div>
                            <button
                                className={`toggle-switch ${printerSettings.dailyOrderReset ? 'active' : ''}`}
                                onClick={() => updatePrinterSettings({ dailyOrderReset: !printerSettings.dailyOrderReset })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        {printerSettings.dailyOrderReset && (
                            <div className="info-row" style={{ marginTop: 8 }}>
                                <span>Reset Time</span>
                                <span className="badge badge-success">12:00 AM (Midnight)</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <Globe size={20} />
                        <h3>GST Settings</h3>
                    </div>
                    <div className="settings-form">
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Enable GST</span>
                                <span className="toggle-desc">Apply GST to applicable items</span>
                            </div>
                            <button
                                className={`toggle-switch ${branchSettings.gstEnabled ? 'active' : ''}`}
                                onClick={() => updateBranchSettings({ gstEnabled: !branchSettings.gstEnabled })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        {branchSettings.gstEnabled && (
                            <div className="form-group">
                                <label>GST Number</label>
                                <input
                                    type="text"
                                    placeholder="Enter GSTIN"
                                    value={branchSettings.gstNumber}
                                    onChange={(e) => updateBranchSettings({ gstNumber: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-card highlight">
                    <div className="settings-card-header">
                        <Share2 size={20} />
                        <h3>Online Menu</h3>
                    </div>
                    <div className="settings-form">
                        <p className="settings-desc">Share your menu online with customers. They can view your menu without needing to download an app.</p>
                        <div className="menu-link-box">
                            <input
                                type="text"
                                readOnly
                                value={`${window.location.origin}/m/${user?.branch?.id}`}
                            />
                            <button
                                className="btn btn-icon"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/m/${user?.branch?.id}`);
                                    toast.success('Menu link copied!');
                                }}
                            >
                                <Copy size={16} />
                            </button>
                            <button
                                className="btn btn-icon"
                                onClick={() => window.open(`/m/${user?.branch?.id}`, '_blank')}
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <Printer size={20} />
                        <h3>Printer Settings</h3>
                    </div>
                    <div className="settings-form">
                        {/* Auto-Print Bill Toggle */}
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Auto-Print Bill</span>
                                <span className="toggle-desc">Print bill automatically after payment</span>
                            </div>
                            <button
                                className={`toggle-switch ${printerSettings.autoPrintBill ? 'active' : ''}`}
                                onClick={() => updatePrinterSettings({ autoPrintBill: !printerSettings.autoPrintBill })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>

                        {/* Auto-Print KOT Toggle */}
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Auto-Print KOT</span>
                                <span className="toggle-desc">Print kitchen order ticket on order</span>
                            </div>
                            <button
                                className={`toggle-switch ${printerSettings.autoPrintKOT ? 'active' : ''}`}
                                onClick={() => updatePrinterSettings({ autoPrintKOT: !printerSettings.autoPrintKOT })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>

                        {/* Play Print Sound Toggle */}
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Print Sound</span>
                                <span className="toggle-desc">Play sound when printing</span>
                            </div>
                            <button
                                className={`toggle-switch ${printerSettings.playPrintSound ? 'active' : ''}`}
                                onClick={() => updatePrinterSettings({ playPrintSound: !printerSettings.playPrintSound })}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>

                        <div className="divider" style={{ margin: '16px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                        {/* Printer count info */}
                        <div className="info-row">
                            <span>Configured Printers</span>
                            <span className={`badge ${printers.length > 0 ? 'badge-success' : 'badge-warning'}`}>
                                {printers.length > 0 ? `${printers.length} printer${printers.length > 1 ? 's' : ''}` : 'None'}
                            </span>
                        </div>

                        {/* Link to detailed printer settings */}
                        <Link to="/printer-settings" className="btn btn-secondary" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', textDecoration: 'none' }}>
                            <SettingsIcon size={16} />
                            Advanced Printer Settings
                        </Link>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <Database size={20} />
                        <h3>Data & Sync</h3>
                    </div>
                    <div className="settings-form">
                        <div className="info-row">
                            <span>Local Database</span>
                            <span className="badge badge-success">Connected</span>
                        </div>
                        <div className="info-row">
                            <span>Cloud Sync</span>
                            <span className="badge badge-warning">Not configured</span>
                        </div>
                        <button className="btn btn-secondary" style={{ marginTop: 16 }}>
                            Configure Cloud Sync
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

