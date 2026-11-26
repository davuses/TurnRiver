export interface ShareUrlParams {
  view: 'learn' | 'preflop' | 'postflop' | 'math' | 'reading' | 'table' | 'leaks';
  spot?: string;
  puzzle?: string;
  start?: 'rookie';
  template?: string;
}

export function buildShareUrl(params: ShareUrlParams): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('view', params.view);
  if (params.spot) url.searchParams.set('spot', params.spot);
  if (params.puzzle) url.searchParams.set('puzzle', params.puzzle);
  if (params.start) url.searchParams.set('start', params.start);
  if (params.template) url.searchParams.set('template', params.template);
  return url.toString();
}

export async function copyShareUrl(params: ShareUrlParams): Promise<boolean> {
  const href = buildShareUrl(params);
  if (!href) return false;
  try {
    await navigator.clipboard.writeText(href);
    return true;
  } catch {
    return false;
  }
}
