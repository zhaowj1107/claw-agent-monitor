export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  queryString: string | null,
): string | null {
  // Bearer token from Authorization header
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // ?token= query param (for WebSocket upgrade requests)
  if (queryString) {
    const params = new URLSearchParams(queryString.replace(/^\?/, ''));
    const t = params.get('token');
    if (t) return t;
  }
  return null;
}

export function checkAuth(token: string | null): boolean {
  const required = process.env.CLAW_TOKEN;
  if (!required) return true;   // no-auth mode: safe because server binds to localhost
  return token === required;
}
