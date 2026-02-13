// Error Boundary Component - Catches React errors and displays them
import React from 'react';
import { logger } from '../utils/logger';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logger.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    maxWidth: '800px',
                    margin: '0 auto',
                    backgroundColor: '#1a1a2e',
                    color: '#fff',
                    fontFamily: 'monospace',
                    minHeight: '100vh',
                }}>
                    <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>
                        ⚠️ Application Error
                    </h1>
                    <div style={{
                        backgroundColor: '#2d2d42',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}>
                        <h2 style={{ color: '#fbbf24', marginTop: 0 }}>Error Message:</h2>
                        <pre style={{ whiteSpace: 'pre-wrap', color: '#f87171' }}>
                            {this.state.error?.message}
                        </pre>
                    </div>
                    <div style={{
                        backgroundColor: '#2d2d42',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}>
                        <h2 style={{ color: '#fbbf24', marginTop: 0 }}>Stack Trace:</h2>
                        <pre style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '12px',
                            color: '#94a3b8',
                            maxHeight: '300px',
                            overflow: 'auto',
                        }}>
                            {this.state.error?.stack}
                        </pre>
                    </div>
                    {this.state.errorInfo && (
                        <div style={{
                            backgroundColor: '#2d2d42',
                            padding: '20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                        }}>
                            <h2 style={{ color: '#fbbf24', marginTop: 0 }}>Component Stack:</h2>
                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                fontSize: '12px',
                                color: '#94a3b8',
                                maxHeight: '300px',
                                overflow: 'auto',
                            }}>
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            🔄 Reload Page
                        </button>
                        <button
                            onClick={() => {
                                // Unregister service workers
                                if ('serviceWorker' in navigator) {
                                    navigator.serviceWorker.getRegistrations().then(registrations => {
                                        registrations.forEach(reg => reg.unregister());
                                    });
                                }
                                // Clear caches
                                if ('caches' in window) {
                                    caches.keys().then(names => {
                                        names.forEach(name => caches.delete(name));
                                    });
                                }
                                // Force reload
                                setTimeout(() => window.location.reload(), 500);
                            }}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            🗑️ Clear Cache & Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
