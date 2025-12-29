// Splash Screen Component - Shows after login with animated logo
import { motion, AnimatePresence } from 'framer-motion';
import './SplashScreen.css';

interface SplashScreenProps {
    show: boolean;
    onComplete?: () => void;
}

export default function SplashScreen({ show, onComplete }: SplashScreenProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="splash-screen"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    onAnimationComplete={() => {
                        if (!show && onComplete) {
                            onComplete();
                        }
                    }}
                >
                    <motion.img
                        src="/logo.png"
                        alt="Billova POS"
                        className="splash-logo"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            duration: 0.8
                        }}
                    />
                    <motion.h1
                        className="splash-name"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                    >
                        Billova POS
                    </motion.h1>
                    <motion.p
                        className="splash-tagline"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                    >
                        Professional Point of Sale
                    </motion.p>
                    <div className="splash-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
