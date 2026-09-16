export const calcTimeLeft = (timeSec: number, startedAt: string, now = Date.now()): number => {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return timeSec;
  const elapsed = Math.floor((now - start) / 1000);
  return Math.max(0, timeSec - elapsed);
};

export const isTimerExpired = (
  startedAt: string | null | undefined,
  timeSec: number,
  now = Date.now(),
): boolean => {
  if (!startedAt) return false;
  return calcTimeLeft(timeSec, startedAt, now) <= 0;
};

export const formatMMSS = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
