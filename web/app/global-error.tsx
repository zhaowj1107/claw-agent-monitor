'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <p style={{ color: '#888', fontSize: '14px' }}>Something went wrong.</p>
          <button onClick={reset} style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', background: 'transparent', color: '#aaa' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
