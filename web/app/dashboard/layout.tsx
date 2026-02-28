'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Clock, Server } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Topbar } from '@/components/Topbar';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',        label: 'Agents', icon: Users  },
  { href: '/dashboard/cron',   label: 'Cron',   icon: Clock  },
  { href: '/dashboard/system', label: 'System', icon: Server },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connectionState } = useDashboardData();

  return (
    <div className="min-h-dvh">
      <ConnectionBanner state={connectionState} />
      <Topbar connectionState={connectionState} />

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56
                        border-r border-border/40
                        bg-background/40 backdrop-blur-sm
                        flex-col pt-6 px-3 gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
                'transition-all duration-150 min-h-[44px] cursor-pointer',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}>
              <Icon className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
              )} />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </aside>

      {/* Main content */}
      <main className="pt-14 pb-24 lg:pl-56 lg:pb-8 px-4 lg:px-8 max-w-[1440px]">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0
                      border-t border-border/50
                      bg-background/80 backdrop-blur-xl
                      flex items-center justify-around px-2 h-16">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-5 py-2 rounded-xl cursor-pointer',
                'transition-colors duration-150 min-h-[44px] justify-center',
                active ? 'text-primary' : 'text-muted-foreground',
              )}>
              <Icon className="h-5 w-5" />
              <span className={cn('text-[10px] font-medium', active && 'text-primary')}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
