import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Move3d,
  Palette,
  RefreshCw,
  Spade,
  Sun,
  Volume2,
  VolumeX,
  Wine,
} from 'lucide-react';
import type { Card } from '../poker/types';
import {
  PokerScene3D,
  type CameraPresetId,
  type LightingPresetId,
} from '../three/PokerScene3D';
import type { Seat3DSpec } from '../three/models';
import type { CardStyle, FeltThemeId } from '../three/textures';
import { useLocale } from '../i18n/LocaleContext';

export interface Studio3DTableProps {
  board: Card[];
  potBb: number;
  potText?: string;
  streetLabel: string;
  seats: Seat3DSpec[];
  fourColorDeck: boolean;
  onToggleFourColor?: () => void;
  cardStyle?: CardStyle;
  onToggleCardStyle?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onDealSample?: () => void;
  fullViewport?: boolean;
  fillParent?: boolean;
  isTheater?: boolean;
  onToggleTheater?: () => void;
}

export function Studio3DTable({
  board,
  potBb,
  potText,
  streetLabel,
  seats,
  fourColorDeck,
  onToggleFourColor,
  cardStyle = 'classic',
  onToggleCardStyle,
  soundEnabled: soundEnabledProp,
  onToggleSound,
  onDealSample,
  fullViewport = false,
  fillParent = false,
  isTheater = false,
  onToggleTheater,
}: Studio3DTableProps) {
  const { locale, t } = useLocale();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PokerScene3D | null>(null);
  const didMountHandRef = useRef(false);
  const didMountFeltRef = useRef(false);
  const didMountLightingRef = useRef(false);
  const didMountPropsRef = useRef(false);
  const didMountSoundRef = useRef(false);

  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [feltTheme, setFeltTheme] = useState<FeltThemeId>('emerald');
  const [lighting, setLighting] = useState<LightingPresetId>('studio');
  const [showProps, setShowProps] = useState<boolean>(true);
  const [localSoundEnabled, setLocalSoundEnabled] = useState<boolean>(true);
  const [dockVisible, setDockVisible] = useState(true);
  const [isNarrow, setIsNarrow] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  // Embedded mobile tables default to orbit-locked so one-finger vertical swipes keep scrolling the page
  const [orbitEnabled, setOrbitEnabled] = useState<boolean>(
    () => !(typeof window !== 'undefined' && window.innerWidth < 640 && !fullViewport && !isTheater)
  );
  const orbitLockable = isNarrow && !fullViewport && !isTheater;
  const effectiveOrbit = !orbitLockable || orbitEnabled;
  const [hasWebglError, setHasWebglError] = useState(false);
  const [webglErrorDetail, setWebglErrorDetail] = useState<string | null>(null);

  const effectiveSoundEnabled =
    typeof soundEnabledProp === 'boolean' ? soundEnabledProp : localSoundEnabled;

  const toggleSound = () => {
    if (onToggleSound) {
      onToggleSound();
    } else {
      setLocalSoundEnabled((v) => !v);
    }
  };
  const toggleSoundRef = useRef(toggleSound);
  toggleSoundRef.current = toggleSound;

  // Mount Three.js controller once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    try {
      const controller = new PokerScene3D(el, {
        board,
        potBb,
        potText,
        seats,
        fourColorDeck,
        cardStyle,
        feltTheme,
        lighting,
        showProps,
        soundEnabled: effectiveSoundEnabled,
      });
      sceneRef.current = controller;
      setHasWebglError(false);
      setWebglErrorDetail(null);
    } catch (err) {
      setHasWebglError(true);
      setWebglErrorDetail(err instanceof Error && err.message ? err.message : null);
    }

    return () => {
      didMountHandRef.current = false;
      didMountFeltRef.current = false;
      didMountLightingRef.current = false;
      didMountPropsRef.current = false;
      didMountSoundRef.current = false;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // Intentionally mount/dispose once per component lifecycle; updates flow through dedicated effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    sceneRef.current?.setOrbitEnabled(effectiveOrbit);
  }, [effectiveOrbit, hasWebglError]);

  // Rebuild dynamic hand layer ONLY when hand state / deck color / card style changes (skip redundant initial mount!)
  useEffect(() => {
    if (!didMountHandRef.current) {
      didMountHandRef.current = true;
      return;
    }
    sceneRef.current?.updateHandLayer({
      board,
      potBb,
      potText,
      seats,
      fourColorDeck,
      cardStyle,
    });
  }, [board, potBb, potText, seats, fourColorDeck, cardStyle]);

  // Lightweight setters: never rebuild cards/chips/plaques when toggling felt, light, props, or audio
  useEffect(() => {
    if (!didMountFeltRef.current) {
      didMountFeltRef.current = true;
      return;
    }
    sceneRef.current?.setFeltTheme(feltTheme);
  }, [feltTheme]);

  useEffect(() => {
    if (!didMountLightingRef.current) {
      didMountLightingRef.current = true;
      return;
    }
    sceneRef.current?.applyLighting(lighting);
  }, [lighting]);

  useEffect(() => {
    if (!didMountPropsRef.current) {
      didMountPropsRef.current = true;
      return;
    }
    sceneRef.current?.setShowProps(showProps);
  }, [showProps]);

  useEffect(() => {
    if (!didMountSoundRef.current) {
      didMountSoundRef.current = true;
      return;
    }
    sceneRef.current?.setSoundEnabled(effectiveSoundEnabled);
  }, [effectiveSoundEnabled]);

  // Keyboard shortcuts: 1-5 camera presets, H toggle dock, P toggle ambient props, M toggle SFX
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === '1') {
        setCameraPreset('hero');
        sceneRef.current?.setCameraPreset('hero');
      } else if (e.key === '2') {
        setCameraPreset('broadcast');
        sceneRef.current?.setCameraPreset('broadcast');
      } else if (e.key === '3') {
        setCameraPreset('topdown');
        sceneRef.current?.setCameraPreset('topdown');
      } else if (e.key === '4') {
        setCameraPreset('closeup');
        sceneRef.current?.setCameraPreset('closeup');
      } else if (e.key === '5') {
        setCameraPreset('rail');
        sceneRef.current?.setCameraPreset('rail');
      } else if (e.key.toLowerCase() === 'h') {
        setDockVisible((v) => !v);
      } else if (e.key.toLowerCase() === 'p') {
        setShowProps((v) => !v);
      } else if (e.key.toLowerCase() === 'm') {
        toggleSoundRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectCamera = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    sceneRef.current?.setCameraPreset(preset);
  };

  const containerHeightClass = fillParent
    ? 'h-full min-h-[420px]'
    : fullViewport
      ? 'h-[calc(100vh-116px)] min-h-[520px]'
      : 'h-[430px] sm:h-[480px]';

  const frameClass = fillParent
    ? 'relative w-full h-full bg-[#070B0A] select-none overflow-hidden'
    : `relative w-full ${containerHeightClass} rounded-xl overflow-hidden border border-[#1F2D28] bg-[#070B0A] select-none`;

  return (
    <div className={frameClass}>
      {/* Full-bleed Three.js WebGL Canvas Mount */}
      <div
        ref={mountRef}
        data-testid="threejs-poker-canvas"
        className={`w-full h-full ${effectiveOrbit ? 'cursor-grab active:cursor-grabbing' : ''}`}
      />

      {hasWebglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070B0A] p-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-semibold text-rose-400">{t('studio3d.webglErrorTitle')}</p>
            <p className="text-xs text-slate-400">
              {locale === 'zh-CN'
                ? t('studio3d.webglErrorFallback')
                : webglErrorDetail || t('studio3d.webglErrorFallback')}
            </p>
          </div>
        </div>
      )}

      {/* Responsive Top Header Overlay: Telemetry + Controls (solid opaque backing, NO backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex items-center justify-between gap-1.5">
        {/* Top-Left Pot & Street Telemetry */}
        <div className="min-w-0 flex items-center gap-1.5 sm:gap-2.5 bg-[#0A100E]/92 border border-[#21322C] rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-mono tabular-nums overflow-hidden">
          <span className="hidden sm:inline text-slate-400 shrink-0">{t('studio3d.streetLabel')}</span>
          <span className="text-emerald-400 font-semibold truncate">{streetLabel}</span>
          <span className="text-slate-600 shrink-0">·</span>
          <span className="text-amber-300 font-semibold whitespace-nowrap shrink-0">
            <span className="hidden sm:inline">{t('studio3d.potLabel')} </span>
            {potText ?? `${potBb.toFixed(1)} bb`}
          </span>
        </div>

        {/* Top-Right Compact Orbit + Theater + Hide/Show Dock Toggles */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 shrink-0">
          {orbitLockable && (
            <button
              type="button"
              data-testid="studio3d-orbit-toggle"
              aria-pressed={orbitEnabled}
              onClick={() => setOrbitEnabled((v) => !v)}
              aria-label={
                orbitEnabled
                  ? locale === 'zh-CN' ? '锁定旋转，恢复页面滚动' : 'Lock orbit and scroll page'
                  : locale === 'zh-CN' ? '解锁旋转视角' : 'Unlock 3D orbit'
              }
              className={`px-2 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                orbitEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-[#0A100E]/92 border-[#21322C] text-slate-300 hover:text-white'
              }`}
            >
              <Move3d className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{locale === 'zh-CN' ? (orbitEnabled ? '旋转' : '已锁定') : orbitEnabled ? 'Orbit' : 'Locked'}</span>
            </button>
          )}
          {onToggleTheater && (
            <button
              type="button"
              data-testid="studio3d-theater-toggle"
              aria-pressed={isTheater}
              onClick={onToggleTheater}
              aria-label={isTheater ? t('studio3d.exitTheater') : t('studio3d.theater')}
              className="px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0A100E]/92 border border-[#21322C] text-emerald-300 hover:text-white hover:border-emerald-500/60 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isTheater ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('studio3d.exitTheater')}</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('studio3d.theater')}</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            aria-pressed={dockVisible}
            onClick={() => setDockVisible((v) => !v)}
            aria-label={dockVisible ? t('studio3d.hideDock') : t('studio3d.showDock')}
            className="px-2 sm:px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0A100E]/92 border border-[#21322C] text-slate-200 hover:text-white hover:border-emerald-500/50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {dockVisible ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('studio3d.hideDock')}</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('studio3d.showDock')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Viewport-First Collapsible Bottom Dock (single-row scroll strip on <640px mobile, NO backdrop-filter) */}
      {dockVisible && (
        <div className="no-scrollbar absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible items-center justify-between gap-1.5 sm:gap-2.5 bg-[#0A100E]/94 border border-[#21322C] rounded-xl px-2 py-1.5 sm:px-3.5 sm:py-2.5">
          {/* Camera Angle Selector */}
          <div className="flex flex-nowrap sm:flex-wrap shrink-0 items-center gap-1 sm:gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 inline-flex items-center gap-1 mr-0.5 sm:mr-1 shrink-0">
              <Camera className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="hidden md:inline">{t('studio3d.cameraLabel')}</span>
            </span>
            {(
              [
                { id: 'hero', label: t('studio3d.camHero') },
                { id: 'broadcast', label: t('studio3d.camBroadcast') },
                { id: 'topdown', label: t('studio3d.camTopDown') },
                { id: 'closeup', label: t('studio3d.camCloseUp') },
                { id: 'rail', label: t('studio3d.camRail') },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                aria-pressed={cameraPreset === cam.id}
                onClick={() => handleSelectCamera(cam.id)}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  cameraPreset === cam.id
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-[#131C19] text-slate-300 hover:text-white border border-[#23342E]'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Felt Finish, Studio Light, Props, SFX, Deck & Deal Runout */}
          <div className="flex flex-nowrap sm:flex-wrap shrink-0 items-center gap-1.5 sm:gap-2">
            <select
              aria-label={t('studio3d.feltLabel')}
              value={feltTheme}
              onChange={(e) => setFeltTheme(e.target.value as FeltThemeId)}
              className="bg-[#131C19] border border-[#23342E] rounded-md px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs text-slate-200 cursor-pointer shrink-0"
            >
              <option value="emerald">{t('studio3d.feltEmerald')}</option>
              <option value="navy">{t('studio3d.feltNavy')}</option>
              <option value="crimson">{t('studio3d.feltCrimson')}</option>
            </select>

            <div className="inline-flex items-center gap-1 shrink-0">
              <Sun className="w-3.5 h-3.5 text-amber-300 hidden sm:inline" aria-hidden="true" />
              <select
                aria-label={t('studio3d.lightingLabel')}
                value={lighting}
                onChange={(e) => setLighting(e.target.value as LightingPresetId)}
                className="bg-[#131C19] border border-[#23342E] rounded-md px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs text-slate-200 cursor-pointer"
              >
                <option value="studio">{t('studio3d.lightStudio')}</option>
                <option value="daylight">{t('studio3d.lightDaylight')}</option>
                <option value="lounge">{t('studio3d.lightLounge')}</option>
              </select>
            </div>

            <button
              type="button"
              data-testid="toggle-table-props"
              aria-pressed={showProps}
              onClick={() => setShowProps((v) => !v)}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                showProps
                  ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                  : 'bg-[#131C19] border-[#23342E] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showProps ? t('studio3d.propsOn') : t('studio3d.propsOff')}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-table-sfx"
              aria-pressed={effectiveSoundEnabled}
              onClick={toggleSound}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                effectiveSoundEnabled
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : 'bg-[#131C19] border-[#23342E] text-slate-400 hover:text-slate-200'
              }`}
            >
              {effectiveSoundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{effectiveSoundEnabled ? t('studio3d.soundOn') : t('studio3d.soundOff')}</span>
            </button>

            {onToggleFourColor && (
              <button
                type="button"
                aria-pressed={fourColorDeck}
                onClick={onToggleFourColor}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                  fourColorDeck
                    ? 'bg-[#162736] border-sky-500/40 text-sky-300'
                    : 'bg-[#131C19] border-[#23342E] text-slate-300'
                }`}
              >
                <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{fourColorDeck ? t('common.fourColorShort') : t('common.twoColorShort')}</span>
              </button>
            )}

            {onToggleCardStyle && (
              <button
                type="button"
                data-testid="toggle-card-style"
                aria-pressed={cardStyle === 'jumbo'}
                onClick={onToggleCardStyle}
                className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                  cardStyle === 'jumbo'
                    ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                    : 'bg-[#131C19] border-[#23342E] text-slate-300 hover:text-white'
                }`}
              >
                <Spade className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{cardStyle === 'jumbo' ? t('studio3d.cardJumbo') : t('studio3d.cardClassic')}</span>
              </button>
            )}

            {onDealSample && (
              <button
                type="button"
                onClick={onDealSample}
                className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('studio3d.dealNew')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
