export function formatElapsed(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function formatBytes(gb: number): string {
  return `${gb.toFixed(1)} GB`;
}

export function relativeTime(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60000) return `in ${Math.round(diff / 1000)}s`;
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`;
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    const mins = Math.round((diff % 3600000) / 60000);
    return mins > 0 ? `in ${hours}h${mins}m` : `in ${hours}h`;
  }
  return `in ${Math.round(diff / 86400000)}d`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
