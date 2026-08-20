/**
 * Utility to resolve API endpoints across different environments
 * (Local Dev, AI Studio Container, Hostinger, Firebase Hosting).
 */
export function getApiEndpoint(endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // 1. If custom API Base URL is specified in Vite env
  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_API_BASE_URL) {
    const base = metaEnv.VITE_API_BASE_URL.replace(/\/$/, '');
    return `${base}${path}`;
  }

  // 2. Localhost or Cloud Run preview container (where server.ts runs locally on port 3000)
  const isLocalOrContainer =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('run.app') ||
     window.location.hostname.includes('ais-'));

  if (isLocalOrContainer) {
    return path;
  }

  // 3. External production host (e.g., Hostinger):
  // Route requests to Firebase Cloud Functions backend
  const CLOUD_FUNCTIONS_BASE = 'https://us-central1-sg-tms-v2.cloudfunctions.net';

  if (path.startsWith('/api/google/auth-url') || path.startsWith('/api/google/connect-url')) {
    const queryDelimiter = path.includes('?') ? '&' : '?';
    const cleanPath = path.replace('/api/google/auth-url', '').replace('/api/google/connect-url', '');
    return `${CLOUD_FUNCTIONS_BASE}/googleOAuthStart${cleanPath}${queryDelimiter}json=true`;
  }

  if (path.startsWith('/api/')) {
    const pathWithoutApi = path.replace('/api', '');
    return `${CLOUD_FUNCTIONS_BASE}/api${pathWithoutApi}`;
  }

  return `${CLOUD_FUNCTIONS_BASE}${path}`;
}
