import { lazy, Suspense, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import type { DrillModule } from './poker/types';
import { useMasteryStore } from './store/useMasteryStore';
import { useDailyChallengeStore, type DailySlotKind } from './poker/dailyChallenge';
import { LocaleProvider, useLocale } from './i18n/LocaleContext';
import type { TranslationKey } from './i18n/translations';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewView } from './views/OverviewView';

const FundamentalsView = lazy(() =>
  import('./views/FundamentalsView').then((m) => ({ default: m.FundamentalsView }))
);
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
          <div className="h-7 w-56 rounded-lg bg-[#141E1B]" />
          <div className="h-4 w-80 max-w-full rounded bg-[#0E1513]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[#141E1B]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[420px] rounded-xl bg-[#0E1513] border border-[#1F2D28]" />
        <div className="lg:col-span-4 h-[420px] rounded-xl bg-[#0E1513] border border-[#1F2D28]" />
      </div>
    </div>
  );
}

export type AppView = 'overview' | 'learn' | DrillModule | 'leaks';

const NAV_LINKS: { id: 'learn' | DrillModule; labelKey: TranslationKey }[] = [
  { id: 'learn', labelKey: 'nav.learn' },
  { id: 'preflop', labelKey: 'nav.preflop' },
  { id: 'postflop', labelKey: 'nav.postflop' },
  { id: 'math', labelKey: 'nav.math' },
  { id: 'reading', labelKey: 'nav.reading' },
  { id: 'table', labelKey: 'nav.table' },
];

function getInitialView(): AppView {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'preflop';
    const viewParam = params.get('view');
    if (viewParam === 'studio3d') return 'table';
    if (
      viewParam === 'learn' ||
      viewParam === 'preflop' ||
      viewParam === 'postflop' ||
      viewParam === 'math' ||
      viewParam === 'reading' ||
      viewParam === 'table' ||
      viewParam === 'leaks'
    ) {
      return viewParam;
    }
  }
  return 'overview';
}

