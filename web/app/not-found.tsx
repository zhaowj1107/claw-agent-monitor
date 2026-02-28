import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <p className="text-sm text-muted-foreground">Page not found.</p>
      <Link
        href="/"
        className="text-xs px-3 py-1.5 rounded-md border border-border/50 hover:bg-muted/50 transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
