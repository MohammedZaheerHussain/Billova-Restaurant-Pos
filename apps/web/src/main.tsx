import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <BrowserRouter>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#1a1a1a',
                            color: '#fff',
                            border: '1px solid #2d2d2d',
                        },
                        success: {
                            iconTheme: { primary: '#22c55e', secondary: '#fff' },
                        },
                        error: {
                            iconTheme: { primary: '#dc2626', secondary: '#fff' },
                        },
                    }}
                />
            </BrowserRouter>
        </ErrorBoundary>
    </React.StrictMode>
);

