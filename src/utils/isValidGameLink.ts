export function isValidGameLink(link: string): boolean {
  const sanitized = link.trim();
  const validPattern = /^\/?game\/[\w-]+$/;
  const validFullUrlPattern = /^https?:\/\/.+\/game\/[\w-]+$/;
  return validPattern.test(sanitized) || validFullUrlPattern.test(sanitized);
}

export function parseGameIdFromLink(link: string): string | null {
  const match =
    link.match(/\/game\/([\w-]+)/) || link.match(/game\/([\w-]+)/);
  return match?.[1] ?? null;
}
