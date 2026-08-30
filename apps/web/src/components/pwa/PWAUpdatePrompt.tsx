// PWA Update Prompt Component - Instant Update Detection & Modern Icebox UI
import { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import './PWAUpdatePrompt.css';
import { logger } from '../../utils/logger';

export function PWAUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [updating, setUpdating] = useState(false);
    const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            registrationRef.current = r;
            logger.debug('[PWA] Service Worker registered:', r);

            if (r) {
                // Instantly check for updates on registration
                r.update().catch((err) => logger.debug('[PWA] Immediate update check error:', err));

                // Check for updates periodically (every 15 seconds) for fast update detection
                const intervalId = setInterval(() => {
                    r.update().catch((err) => logger.debug('[PWA] Periodic update check error:', err));
                }, 15 * 1000);

                return () => clearInterval(intervalId);
            }
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

    // Sync showPrompt when needRefresh changes
    useEffect(() => {
        if (needRefresh) {
            setShowPrompt(true);
        }
    }, [needRefresh]);

    // Active event listeners to check for updates immediately on tab focus, visibility change & online
    useEffect(() => {
        const checkForUpdate = () => {
            if (registrationRef.current) {
                registrationRef.current.update().catch(() => {});
            } else if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then((reg) => {
                    if (reg) {
                        registrationRef.current = reg;
                        reg.update().catch(() => {});
                        if (reg.waiting) {
                            setNeedRefresh(true);
                            setShowPrompt(true);
                        }
                    }
                }).catch(() => {});
            }
        };

        // Run check on mount
        checkForUpdate();

        // Listen for tab focus, visibility change, online
        const onFocus = () => checkForUpdate();
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdate();
            }
        };

        window.addEventListener('focus', onFocus);
        window.addEventListener('online', onFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // Also check if any existing service worker is in waiting state
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                logger.debug('[PWA] Controller changed, reloading...');
            });
        }

        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('online', onFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [setNeedRefresh]);

    const handleUpdate = async () => {
        try {
            setUpdating(true);
            await updateServiceWorker(true);
        } catch (error) {
            logger.error('[PWA] Error updating service worker:', error);
            window.location.reload();
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
    };

    return (
        <AnimatePresence>
            {needRefresh && showPrompt && (
                <motion.div
                    className="pwa-update-prompt"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    <div className="pwa-update-card">
                        <div className="pwa-update-icon-box">
                            <img src="/billova-logo.png" alt="Billova" className="pwa-update-logo" />
                        </div>
                        <div className="pwa-update-info">
                            <div className="pwa-update-title-row">
                                <h4>New Update Available</h4>
                                <span className="pwa-new-badge">NEW</span>
                            </div>
                            <p>A fresh version of Billova is ready to load.</p>
                        </div>
                        <div className="pwa-update-actions">
                            <button
                                className="pwa-update-btn"
                                onClick={handleUpdate}
                                disabled={updating}
                            >
                                <RefreshCw size={14} className={updating ? 'pwa-spin' : ''} />
                                {updating ? 'Updating...' : 'Update Now'}
                            </button>
                            <button
                                className="pwa-dismiss-btn"
                                onClick={handleDismiss}
                                title="Dismiss notification"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default PWAUpdatePrompt;
