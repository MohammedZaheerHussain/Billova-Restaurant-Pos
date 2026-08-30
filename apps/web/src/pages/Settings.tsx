import { useState } from 'react';
import {
    Store, Printer, Database, Globe, Share2, Copy, ExternalLink,
    Settings as SettingsIcon, Save, RefreshCw, Building2, MapPin,
    Phone, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../store';
import { usePrinterConfigStore } from '../printing/printer-config-store';
import { useBranchSettingsStore } from '../store/branch-settings-store';
import { useSyncStore, getSyncStatusDisplay, getTotalPending } from '../store/sync-store';
import { syncAll } from '../services/sync-service';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Switch } from '../components/ui/Switch';
import './Settings.css';

type SettingsTab = 'all' | 'branch' | 'sync' | 'printer' | 'orders' | 'menu';

// Cloud Sync Status Component
function CloudSyncStatus() {
    const { isOnline, licenseExpiredHard, pendingOrders, pendingPayments, pendingKOTs } = useSyncStore();
    const display = getSyncStatusDisplay();
    const totalPending = pendingOrders + pendingPayments + pendingKOTs;

    return (
        <div className="sync-status-box" style={{ borderColor: `${display.color}40` }}>
            <div className="sync-status-main">
                <div className="sync-status-left">
                    <div
                        className="sync-pulsing-dot"
                        style={{
                            backgroundColor: display.color,
                            boxShadow: `0 0 10px ${display.color}`
                        }}
                    />
                    <div>
                        <div className="sync-status-title" style={{ color: display.color }}>{display.text}</div>
                        <div className="sync-status-sub">
                            {isOnline ? 'Connected to cloud servers (real-time sync)' : 'Offline mode (local storage active)'}
                        </div>
                    </div>
                </div>
            </div>

            {totalPending > 0 && (
                <div className="sync-pending-strip">
                    {pendingOrders > 0 && <span className="pending-badge">📦 Orders: <strong>{pendingOrders}</strong></span>}
                    {pendingPayments > 0 && <span className="pending-badge">💳 Payments: <strong>{pendingPayments}</strong></span>}
                    {pendingKOTs > 0 && <span className="pending-badge">🍳 KOTs: <strong>{pendingKOTs}</strong></span>}
                </div>
            )}

            {licenseExpiredHard && (
                <div className="sync-license-warning">
                    ⚠️ License expired - please renew to resume cloud synchronization
                </div>
            )}
        </div>
    );
}

// Auto Sync Toggle Component
function AutoSyncToggle() {
    const { autoSyncEnabled, setAutoSync } = useSyncStore();
    return <Switch enabled={autoSyncEnabled} onChange={setAutoSync} />;
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
                toast.success(`Synced ${result.synced} items with cloud!`);
            } else if (result.failed > 0) {
                toast.error(`${result.failed} items failed to sync`);
            } else if (pending === 0) {
                toast.success('All restaurant data is already up to date!');
            }
        } finally {
            setSyncing(false);
        }
    };

    const disabled = syncing || isSyncing || !isOnline || status === 'blocked';

    return (
        <button
            className="btn btn-primary sync-action-btn"
            onClick={handleSync}
            disabled={disabled}
        >
            <RefreshCw size={15} className={syncing || isSyncing ? 'spin' : ''} />
            <span>{syncing || isSyncing ? 'Syncing data…' : `Sync Now${pending > 0 ? ` (${pending} pending)` : ''}`}</span>
        </button>
    );
}

