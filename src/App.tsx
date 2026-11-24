import { lazy, Suspense, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import type { DrillModule } from './poker/types';
import { useMasteryStore } from './store/useMasteryStore';
import { LocaleProvider, useLocale } from './i18n/LocaleContext';
import type { TranslationKey } from './i18n/translations';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewView } from './views/OverviewView';

const PreflopLabView = lazy(() =>
  import('./views/PreflopLabView').then((m) => ({ default: m.PreflopLabView }))
);
const PostflopTrainerView = lazy(() =>
  import('./views/PostflopTrainerView').then((m) => ({ default: m.PostflopTrainerView }))
);
const MathLabView = lazy(() =>
  import('./views/MathLabView').then((m) => ({ default: m.MathLabView }))
);
const HandReadingView = lazy(() =>
  import('./views/HandReadingView').then((m) => ({ default: m.HandReadingView }))
);
const PlayTableView = lazy(() =>
  import('./views/PlayTableView').then((m) => ({ default: m.PlayTableView }))
);
const Studio3DView = lazy(() =>
  import('./views/Studio3DView').then((m) => ({ default: m.Studio3DView }))
);
const LeakTrackerView = lazy(() =>
  import('./views/LeakTrackerView').then((m) => ({ default: m.LeakTrackerView }))
);

function ViewLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="space-y-6 pb-12 animate-pulse"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-[#17202E]" />
          <div className="h-4 w-80 max-w-full rounded bg-[#111722]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[#17202E]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[420px] rounded-xl bg-[#111722] border border-[#222D3D]" />
        <div className="lg:col-span-4 h-[420px] rounded-xl bg-[#111722] border border-[#222D3D]" />
      </div>
    </div>
  );
}

export type AppView = 'overview' | DrillModule | 'studio3d' | 'leaks';

const NAV_LINKS: { id: DrillModule | 'studio3d'; labelKey: TranslationKey }[] = [
  { id: 'preflop', labelKey: 'nav.preflop' },
  { id: 'postflop', labelKey: 'nav.postflop' },
  { id: 'math', labelKey: 'nav.math' },
  { id: 'reading', labelKey: 'nav.reading' },
  { id: 'table', labelKey: 'nav.table' },
  { id: 'studio3d', labelKey: 'nav.studio3d' },
];

function getInitialView(): AppView {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'preflop';
    const viewParam = params.get('view');
    if (
      viewParam === 'preflop' ||
      viewParam === 'postflop' ||
      viewParam === 'math' ||
      viewParam === 'reading' ||
      viewParam === 'table' ||
      viewParam === 'studio3d' ||
      viewParam === 'leaks'
    ) {
      return viewParam;
    }
  }
  return 'overview';
}

function TurnRiverShell() {
  const [activeView, setActiveView] = useState<AppView>(getInitialView);
  const store = useMasteryStore();
  const { locale, toggleLocale, t } = useLocale();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView]);

  return (
    <div className="min-h-screen bg-[#090D12] text-[#E6EDF5] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-500 focus:text-slate-950 focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        {t('nav.skipToMain')}
      </a>
      {/* Clean Single-Row Studio Top Bar */}
      <header className="sticky top-0 z-40 bg-[#090D12]/95 border-b border-[#1E2837]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="font-display text-xl font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            TurnRiver
          </button>

          {/* Zone 2: Primary Drill & 3D Navigation */}
          <nav
            aria-label={t('nav.ariaPrimary')}
            className="hidden lg:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_LINKS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-white border-emerald-400'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Locale Switcher & Leak Tracker */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLocale}
              data-testid="locale-toggle"
              aria-label={locale === 'en' ? 'Switch language to Simplified Chinese' : '切换语言为英文'}
              className="px-2.5 py-2 text-xs font-mono font-medium rounded-lg bg-[#111722] text-slate-200 border border-[#263347] hover:border-emerald-500/50 hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>{locale === 'en' ? '中文' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('leaks')}
              aria-current={activeView === 'leaks' ? 'page' : undefined}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'leaks'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#17202E] text-white border border-[#2B394F] hover:bg-[#202D42]'
              }`}
            >
              {t('nav.leaks')}
            </button>
          </div>
        </div>

        {/* Compact Mobile / Tablet Drill Strip */}
        <nav
          aria-label={t('nav.ariaMobile')}
          className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2.5 border-t border-[#161E2B] pt-2"
        >
          {NAV_LINKS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#1D283A] text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Stage */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 focus:outline-none"
      >
        {activeView === 'overview' && (
          <OverviewView
            summary={store.summary}
            attempts={store.attempts}
            onNavigate={(view) => setActiveView(view)}
          />
        )}

        <Suspense fallback={<ViewLoadingSkeleton />}>
          {activeView === 'preflop' && (
            <PreflopLabView
              prefs={store.prefs}
              onUpdatePrefs={store.updatePrefs}
              onRecordAttempt={store.recordAttempt}
            />
          )}

          {activeView === 'postflop' && (
            <PostflopTrainerView
              prefs={store.prefs}
              onUpdatePrefs={store.updatePrefs}
              onRecordAttempt={store.recordAttempt}
            />
          )}

          {activeView === 'math' && (
            <MathLabView
              prefs={store.prefs}
              onRecordAttempt={store.recordAttempt}
            />
          )}

          {activeView === 'reading' && (
            <HandReadingView
              prefs={store.prefs}
              onRecordAttempt={store.recordAttempt}
            />
          )}

          {activeView === 'table' && (
            <PlayTableView
              prefs={store.prefs}
              onUpdatePrefs={store.updatePrefs}
              onRecordAttempt={store.recordAttempt}
            />
          )}

          {activeView === 'studio3d' && (
            <Studio3DView
              prefs={store.prefs}
              onUpdatePrefs={store.updatePrefs}
            />
          )}

          {activeView === 'leaks' && (
            <LeakTrackerView
              summary={store.summary}
              attempts={store.attempts}
              onResetProgress={store.resetProgress}
              onNavigateDrill={(mod) => setActiveView(mod)}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <TurnRiverShell />
      </LocaleProvider>
    </ErrorBoundary>
  );
}
