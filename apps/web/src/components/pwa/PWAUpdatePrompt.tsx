import { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import './PWAUpdatePrompt.css';
import { logger } from '../../utils/logger';

// Injected by Vite at build time
declare const __APP_BUILD_TIME__: number;

export function PWAUpdatePrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [hasVersionUpdate, setHasVersionUpdate] = useState(false);
    const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);

    const localBuildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : 0;

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

                // Check for updates periodically (every 20 seconds) for fast update detection
                const intervalId = setInterval(() => {
                    r.update().catch((err) => logger.debug('[PWA] Periodic update check error:', err));
                }, 20 * 1000);

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

    // Check version.json as dual-redundancy for web updates
    useEffect(() => {
        let isCancelled = false;

        const checkVersionJson = async () => {
            try {
                if (!localBuildTime) return;
                const res = await fetch(`/version.json?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
                });

                if (!res.ok) return;
                const data = await res.json();

                if (data?.buildTime && data.buildTime > localBuildTime) {
                    logger.debug('[PWA] Remote build time is newer than local:', data.buildTime, 'vs', localBuildTime);
                    if (!isCancelled) {
                        setHasVersionUpdate(true);
                        setShowPrompt(true);
                    }
                }
            } catch (err) {
                // Ignore network errors during offline
            }
        };

        // Check on mount
        checkVersionJson();

        // Check every 25 seconds
        const interval = setInterval(checkVersionJson, 25 * 1000);

        // Check on tab focus & online
        const handleFocusOrOnline = () => {
            checkVersionJson();
            if (registrationRef.current) {
                registrationRef.current.update().catch(() => {});
            }
        };

        window.addEventListener('focus', handleFocusOrOnline);
        window.addEventListener('online', handleFocusOrOnline);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleFocusOrOnline();
            }
        });

        return () => {
            isCancelled = true;
            clearInterval(interval);
            window.removeEventListener('focus', handleFocusOrOnline);
            window.removeEventListener('online', handleFocusOrOnline);
        };
    }, [localBuildTime]);

    // Sync showPrompt when needRefresh changes
    useEffect(() => {
        if (needRefresh) {
            setShowPrompt(true);
        }
    }, [needRefresh]);

    // Active event listeners to check for waiting service worker
    useEffect(() => {
        const checkWaitingWorker = () => {
            if ('serviceWorker' in navigator) {
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

        checkWaitingWorker();
    }, [setNeedRefresh]);

    const handleUpdate = async () => {
        try {
            setUpdating(true);

            // If ServiceWorker has waiting update
            if (needRefresh) {
                await updateServiceWorker(true);
            }

            // Clear cache storages to ensure freshest bundle loads
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                } catch (e) {
                    // Ignore cache cleanup errors
                }
            }

            // Reload page with timestamp to bypass browser memory cache
            const targetUrl = new URL(window.location.href);
            targetUrl.searchParams.set('v', String(Date.now()));
            window.location.href = targetUrl.toString();
        } catch (error) {
            logger.error('[PWA] Error updating app:', error);
            window.location.reload();
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
    };

    const isVisible = (needRefresh || hasVersionUpdate) && showPrompt;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="pwa-update-prompt"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                    <div className="pwa-update-card">
                        <div className="pwa-update-icon-box">
                            <img src="/billova-logo.png" alt="Billova" className="pwa-update-logo" />
                        </div>
                        <div className="pwa-update-info">
                            <div className="pwa-update-title-row">
                                <h4>New Update Available</h4>
                            </div>
                            <p>A fresh version of Billova with new features is ready to load.</p>
                        </div>
                        <div className="pwa-update-actions">
                            <button
                                className="pwa-update-btn"
                                onClick={handleUpdate}
                                disabled={updating}
                            >
                                <RefreshCw size={14} className={updating ? 'pwa-spin' : ''} />
                                <span>{updating ? 'Updating...' : 'Update Now'}</span>
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
