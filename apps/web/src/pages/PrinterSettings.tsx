// Printer Settings Page - Configure printers and print settings
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Printer,
    Plus,
    Trash2,
    Settings,
    Wifi,
    Bluetooth,
    Usb,
    Globe,
    Check,
    X,
    Play,
    Upload,
    Image,
    AlertCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { usePrinterConfigStore, PrinterConfig, PrintJobType } from '../printing/printer-config-store';
import { printService } from '../printing';
import { ESCPOSEncoder, TextAlign, CutType } from '../printing/escpos/escpos-encoder';
import './PrinterSettings.css';

// Printer type icons
const printerTypeIcons = {
    browser: Globe,
    usb: Usb,
    bluetooth: Bluetooth,
    network: Wifi,
};

const printerTypeLabels = {
    browser: 'Browser Print',
    usb: 'USB Printer',
    bluetooth: 'Bluetooth',
    network: 'Network/WiFi',
};

const jobTypeLabels: Record<PrintJobType, string> = {
    bill: 'Bills/Receipts',
    kot: 'Kitchen Order Tickets',
    bar: 'Bar/Drinks Orders',
    report: 'Reports',
};

export default function PrinterSettings() {
    const {
        printers,
        settings,
        addPrinter,
        updatePrinter,
        removePrinter,
        setDefaultPrinter,
        updateSettings,
        updateLogo,
    } = usePrinterConfigStore();

    const [showAddModal, setShowAddModal] = useState(false);
    const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string>('printers');
    const logoInputRef = useRef<HTMLInputElement>(null);

    // New printer form state
    const [newPrinter, setNewPrinter] = useState<Partial<PrinterConfig>>({
        name: '',
        type: 'browser',
        paperWidth: 80,
        isActive: true,
        jobTypes: ['bill'],
        copies: 1,
        autoCut: true,
        openCashDrawer: false,
        beepOnPrint: false,
    });

    const handleAddPrinter = () => {
        if (!newPrinter.name) return;

        addPrinter({
            name: newPrinter.name,
            type: newPrinter.type || 'browser',
            address: newPrinter.address,
            paperWidth: newPrinter.paperWidth || 80,
            isDefault: printers.length === 0,
            isActive: newPrinter.isActive ?? true,
            jobTypes: newPrinter.jobTypes || ['bill'],
            copies: newPrinter.copies || 1,
            autoCut: newPrinter.autoCut ?? true,
            openCashDrawer: newPrinter.openCashDrawer ?? false,
            beepOnPrint: newPrinter.beepOnPrint ?? false,
        });

        setShowAddModal(false);
        setNewPrinter({
            name: '',
            type: 'browser',
            paperWidth: 80,
            isActive: true,
            jobTypes: ['bill'],
            copies: 1,
            autoCut: true,
            openCashDrawer: false,
            beepOnPrint: false,
        });
    };

    const handleTestPrint = async (printer: PrinterConfig) => {
        setTestingPrinter(printer.id);

        try {
            const encoder = new ESCPOSEncoder({ width: printer.paperWidth === 80 ? 48 : 32 });

            encoder.initialize();
            encoder.align(TextAlign.CENTER);
            encoder.bold(true);
            encoder.line('*** TEST PRINT ***');
            encoder.bold(false);
            encoder.feed(1);
            encoder.line('Billova POS');
            encoder.line(`Printer: ${printer.name}`);
            encoder.line(`Type: ${printerTypeLabels[printer.type]}`);
            encoder.line(`Paper: ${printer.paperWidth}mm`);
            encoder.feed(1);
            encoder.line(new Date().toLocaleString('en-IN'));
            encoder.feed(1);
            encoder.divider('-');
            encoder.line('If you can read this,');
            encoder.line('your printer is working!');
            encoder.divider('-');

            if (printer.autoCut) {
                encoder.cut(CutType.PARTIAL);
            }

            if (printer.beepOnPrint) {
                encoder.beep(2, 100);
            }

            const result = await printService.print(encoder, printer.type, printer.address);

            if (!result.success) {
                alert(`Print failed: ${result.error}`);
            }
        } catch (error) {
            alert(`Print error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setTestingPrinter(null);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            updateLogo({ imageData: result, enabled: true });
        };
        reader.readAsDataURL(file);
    };

    const toggleJobType = (printerId: string, jobType: PrintJobType) => {
        const printer = printers.find((p) => p.id === printerId);
        if (!printer) return;

        const currentTypes = printer.jobTypes || [];
        const newTypes = currentTypes.includes(jobType)
            ? currentTypes.filter((t) => t !== jobType)
            : [...currentTypes, jobType];

        updatePrinter(printerId, { jobTypes: newTypes });
    };

    const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
        <button
            className="section-header"
            onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
        >
            <div className="section-title">
                <Icon size={20} />
                <span>{title}</span>
            </div>
            {expandedSection === id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
    );

    return (
        <div className="printer-settings-page">
            <div className="settings-header">
                <h1>
                    <Printer size={28} />
                    Printer Settings
                </h1>
                <p>Configure printers and print settings for your POS</p>
            </div>

            {/* Printers Section */}
            <div className="settings-section">
                <SectionHeader id="printers" title="Configured Printers" icon={Printer} />
                <AnimatePresence>
                    {expandedSection === 'printers' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="section-content"
                        >
                            <div className="printers-list">
                                {printers.length === 0 ? (
                                    <div className="empty-state">
                                        <Printer size={48} />
                                        <p>No printers configured</p>
                                        <button onClick={() => setShowAddModal(true)}>
                                            <Plus size={16} /> Add Printer
                                        </button>
                                    </div>
                                ) : (
                                    printers.map((printer) => {
                                        const Icon = printerTypeIcons[printer.type];
                                        return (
                                            <div
                                                key={printer.id}
                                                className={`printer-card ${printer.isDefault ? 'default' : ''} ${!printer.isActive ? 'inactive' : ''}`}
                                            >
                                                <div className="printer-header">
                                                    <div className="printer-icon">
                                                        <Icon size={24} />
                                                    </div>
                                                    <div className="printer-info">
                                                        <h3>{printer.name}</h3>
                                                        <span className="printer-type">
                                                            {printerTypeLabels[printer.type]} • {printer.paperWidth}mm
                                                        </span>
                                                        {printer.address && (
                                                            <span className="printer-address">{printer.address}</span>
                                                        )}
                                                    </div>
                                                    <div className="printer-badges">
                                                        {printer.isDefault && (
                                                            <span className="badge default">Default</span>
                                                        )}
                                                        {!printer.isActive && (
                                                            <span className="badge inactive">Inactive</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="printer-jobs">
                                                    <span className="label">Print Jobs:</span>
                                                    <div className="job-tags">
                                                        {Object.entries(jobTypeLabels).map(([type, label]) => (
                                                            <button
                                                                key={type}
                                                                className={`job-tag ${printer.jobTypes.includes(type as PrintJobType) ? 'active' : ''}`}
                                                                onClick={() => toggleJobType(printer.id, type as PrintJobType)}
                                                            >
                                                                {label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="printer-actions">
                                                    <button
                                                        className="test-btn"
                                                        onClick={() => handleTestPrint(printer)}
                                                        disabled={testingPrinter === printer.id}
                                                    >
                                                        {testingPrinter === printer.id ? (
                                                            <RefreshCw size={16} className="spin" />
                                                        ) : (
                                                            <Play size={16} />
                                                        )}
                                                        Test Print
                                                    </button>
                                                    <button
                                                        className="toggle-btn"
                                                        onClick={() =>
                                                            updatePrinter(printer.id, { isActive: !printer.isActive })
                                                        }
                                                    >
                                                        {printer.isActive ? <X size={16} /> : <Check size={16} />}
                                                        {printer.isActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                    {!printer.isDefault && (
                                                        <button
                                                            className="default-btn"
                                                            onClick={() => setDefaultPrinter(printer.id)}
                                                        >
                                                            Set Default
                                                        </button>
                                                    )}
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => {
                                                            if (confirm('Delete this printer?')) {
                                                                removePrinter(printer.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <button className="add-printer-btn" onClick={() => setShowAddModal(true)}>
                                <Plus size={20} /> Add Printer
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Auto-Print Settings */}
            <div className="settings-section">
                <SectionHeader id="autoprint" title="Auto-Print Settings" icon={Settings} />
                <AnimatePresence>
                    {expandedSection === 'autoprint' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="section-content"
                        >
                            <div className="settings-grid">
                                <label className="setting-toggle">
                                    <span>Auto-Print KOT on Order</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.autoPrintKOT}
                                        onChange={(e) => updateSettings({ autoPrintKOT: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                <label className="setting-toggle">
                                    <span>Auto-Print Bill on Payment</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.autoPrintBill}
                                        onChange={(e) => updateSettings({ autoPrintBill: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                <label className="setting-toggle">
                                    <span>Play Sound on Print</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.playPrintSound}
                                        onChange={(e) => updateSettings({ playPrintSound: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Receipt Settings */}
            <div className="settings-section">
                <SectionHeader id="receipt" title="Receipt Settings" icon={Settings} />
                <AnimatePresence>
                    {expandedSection === 'receipt' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="section-content"
                        >
                            <div className="settings-grid">
                                <label className="setting-toggle">
                                    <span>Show GST Breakdown (CGST/SGST)</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.showGSTBreakdown}
                                        onChange={(e) => updateSettings({ showGSTBreakdown: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                <label className="setting-toggle">
                                    <span>Show FSSAI Number</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.showFSSAI}
                                        onChange={(e) => updateSettings({ showFSSAI: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                <label className="setting-toggle">
                                    <span>Print UPI QR Code</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.printQRCode}
                                        onChange={(e) => updateSettings({ printQRCode: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                {settings.printQRCode && (
                                    <div className="setting-input">
                                        <label>UPI ID</label>
                                        <input
                                            type="text"
                                            placeholder="yourname@upi"
                                            value={settings.upiId || ''}
                                            onChange={(e) => updateSettings({ upiId: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="setting-input full-width">
                                    <label>Footer Text</label>
                                    <textarea
                                        rows={2}
                                        value={settings.footerText}
                                        onChange={(e) => updateSettings({ footerText: e.target.value })}
                                        placeholder="Thank you for your visit!"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Logo Settings */}
            <div className="settings-section">
                <SectionHeader id="logo" title="Logo Settings" icon={Image} />
                <AnimatePresence>
                    {expandedSection === 'logo' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="section-content"
                        >
                            <div className="logo-settings">
                                <label className="setting-toggle">
                                    <span>Print Logo on Receipts</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.logo.enabled}
                                        onChange={(e) => updateLogo({ enabled: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>

                                <div className="logo-preview">
                                    {settings.logo.imageData ? (
                                        <img src={settings.logo.imageData} alt="Logo" />
                                    ) : (
                                        <div className="no-logo">
                                            <Image size={48} />
                                            <span>No logo uploaded</span>
                                        </div>
                                    )}
                                </div>

                                <div className="logo-actions">
                                    <input
                                        ref={logoInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <button onClick={() => logoInputRef.current?.click()}>
                                        <Upload size={16} /> Upload Logo
                                    </button>
                                    {settings.logo.imageData && (
                                        <button
                                            className="remove-logo"
                                            onClick={() => updateLogo({ imageData: undefined, enabled: false })}
                                        >
                                            <Trash2 size={16} /> Remove
                                        </button>
                                    )}
                                </div>

                                <div className="logo-options">
                                    <div className="setting-input">
                                        <label>Logo Width (pixels)</label>
                                        <input
                                            type="number"
                                            min={50}
                                            max={384}
                                            value={settings.logo.width}
                                            onChange={(e) => updateLogo({ width: parseInt(e.target.value) || 200 })}
                                        />
                                    </div>

                                    <div className="setting-input">
                                        <label>Alignment</label>
                                        <select
                                            value={settings.logo.alignment}
                                            onChange={(e) =>
                                                updateLogo({ alignment: e.target.value as 'left' | 'center' | 'right' })
                                            }
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="logo-tip">
                                    <AlertCircle size={16} />
                                    <span>For best results, use a high-contrast monochrome image (black/white)</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Add Printer Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            className="modal-content"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>Add Printer</h2>
                                <button onClick={() => setShowAddModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Printer Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Kitchen Printer"
                                        value={newPrinter.name || ''}
                                        onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Connection Type</label>
                                    <div className="type-options">
                                        {Object.entries(printerTypeLabels).map(([type, label]) => {
                                            const Icon = printerTypeIcons[type as keyof typeof printerTypeIcons];
                                            return (
                                                <button
                                                    key={type}
                                                    className={`type-option ${newPrinter.type === type ? 'active' : ''}`}
                                                    onClick={() => setNewPrinter({ ...newPrinter, type: type as any })}
                                                >
                                                    <Icon size={24} />
                                                    <span>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {newPrinter.type === 'network' && (
                                    <div className="form-group">
                                        <label>IP Address : Port</label>
                                        <input
                                            type="text"
                                            placeholder="192.168.1.100:9100"
                                            value={newPrinter.address || ''}
                                            onChange={(e) => setNewPrinter({ ...newPrinter, address: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Paper Width</label>
                                        <select
                                            value={newPrinter.paperWidth}
                                            onChange={(e) =>
                                                setNewPrinter({ ...newPrinter, paperWidth: parseInt(e.target.value) as 80 | 58 })
                                            }
                                        >
                                            <option value={80}>80mm (Standard)</option>
                                            <option value={58}>58mm (Small)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Copies</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={5}
                                            value={newPrinter.copies}
                                            onChange={(e) =>
                                                setNewPrinter({ ...newPrinter, copies: parseInt(e.target.value) || 1 })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Print Job Types</label>
                                    <div className="checkbox-group">
                                        {Object.entries(jobTypeLabels).map(([type, label]) => (
                                            <label key={type} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={newPrinter.jobTypes?.includes(type as PrintJobType)}
                                                    onChange={(e) => {
                                                        const current = newPrinter.jobTypes || [];
                                                        setNewPrinter({
                                                            ...newPrinter,
                                                            jobTypes: e.target.checked
                                                                ? [...current, type as PrintJobType]
                                                                : current.filter((t) => t !== type),
                                                        });
                                                    }}
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="checkbox-group options">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={newPrinter.autoCut}
                                            onChange={(e) => setNewPrinter({ ...newPrinter, autoCut: e.target.checked })}
                                        />
                                        Auto-cut paper
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={newPrinter.openCashDrawer}
                                            onChange={(e) =>
                                                setNewPrinter({ ...newPrinter, openCashDrawer: e.target.checked })
                                            }
                                        />
                                        Open cash drawer
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={newPrinter.beepOnPrint}
                                            onChange={(e) => setNewPrinter({ ...newPrinter, beepOnPrint: e.target.checked })}
                                        />
                                        Beep on print (for KOT)
                                    </label>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="cancel-btn" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="save-btn"
                                    onClick={handleAddPrinter}
                                    disabled={!newPrinter.name}
                                >
                                    <Plus size={16} /> Add Printer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
