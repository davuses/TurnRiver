import React from 'react';
import { resolveInitialLocale } from '../i18n/LocaleContext';
import { LOCALE_STORAGE_KEY, translateKey, type Locale } from '../i18n/translations';

interface State {
  hasError: boolean;
  message: string;
}

function getBoundaryLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
  return resolveInitialLocale(window.location.search, stored);
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('TurnRiver ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      const locale = getBoundaryLocale();
      return (
        <div className="min-h-screen bg-[#070B0A] text-[#E6EDF5] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0E1513] border border-[#1F2D28] rounded-xl p-6 space-y-4">
            <h1 className="text-xl font-semibold text-white">
              {translateKey(locale, 'error.title')}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {translateKey(locale, 'error.desc')}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              {translateKey(locale, 'error.retry')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