function getInitialRouteParams() {
  if (typeof window === 'undefined') {
    return { puzzle: undefined, spot: undefined, rookie: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    puzzle: params.get('puzzle') ?? undefined,
    spot: params.get('spot') ?? undefined,
    rookie: params.get('start') === 'rookie',
  };
}

function TurnRiverShell() {
  const [activeView, setActiveView] = useState<AppView>(getInitialView);
  const [routeParams, setRouteParams] = useState(getInitialRouteParams);
  const [scrolled, setScrolled] = useState(false);
  const store = useMasteryStore();
  const daily = useDailyChallengeStore();
  const { locale, toggleLocale, t } = useLocale();

  const handleLaunchRookieTable = () => {
    setRouteParams((prev) => ({ ...prev, rookie: true }));
    setActiveView('table');
  };

  const handleLaunchDailySlot = (slot: DailySlotKind) => {
    if (slot === 'preflop') {
      setActiveView('preflop');
    } else if (slot === 'postflop') {
      setRouteParams((prev) => ({ ...prev, spot: daily.plan.postflopSpotId }));
      setActiveView('postflop');
    } else {
      setRouteParams((prev) => ({ ...prev, puzzle: daily.plan.showdownSlug }));
      setActiveView('learn');
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHeroView = activeView === 'overview';
  const headerSurface =
    isHeroView && !scrolled
      ? 'bg-transparent border-transparent'
      : 'bg-[#070B0A]/92 border-[#1F2D28] backdrop-blur-md';

  return (
    <div className="min-h-screen bg-[#070B0A] text-[#F2F4F1] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-500 focus:text-[#04110C] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        {t('nav.skipToMain')}
      </a>

      {/* Single-Row Studio Header — borderless over Overview hero at y=0, crisp separation on scroll */}
      <header
        className={`sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 ease-out ${headerSurface}`}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="inline-flex items-center gap-2 font-display text-[22px] font-bold tracking-[-0.03em] text-[#F2F4F1] hover:text-emerald-300 transition-colors duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="w-5 h-5 text-emerald-400 shrink-0"
              fill="currentColor"
            >
              <path d="M12 2.5C7.6 8 3 11.4 3 15.6c0 2.9 2.2 5 5 5 1.6 0 2.9-.7 3.6-1.8-.2 1.8-.8 3.2-2.2 4.2h5.2c-1.4-1-2-2.4-2.2-4.2.7 1.1 2 1.8 3.6 1.8 2.8 0 5-2.1 5-5 0-4.2-4.6-7.6-9-13.1z" />
            </svg>
            <span>TurnRiver</span>
          </button>

          {/* Primary Navigation */}
          <nav
            aria-label={t('nav.ariaPrimary')}
            className="hidden lg:flex items-center gap-7 text-[14px] font-medium"
          >
            {NAV_LINKS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-1.5 border-b-2 transition-colors duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#F2F4F1] border-emerald-400'
                      : 'text-[#99A8A1] border-transparent hover:text-[#F2F4F1]'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Locale & Leak Tracker */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleLocale}
              data-testid="locale-toggle"
              aria-label={locale === 'en' ? 'Switch language to Simplified Chinese' : '切换语言为英文'}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#0E1513]/85 text-[#D8E2DD] border border-[#24352F] hover:border-emerald-400/50 hover:text-white inline-flex items-center gap-1.5 transition-colors duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>{locale === 'en' ? '中文' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('leaks')}
              aria-current={activeView === 'leaks' ? 'page' : undefined}
              className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-lg transition-colors duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'leaks'
                  ? 'bg-emerald-500 text-[#04110C]'
                  : 'bg-[#141E1B]/90 text-[#F2F4F1] border border-[#283B34] hover:border-emerald-400/50 hover:bg-[#1A2824]'
              }`}
            >
              {t('nav.leaks')}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Drill Strip */}
        <nav
          aria-label={t('nav.ariaMobile')}
          className={`lg:hidden no-scrollbar flex items-center gap-1 overflow-x-auto px-4 pb-2.5 pt-2 border-t ${
            isHeroView && !scrolled
              ? 'border-white/10 bg-[#070B0A]/65 backdrop-blur-md'
              : 'border-[#16211D]'
          }`}
        >
          {NAV_LINKS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 ease-out cursor-pointer ${
                  isActive
                    ? 'bg-[#182621] text-emerald-300'
                    : 'text-[#99A8A1] hover:text-[#F2F4F1]'
                }`}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Stage */}
      {isHeroView ? (
        <main id="main-content" tabIndex={-1} className="flex-1 w-full focus:outline-none">
          <OverviewView
            summary={store.summary}
            attempts={store.attempts}
            dailyPlan={daily.plan}
            dailyCompleted={daily.completed}
            onNavigate={(view) => setActiveView(view)}
            onLaunchRookieTable={handleLaunchRookieTable}
            onLaunchDailySlot={handleLaunchDailySlot}
          />
        </main>
      ) : (
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 focus:outline-none"
        >
          <Suspense fallback={<ViewLoadingSkeleton />}>
            {activeView === 'learn' && (
              <FundamentalsView
                prefs={store.prefs}
                initialPuzzleSlug={routeParams.puzzle}
                onSolvedPuzzle={(slug) => {
                  if (slug === daily.plan.showdownSlug) {
                    daily.markDailyDone('showdown');
                  }
                }}
                onLaunchRookieTable={handleLaunchRookieTable}
                onNavigateDrill={(mod) => setActiveView(mod)}
              />
            )}

            {activeView === 'preflop' && (
              <PreflopLabView
                prefs={store.prefs}
                onUpdatePrefs={store.updatePrefs}
                onRecordAttempt={store.recordAttempt}
                onPreflopAnswered={() => daily.markDailyDone('preflop')}
              />
            )}

            {activeView === 'postflop' && (
              <PostflopTrainerView
                prefs={store.prefs}
                initialSpotId={routeParams.spot}
                onUpdatePrefs={store.updatePrefs}
                onRecordAttempt={store.recordAttempt}
                onSpotEvaluated={(spotId) => {
                  if (spotId === daily.plan.postflopSpotId) {
                    daily.markDailyDone('postflop');
                  }
                }}
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
                initialSpotId={routeParams.spot}
                onRecordAttempt={store.recordAttempt}
              />
            )}

            {activeView === 'table' && (
              <PlayTableView
                prefs={store.prefs}
                startRookieGuide={routeParams.rookie}
                onDismissRookieGuide={() =>
                  setRouteParams((prev) => ({ ...prev, rookie: false }))
                }
                onUpdatePrefs={store.updatePrefs}
                onRecordAttempt={store.recordAttempt}
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
      )}
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