// Last Sync Info Component
function LastSyncInfo() {
    const { lastSyncAt, lastSyncError } = useSyncStore();

    if (!lastSyncAt) return (
        <div className="last-sync-note">
            No previous sync recorded on this device
        </div>
    );

    const syncDate = new Date(lastSyncAt);
    const timeAgo = getTimeAgo(syncDate);

    return (
        <div className="last-sync-note">
            <div>Last synced: <span className="sync-highlight">{timeAgo}</span></div>
            {lastSyncError && (
                <div className="sync-error-text">⚠️ {lastSyncError}</div>
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
    const [activeTab, setActiveTab] = useState<SettingsTab>('all');

    // Printer settings from store
    const { settings: printerSettings, updateSettings: updatePrinterSettings, printers } = usePrinterConfigStore();

    // Branch settings from store
    const { settings: branchSettings, updateSettings: updateBranchSettings } = useBranchSettingsStore();

    const handleSaveChanges = async () => {
        try {
            setSaving(true);
            await new Promise(resolve => setTimeout(resolve, 300));
            toast.success('All settings saved successfully!');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const onlineMenuUrl = user?.branch?.id ? `${window.location.origin}/m/${user.branch.id}` : '';

    return (
        <div className="settings-page">
            {/* ── Page Header Toolbar (Icebox Style) ── */}
            <div className="page-header">
                <div className="header-left">
                    <h1>Settings & Configuration</h1>
                    <span className="settings-header-sub">Manage store profile, cloud sync, orders, printers & taxes</span>
                </div>

                <div className="header-actions">
                    <button
                        className="btn btn-primary save-all-btn"
                        onClick={handleSaveChanges}
                        disabled={saving}
                    >
                        {saving ? (
                            <div className="spinner" />
                        ) : (
                            <>
                                <Save size={16} />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Filter / Navigation Tabs ── */}
            <div className="settings-nav-section">
                <div className="settings-tabs-pillbar">
                    <button
                        className={`settings-nav-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Settings
                    </button>
                    <button
                        className={`settings-nav-tab ${activeTab === 'branch' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branch')}
                    >
                        Branch Profile
                    </button>
                    <button
                        className={`settings-nav-tab ${activeTab === 'sync' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sync')}
                    >
                        Cloud Sync
                    </button>
                    <button
                        className={`settings-nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        Orders & GST
                    </button>
                    <button
                        className={`settings-nav-tab ${activeTab === 'printer' ? 'active' : ''}`}
                        onClick={() => setActiveTab('printer')}
                    >
                        Printers
                    </button>
                    <button
                        className={`settings-nav-tab ${activeTab === 'menu' ? 'active' : ''}`}
                        onClick={() => setActiveTab('menu')}
                    >
                        Online Menu
                    </button>
                </div>
            </div>

            {/* ── Settings Cards Grid ── */}
            <div className="settings-grid">
                {/* 1. Branch Details Card */}
                {(activeTab === 'all' || activeTab === 'branch') && (
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box orange">
                                <Store size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>Branch Details</h3>
                                <p>Restaurant name, address and billing contact</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            <div className="form-group">
                                <label>Branch / Store Name</label>
                                <div className="input-with-icon">
                                    <Building2 size={15} className="input-icon" />
                                    <input
                                        type="text"
                                        value={branchSettings.name}
                                        onChange={(e) => updateBranchSettings({ name: e.target.value })}
                                        placeholder="e.g. Billova Bistro (Main Branch)"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Store Address</label>
                                <div className="input-with-icon">
                                    <MapPin size={15} className="input-icon" />
                                    <input
                                        type="text"
                                        value={branchSettings.address}
                                        onChange={(e) => updateBranchSettings({ address: e.target.value })}
                                        placeholder="e.g. 123 Food Street, Downtown"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Contact Phone Number</label>
                                <div className="input-with-icon">
                                    <Phone size={15} className="input-icon" />
                                    <input
                                        type="text"
                                        value={branchSettings.phone}
                                        onChange={(e) => updateBranchSettings({ phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Cloud Backup & Sync Card */}
                {(activeTab === 'all' || activeTab === 'sync') && (
                    <div className="settings-card highlight">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box cyan">
                                <Database size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>Cloud Backup & Sync</h3>
                                <p>Offline queue & cloud data synchronization</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            {/* Sync Status Box */}
                            <CloudSyncStatus />

                            {/* Auto Sync Toggle */}
                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Auto-Sync Data</span>
                                    <span className="toggle-desc">Automatically upload orders when connected to internet</span>
                                </div>
                                <AutoSyncToggle />
                            </div>

                            {/* Manual Sync Button */}
                            <SyncNowButton />

                            {/* Last Sync Info */}
                            <LastSyncInfo />
                        </div>
                    </div>
                )}

                {/* 3. Order Settings Card */}
                {(activeTab === 'all' || activeTab === 'orders') && (
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box purple">
                                <SettingsIcon size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>Order Configuration</h3>
                                <p>Order numbering, daily reset and sound alerts</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Daily Order Reset</span>
                                    <span className="toggle-desc">Reset order counter back to #1 at midnight</span>
                                </div>
                                <Switch
                                    enabled={printerSettings.dailyOrderReset}
                                    onChange={(v) => updatePrinterSettings({ dailyOrderReset: v })}
                                />
                            </div>

                            {printerSettings.dailyOrderReset && (
                                <div className="settings-info-pill-row">
                                    <span>Reset Schedule:</span>
                                    <span className="ice-badge-pill green">12:00 AM (Midnight)</span>
                                </div>
                            )}

                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Order Notification Chime</span>
                                    <span className="toggle-desc">Play chime sound when online / dine-in orders arrive</span>
                                </div>
                                <Switch
                                    enabled={printerSettings.playPrintSound}
                                    onChange={(v) => updatePrinterSettings({ playPrintSound: v })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. GST Settings Card */}
                {(activeTab === 'all' || activeTab === 'orders') && (
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box blue">
                                <Globe size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>GST & Tax Settings</h3>
                                <p>Apply tax calculations on dine-in & takeaway receipts</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Enable GST Billing</span>
                                    <span className="toggle-desc">Calculate CGST & SGST on applicable menu items</span>
                                </div>
                                <Switch
                                    enabled={branchSettings.gstEnabled}
                                    onChange={(v) => updateBranchSettings({ gstEnabled: v })}
                                />
                            </div>

                            {branchSettings.gstEnabled && (
                                <div className="form-group" style={{ marginTop: 4 }}>
                                    <label>GST Identification Number (GSTIN)</label>
                                    <div className="input-with-icon">
                                        <ShieldCheck size={15} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder="e.g. 29AAAAA0000A1Z5"
                                            value={branchSettings.gstNumber}
                                            onChange={(e) => updateBranchSettings({ gstNumber: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. Online Menu Card */}
                {(activeTab === 'all' || activeTab === 'menu') && (
                    <div className="settings-card highlight">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box orange">
                                <Share2 size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>Contactless Online Menu</h3>
                                <p>Self-ordering digital link for guests</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            <p className="settings-desc">
                                Share your live menu online with customers. Guests can view items, allergens, and order from their mobile browser without downloading any apps.
                            </p>

                            <div className="menu-link-box">
                                <input
                                    type="text"
                                    readOnly
                                    value={onlineMenuUrl || 'Branch not configured — log out and log back in'}
                                />
                                <button
                                    className="btn-icon-action"
                                    disabled={!onlineMenuUrl}
                                    onClick={() => {
                                        if (onlineMenuUrl) {
                                            navigator.clipboard.writeText(onlineMenuUrl);
                                            toast.success('Online menu URL copied!');
                                        }
                                    }}
                                    title="Copy Menu Link"
                                >
                                    <Copy size={15} />
                                </button>
                                <button
                                    className="btn-icon-action"
                                    disabled={!onlineMenuUrl}
                                    onClick={() => onlineMenuUrl && window.open(onlineMenuUrl, '_blank')}
                                    title="Open Menu in New Tab"
                                >
                                    <ExternalLink size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. Printer Settings Card */}
                {(activeTab === 'all' || activeTab === 'printer') && (
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="card-header-icon-box green">
                                <Printer size={18} />
                            </div>
                            <div className="card-header-text">
                                <h3>Receipt & KOT Printers</h3>
                                <p>Thermal printers and automated print triggers</p>
                            </div>
                        </div>

                        <div className="settings-form">
                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Auto-Print Receipt Bill</span>
                                    <span className="toggle-desc">Generate customer invoice automatically after payment</span>
                                </div>
                                <Switch
                                    enabled={printerSettings.autoPrintBill}
                                    onChange={(v) => updatePrinterSettings({ autoPrintBill: v })}
                                />
                            </div>

                            <div className="toggle-row">
                                <div className="toggle-text-wrap">
                                    <span className="toggle-label">Auto-Print Kitchen KOT</span>
                                    <span className="toggle-desc">Send KOT print job to kitchen on order creation</span>
                                </div>
                                <Switch
                                    enabled={printerSettings.autoPrintKOT}
                                    onChange={(v) => updatePrinterSettings({ autoPrintKOT: v })}
                                />
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-info-pill-row">
                                <span>Configured Hardware:</span>
                                <span className={`ice-badge-pill ${printers.length > 0 ? 'green' : 'amber'}`}>
                                    {printers.length > 0 ? `${printers.length} Printer${printers.length > 1 ? 's' : ''} Connected` : 'No Printers Added'}
                                </span>
                            </div>

                            <Link to="/printer-settings" className="btn btn-secondary advanced-printer-link">
                                <SettingsIcon size={15} />
                                <span>Advanced Printer Configuration</span>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
