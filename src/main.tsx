import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/ToastProvider';
import App from './App.tsx';
import './index.css';

// Suppress Firestore internal assertion errors that can occur with WebChannel
// watch streams. These are non-fatal — Firestore auto-recovers the connection.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('INTERNAL ASSERTION FAILED')) {
    console.warn('Firestore watch stream recovered:', event.reason.message);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
