export const BACKUP_STORAGE_KEYS = [
  'feltlab_attempts_v1',
  'feltlab_summary_v1',
  'feltlab_prefs_v1',
  'turnriver_arena_session_v1',
  'turnriver_opponent_notes_v1',
  'turnriver_fundamentals_v1',
  'turnriver_daily_v1',
  'turnriver_live_table_v1',
] as const;

export interface ProgressBackupPayload {
  version: 1;
  exportedAt: string;
  entries: Record<string, string>;
}

const PREFIX = 'TR1:';

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function buildProgressBackupPayload(
  storage: Pick<Storage, 'getItem'> = window.localStorage
): ProgressBackupPayload {
  const entries: Record<string, string> = {};
  for (const key of BACKUP_STORAGE_KEYS) {
    try {
      const val = storage.getItem(key);
      if (typeof val === 'string' && val.length > 0) {
        entries[key] = val;
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function encodeProgressBackupCode(
  storage: Pick<Storage, 'getItem'> = window.localStorage
): string {
  const payload = buildProgressBackupPayload(storage);
  return PREFIX + utf8ToBase64(JSON.stringify(payload));
}

export function parseProgressBackup(raw: string): ProgressBackupPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty backup code');
  }
  const jsonText = trimmed.startsWith(PREFIX)
    ? base64ToUtf8(trimmed.slice(PREFIX.length))
    : trimmed;
  const parsed = JSON.parse(jsonText) as Partial<ProgressBackupPayload>;
  if (
    !parsed ||
    parsed.version !== 1 ||
    typeof parsed.entries !== 'object' ||
    parsed.entries === null
  ) {
    throw new Error('Invalid TurnRiver backup format');
  }
  const allowed = new Set<string>(BACKUP_STORAGE_KEYS);
  const cleanEntries: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.entries)) {
    if (allowed.has(k) && typeof v === 'string') {
      // Validate each stored entry is valid JSON
      JSON.parse(v);
      cleanEntries[k] = v;
    }
  }
  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    entries: cleanEntries,
  };
}

export function restoreProgressBackup(
  raw: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage
): { restoredKeys: string[] } {
  const payload = parseProgressBackup(raw);
  const restoredKeys: string[] = [];
  for (const [k, v] of Object.entries(payload.entries)) {
    storage.setItem(k, v);
    restoredKeys.push(k);
  }
  return { restoredKeys };
}
