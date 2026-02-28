'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Activity, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveToken, getServerUrl } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [token, setToken]   = useState('');
  const [show, setShow]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConnect() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getServerUrl()}/api/health`);
      if (!res.ok) throw new Error('Server unreachable');

      if (token) {
        const snap = await fetch(`${getServerUrl()}/api/snapshot`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (snap.status === 401) {
          setError('Invalid token. Please try again.');
          setLoading(false);
          return;
        }
      }
      saveToken(token);
      router.push('/dashboard');
    } catch {
      setError('Cannot reach Claw-AgentMonitor server. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-background flex items-center justify-center p-4 overflow-hidden">

      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full
                        bg-green-500/5 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full
                        bg-blue-500/5 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px]
                        rounded-full bg-primary/3 blur-[140px]" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl
                        shadow-2xl shadow-black/20 p-8 space-y-7">

          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl
                            bg-primary/10 border border-primary/20
                            shadow-[0_0_20px_rgba(34,197,94,0.15)]">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Claw-AgentMonitor</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect to your monitoring server
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="token" className="text-xs font-medium text-muted-foreground">
                Server Token
              </label>
              <div className="relative">
                <Input
                  id="token"
                  type={show ? 'text' : 'password'}
                  placeholder="Leave empty for no-auth mode"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleConnect()}
                  className="pr-10 bg-background/50 border-border/60 focus:border-primary/50
                             focus:ring-primary/20 placeholder:text-muted-foreground/40"
                  aria-label="Server token"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-muted-foreground hover:text-foreground
                             cursor-pointer transition-colors
                             min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={show ? 'Hide token' : 'Show token'}
                >
                  {show
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-400 bg-red-500/8 border border-red-500/15
                                          rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              className={cn(
                'w-full cursor-pointer min-h-[44px] font-semibold',
                'bg-green-500 hover:bg-green-400 text-white',
                'shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_24px_rgba(34,197,94,0.4)]',
                'transition-all duration-200',
              )}
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground/60">
            Default server: <span className="tabular">{getServerUrl()}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
