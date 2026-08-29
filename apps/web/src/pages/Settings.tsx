// Settings Page
import { useState } from 'react';
import { Store, Printer, Database, Globe, Share2, Copy, ExternalLink, Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store';
import { usePrinterConfigStore } from '../printing/printer-config-store';
import { useBranchSettingsStore } from '../store/branch-settings-store';
import { useSyncStore, getSyncStatusDisplay, getTotalPending } from '../store/sync-store';
import { syncAll } from '../services/sync-service';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Switch } from '../components/ui/Switch';
import './Settings.css';

// Cloud Sync Status Component
function CloudSyncStatus() {
    const { isOnline, licenseExpiredHard, pendingOrders, pendingPayments, pendingKOTs } = useSyncStore();
    const display = getSyncStatusDisplay();
    const totalPending = pendingOrders + pendingPayments + pendingKOTs;

    return (
        <div className="sync-status-box" style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: `1px solid ${display.color}33`,
            boxShadow: `0 4px 16px ${display.color}10`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: display.color,
                        boxShadow: `0 0 10px ${display.color}`,
                        animation: isOnline ? 'pulse 2s infinite' : 'none',
                    }} />
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: display.color }}>{display.text}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                            {isOnline ? '🌐 Connected to cloud servers' : '📡 Offline mode (local storage active)'}
                        </div>
                    </div>
                </div>
            </div>

            {totalPending > 0 && (
                <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    gap: 16,
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                }}>
                    {pendingOrders > 0 && <span>📦 Orders: <strong>{pendingOrders}</strong></span>}
                    {pendingPayments > 0 && <span>💳 Payments: <strong>{pendingPayments}</strong></span>}
                    {pendingKOTs > 0 && <span>🍳 KOTs: <strong>{pendingKOTs}</strong></span>}
                </div>
            )}

            {licenseExpiredHard && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>
                    ⚠️ License expired - please renew to sync
                </div>
            )}
        </div>
    );
}

// Auto Sync Toggle Component
function AutoSyncToggle() {
    const { autoSyncEnabled, setAutoSync } = useSyncStore();

    return (
        <Switch enabled={autoSyncEnabled} onChange={setAutoSync} />
    );
}

// Sync Now Button Component
function SyncNowButton() {
    const { isSyncing, status, isOnline } = useSyncStore();
    const [syncing, setSyncing] = useState(false);
    const pending = getTotalPending();

    const handleSync = async () => {
        if (syncing || isSyncing) return;
        setSyncing(true);
        try {
            const result = await syncAll();
            if (result.synced > 0) {
                toast.success(`Synced ${result.synced} items!`);
            } else if (result.failed > 0) {
                toast.error(`${result.failed} items failed to sync`);
            } else if (pending === 0) {
                toast.success('All data is already up to date!');
            }
        } finally {
            setSyncing(false);
        }
    };

    const disabled = syncing || isSyncing || !isOnline || status === 'blocked';

    return (
        <button
            className="btn btn-primary"
            style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                fontWeight: 600
            }}
            onClick={handleSync}
            disabled={disabled}
        >
            <RefreshCw size={16} className={syncing || isSyncing ? 'spin' : ''} />
            {syncing || isSyncing ? 'Syncing with cloud...' : `Sync Now${pending > 0 ? ` (${pending} pending)` : ''}`}
        </button>
    );
}

// Last Sync Info Component
function LastSyncInfo() {
    const { lastSyncAt, lastSyncError } = useSyncStore();

    if (!lastSyncAt) return (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            No previous sync recorded
        </div>
    );

    const syncDate = new Date(lastSyncAt);
    const timeAgo = getTimeAgo(syncDate);

    return (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            <div>Last synced: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{timeAgo}</span></div>
            {lastSyncError && (
                <div style={{ color: '#ef4444', marginTop: 4 }}>⚠️ {lastSyncError}</div>
            )}
        </div>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

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
                            <Switch
                                enabled={printerSettings.dailyOrderReset}
                                onChange={(v) => updatePrinterSettings({ dailyOrderReset: v })}
                            />
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
                            <Switch
                                enabled={branchSettings.gstEnabled}
                                onChange={(v) => updateBranchSettings({ gstEnabled: v })}
                            />
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
                                value={user?.branch?.id ? `${window.location.origin}/m/${user.branch.id}` : 'Branch not configured — log out and log back in'}
                            />
                            <button
                                className="btn btn-icon"
                                disabled={!user?.branch?.id}
                                onClick={() => {
                                    if (user?.branch?.id) {
                                        navigator.clipboard.writeText(`${window.location.origin}/m/${user.branch.id}`);
                                        toast.success('Menu link copied!');
                                    }
                                }}
                            >
                                <Copy size={16} />
                            </button>
                            <button
                                className="btn btn-icon"
                                disabled={!user?.branch?.id}
                                onClick={() => user?.branch?.id && window.open(`/m/${user.branch.id}`, '_blank')}
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
                            <Switch
                                enabled={printerSettings.autoPrintBill}
                                onChange={(v) => updatePrinterSettings({ autoPrintBill: v })}
                            />
                        </div>

                        {/* Auto-Print KOT Toggle */}
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Auto-Print KOT</span>
                                <span className="toggle-desc">Print kitchen order ticket on order</span>
                            </div>
                            <Switch
                                enabled={printerSettings.autoPrintKOT}
                                onChange={(v) => updatePrinterSettings({ autoPrintKOT: v })}
                            />
                        </div>

                        {/* Play Print Sound Toggle */}
                        <div className="toggle-row">
                            <div>
                                <span className="toggle-label">Print Sound</span>
                                <span className="toggle-desc">Play sound when printing</span>
                            </div>
                            <Switch
                                enabled={printerSettings.playPrintSound}
                                onChange={(v) => updatePrinterSettings({ playPrintSound: v })}
                            />
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

                <div className="settings-card highlight">
                    <div className="settings-card-header">
                        <Database size={20} />
                        <h3>Cloud Backup</h3>
                    </div>
                    <div className="settings-form">
                        {/* Sync Status Display */}
                        <CloudSyncStatus />

                        {/* Auto-Sync Toggle */}
                        <div className="toggle-row" style={{ marginTop: 16 }}>
                            <div>
                                <span className="toggle-label">Auto-Sync</span>
                                <span className="toggle-desc">Automatically sync when connected to internet</span>
                            </div>
                            <AutoSyncToggle />
                        </div>

                        {/* Manual Sync Button */}
                        <SyncNowButton />

                        {/* Last Sync Info */}
                        <LastSyncInfo />
                    </div>
                </div>
            </div>
        </div>
    );
}

