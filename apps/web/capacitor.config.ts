import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.billova.pos',
    appName: 'Billova POS',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
        // Live reload for development - comment out for production build
        url: 'http://192.168.1.235:5175',
        cleartext: true
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: false,
            launchShowDuration: 2000,
            backgroundColor: '#1a1a2e',
            showSpinner: true,
            spinnerStyle: 'large',
            spinnerColor: '#dc2626',
            splashFullScreen: true,
            splashImmersive: true,
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#1a1a2e',
        },
        Keyboard: {
            resize: 'body',
            resizeOnFullScreen: true,
        },
    },
    android: {
        allowMixedContent: true,
        captureInput: true,
        webContentsDebuggingEnabled: true, // Disable in production
    },
};

export default config;
