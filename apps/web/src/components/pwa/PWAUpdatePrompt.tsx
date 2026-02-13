// PWA Update Prompt Component - Shows when a new version is available
import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Download } from 'lucide-react';
import './PWAUpdatePrompt.css';
import { logger } from '../../utils/logger';

export function PWAUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            logger.debug('[PWA] Service Worker registered:', r);
        },
        onRegisterError(error) {
            logger.error('[PWA] Service Worker registration error:', error);
        },
        onNeedRefresh() {
            logger.debug('[PWA] New content available, refresh needed');
            setShowPrompt(true);
        },
        onOfflineReady() {
            logger.debug('[PWA] App ready for offline use');
        },
    });

    const handleUpdate = () => {
        updateServiceWorker(true);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setNeedRefresh(false);
        setShowPrompt(false);
    };

    if (!needRefresh || !showPrompt) return null;

    return (
        <div className="pwa-update-prompt">
            <div className="pwa-update-content">
                <div className="pwa-update-icon">
                    <Download size={24} />
                </div>
                <div className="pwa-update-text">
                    <h4>Update Available!</h4>
                    <p>A new version of Billova is ready.</p>
                </div>
                <div className="pwa-update-actions">
                    <button className="pwa-update-btn" onClick={handleUpdate}>
                        <RefreshCw size={16} />
                        Update Now
                    </button>
                    <button className="pwa-dismiss-btn" onClick={handleDismiss}>
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PWAUpdatePrompt;
