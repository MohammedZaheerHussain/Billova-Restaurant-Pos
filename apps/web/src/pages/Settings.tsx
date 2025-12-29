// Settings Page
import { useState } from 'react';
import { Settings as SettingsIcon, Store, Printer, Wifi, Database, Globe } from 'lucide-react';
import { useAuthStore } from '../store';
import './Settings.css';

export default function SettingsPage() {
    const user = useAuthStore((state) => state.user);
    const [gstEnabled, setGstEnabled] = useState(false);

    return (
        <div className="settings-page">
            <div className="page-header">
                <div>
                    <h1>Settings</h1>
                    <p>Configure your POS system</p>
                </div>
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
                            <input type="text" defaultValue={user?.branch?.name || 'DFC - Main Branch'} />
                        </div>
                        <div className="form-group">
                            <label>Address</label>
                            <input type="text" defaultValue="Vellore, Tamil Nadu" />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input type="text" defaultValue="+91 9876543210" />
                        </div>
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
                                className={`toggle-switch ${gstEnabled ? 'active' : ''}`}
                                onClick={() => setGstEnabled(!gstEnabled)}
                            >
                                <span className="toggle-knob" />
                            </button>
                        </div>
                        {gstEnabled && (
                            <div className="form-group">
                                <label>GST Number</label>
                                <input type="text" placeholder="Enter GSTIN" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-header">
                        <Printer size={20} />
                        <h3>Printer Settings</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label>Receipt Printer</label>
                            <select>
                                <option>Not configured</option>
                                <option>USB Thermal Printer</option>
                                <option>Network Printer</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>KOT Printer</label>
                            <select>
                                <option>Same as receipt</option>
                                <option>Kitchen Printer</option>
                            </select>
                        </div>
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
