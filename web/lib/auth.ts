const TOKEN_KEY = 'claw_monitor_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getServerUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4242';
}

export function getWsUrl(): string {
  const base = getServerUrl().replace(/^http/, 'ws');
  const token = getToken();
  return token ? `${base}/ws?token=${encodeURIComponent(token)}` : `${base}/ws`;
}
