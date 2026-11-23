import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LOCALE_STORAGE_KEY,
  translateKey,
  type Locale,
  type TranslationKey,
} from './translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function resolveInitialLocale(search: string, stored: string | null): Locale {
  try {
    const params = new URLSearchParams(search);
    const qp = params.get('lang')?.trim().toLowerCase();
    if (qp === 'zh-cn' || qp === 'zh' || qp === 'zh-hans') return 'zh-CN';
    if (qp === 'en' || qp === 'en-us') return 'en';
  } catch {
    // Ignore malformed query string
  }
  if (stored === 'en' || stored === 'zh-CN') return stored;
  return 'en';
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Ignore storage access failures
  }
  return resolveInitialLocale(window.location.search, stored);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage quota errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.title = translateKey(locale, 'meta.pageTitle');
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === 'en' ? 'zh-CN' : 'en'));
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translateKey(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside a LocaleProvider');
  }
  return ctx;
}
