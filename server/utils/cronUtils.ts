const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function cronToHuman(exprOrMin: string, hourOrTz?: string, dom?: string, mon?: string, dow?: string): string {
  let min: string, hour: string, tz: string | undefined;

  if (dom === undefined) {
    const parts = exprOrMin.split(/\s+/);
    if (parts.length < 5) return exprOrMin;
    [min, hour, dom, mon, dow] = parts as [string, string, string, string, string];
    tz = hourOrTz;
  } else {
    min = exprOrMin;
    hour = hourOrTz!;
  }

  const tzLabel = tz && tz !== 'UTC' ? ` ${tz.split('/').pop()?.substring(0, 3)}` : '';

  let dayPart = '';
  if (dow !== '*') {
    const days = dow!.split(',').map(d => DAY_NAMES[parseInt(d)] || d).join(',');
    dayPart = `${days} `;
  }

  if (hour !== '*' && min !== '*' && !min.startsWith('*/') && !hour.startsWith('*/')) {
    return `${dayPart}${hour.padStart(2, '0')}:${min.padStart(2, '0')}${tzLabel}`;
  }

  if (min.startsWith('*/')) return `every ${min.substring(2)}m`;
  if (hour.startsWith('*/') && min === '0') return `every ${hour.substring(2)}h`;
  if (hour === '*' && !min.startsWith('*/')) return `hourly :${min.padStart(2, '0')}`;

  return `${min} ${hour} ${dom} ${mon} ${dow}`.substring(0, 22);
}

export function nextCronRun(min: string, hour: string, dom: string, mon: string, dow: string): number | null {
  const matchesField = (expr: string, value: number): boolean => {
    if (expr === '*') return true;
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.substring(2));
      return !isNaN(step) && step > 0 && value % step === 0;
    }
    if (expr.includes('-') && !expr.includes(',')) {
      const [s, e] = expr.split('-').map(Number);
      return value >= s && value <= e;
    }
    return expr.split(',').map(v => parseInt(v)).includes(value);
  };

  const bothDaysRestricted = dom !== '*' && dow !== '*';

  const check = new Date();
  check.setSeconds(0, 0);
  check.setMinutes(check.getMinutes() + 1);

  for (let i = 0; i < 10080; i++) {
    const dayOk = bothDaysRestricted
      ? matchesField(dom, check.getDate()) || matchesField(dow, check.getDay())
      : matchesField(dom, check.getDate()) && matchesField(dow, check.getDay());

    if (
      matchesField(min, check.getMinutes()) &&
      matchesField(hour, check.getHours()) &&
      dayOk &&
      matchesField(mon, check.getMonth() + 1)
    ) {
      return check.getTime();
    }
    check.setMinutes(check.getMinutes() + 1);
  }
  return null;
}
