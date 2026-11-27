import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Card } from '../poker/types';
import {
  createAmbientPropsGroup,
  createCasinoChairsGroup,
  createCasinoSalonBackdropGroup,
  createChandelierDustMotes,
  createCheckRippleMesh,
  createFeltBadgeMesh,
  createChipStacksGroup,
  createDealerPuckGroup,
  createPlayingCardGroup,
  createPokerTableGroup,
  createSeatPlaqueMesh,
  createTurnHaloMesh,
  DEALER_DECK_POS,
  FELT_Y,
  getAnchorsForSeatCount,
  type ChipStackSpec,
  type PokerTableAssembly,
  type Seat3DSpec,
} from './models';
import { CasinoSoundEngine } from './soundEngine';
import {
  createCardBackTexture,
  createCardFaceTexture,
  createChipSideTexture,
  createChipTopTexture,
  createContactShadowTexture,
  createDealerPuckTexture,
  createFeltBadgeTexture,
  createStudioFloorTexture,
  disposeFeltBadgeTextures,
  type CardStyle,
  type FeltThemeId,
} from './textures';

export type CameraPresetId = 'hero' | 'broadcast' | 'topdown' | 'closeup' | 'rail';
export type LightingPresetId = 'studio' | 'daylight' | 'lounge';

export interface Scene3DHandData {
  board: Card[];
  potBb: number;
  potText?: string;
  seats: Seat3DSpec[];
  fourColorDeck: boolean;
  cardStyle?: CardStyle;
  feltTheme: FeltThemeId;
  lighting: LightingPresetId;
  showProps?: boolean;
  soundEnabled?: boolean;
}

interface ActiveTween {
  obj: THREE.Object3D;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  curveOffset: THREE.Vector3;
  arcHeight: number;
  bounceHeight: number;
  fromRot: THREE.Euler;
  toRot: THREE.Euler;
  flipCard?: boolean;
  delay: number;
  elapsed: number;
  duration: number;
  disposeOnEnd?: boolean;
  initialHidden?: boolean;
  onStart?: () => void;
  onFlip?: () => void;
  onLand?: () => void;
  startedFired?: boolean;
  flippedFired?: boolean;
  landedFired?: boolean;
}

interface ActiveRipple {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  elapsed: number;
  duration: number;
}

interface ChandelierFadeEntry {
  mat: THREE.Material;
  baseOpacity: number;
  isShaderCone: boolean;
}

interface HeroCardPeekTarget {
  group: THREE.Group;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  peekAmount: number;
  sideOffset: number;
}

interface BoardCardEntry {
  group: THREE.Group;
}

interface SeatCardEntry {
  sig: string;
  spot: boolean;
  c1: THREE.Group;
  c2: THREE.Group;
  targets: HeroCardPeekTarget[];
}

interface BetChipEntry {
  seatIndex: number;
  spec: ChipStackSpec;
  fullChips: number;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { pos: [0, 3.35, 5.92], target: [0, FELT_Y + 0.04, 0.04] },
  broadcast: { pos: [3.95, 3.85, 4.45], target: [0, FELT_Y, 0.12] },
  topdown: { pos: [0, 9.2, 1.35], target: [0, FELT_Y, 0.55] },
  closeup: { pos: [0.35, 2.15, 2.65], target: [0, FELT_Y + 0.02, 0.22] },
  rail: { pos: [-2.42, 1.84, 3.42], target: [0.12, FELT_Y + 0.12, -0.06] },
};

// Carefully balanced studio lighting so matte cards read richly with zero over-exposure
const LIGHTING_PRESETS: Record<
  LightingPresetId,
  {
    bg: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    spotColor: number;
    spotIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rimColor: number;
    rimIntensity: number;
    exposure: number;
  }
> = {
  studio: {
    bg: 0x09070a,
    fogDensity: 0.052,
    keyColor: 0xffe4bd,
    keyIntensity: 1.08,
    spotColor: 0xffd596,
    spotIntensity: 14,
    hemiSky: 0x7aa2d4,
    hemiGround: 0x1e130c,
    hemiIntensity: 0.44,
    rimColor: 0xd99b43,
    rimIntensity: 0.62,
    exposure: 0.92,
  },
  daylight: {
    bg: 0x10151f,
    fogDensity: 0.034,
    keyColor: 0xfff8ee,
    keyIntensity: 1.48,
    spotColor: 0xfff4e0,
    spotIntensity: 11,
    hemiSky: 0xcbe3ff,
    hemiGround: 0x26211d,
    hemiIntensity: 0.72,
    rimColor: 0x93c5fd,
    rimIntensity: 0.44,
    exposure: 0.96,
  },
  lounge: {
    bg: 0x050406,
    fogDensity: 0.068,
    keyColor: 0xffc985,
    keyIntensity: 0.82,
    spotColor: 0xffbe6b,
    spotIntensity: 17,
    hemiSky: 0x45587a,
    hemiGround: 0x1a0c09,
    hemiIntensity: 0.32,
    rimColor: 0xf59e0b,
    rimIntensity: 0.74,
    exposure: 0.9,
  },
};

// Reusable scratch objects outside animation loop (zero per-frame GC)
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _tmpVec = new THREE.Vector3();

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.InstancedMesh).isInstancedMesh) {
      (child as THREE.InstancedMesh).dispose();
    }
    const renderable = child as THREE.Mesh | THREE.Points;
    if ((renderable as THREE.Mesh).isMesh || (renderable as THREE.Points).isPoints) {
      renderable.geometry?.dispose();
      const mats = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];
      const uniqueMats = new Set(mats);
      for (const m of uniqueMats) {
        if (!m) continue;
        const std = m as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.bumpMap?.dispose();
        std.roughnessMap?.dispose();
        m.dispose();
      }
    }
  });
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class PokerScene3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private pmrem: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private soundEngine = new CasinoSoundEngine();

  private keyLight: THREE.DirectionalLight;
  private casinoSpotLight: THREE.SpotLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private tableAssembly: PokerTableAssembly;
  private chandelierGroup: THREE.Object3D | null = null;
  private chandelierFadeEntries: ChandelierFadeEntry[] = [];
  private lastChandelierOpacity = -1;
  private seatPlaquePlates: THREE.Mesh[] = [];
  private lastPlaqueRotX = -0.14;
  private ambientPropsGroup: THREE.Group;
  private dustMotes: THREE.Points;
  private dynamicGroup: THREE.Group;
  private cardsGroup: THREE.Group;
  private chipsGroup: THREE.Object3D | null = null;
  private chipBaseSpecs: ChipStackSpec[] = [];
  private betChipEntries: BetChipEntry[] = [];
  private pendingBetChips = new Map<number, { chips: number; token: number }>();
  private betTokenSeq = 0;
  private boardCardMap = new Map<string, BoardCardEntry>();
  private seatCardMap = new Map<number, SeatCardEntry>();
  private fxGroup: THREE.Group;
  private contactShadowTex: THREE.CanvasTexture;
  private cardBackTex: THREE.CanvasTexture;
  private floorTex: THREE.CanvasTexture;
  private chipSideTex: THREE.CanvasTexture;
  private chipTopTex: THREE.CanvasTexture;
  private dealerPuckTex: THREE.CanvasTexture;
  private cardFaceTexCache = new Map<string, THREE.CanvasTexture>();
  private cardFaceTexSet = new Set<THREE.Texture>();

  private currentFeltTheme: FeltThemeId;
  private currentCameraPreset: CameraPresetId = 'hero';
  private userHasOrbited = false;
  private resizeObserver: ResizeObserver;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastDpr = 1;
  private rafId: number | null = null;
  private timeoutId: number | null = null;
  private lastTickMs = 0;
  private elapsedSec = 0;
  private dirty = true;
  private disposed = false;
  private contextLost = false;
  private pendingShadowUpdate = false;

  // Animation, active felt halos, ripples & state-delta trackers
  private activeTweens: ActiveTween[] = [];
  private activeRipples: ActiveRipple[] = [];
  private activeHaloMats: THREE.ShaderMaterial[] = [];
  private heroCardTargets: HeroCardPeekTarget[] = [];
  private hoveredHeroCardIdx = -1;
  private lastRaycastMs = 0;

  private prevBoardKeys: string[] = [];
  private prevHeroCardsSig = '';
  private prevStreetBets = new Map<number, { bet: number; x: number; z: number }>();
  private prevPotBb = 0;
  private prevHadWinner = false;
  private prevFoldedSeats = new Set<number>();
  private prevActionSigs = new Map<number, string>();
  private prevDealerSeatIdx: number | null = null;
  private prevDealerPos: THREE.Vector3 | null = null;
  private prevHeroTurn = false;
  private prevRevealedSeats = new Set<number>();
  private prevAllInSeats = new Set<number>();
  private initializedHandOnce = false;

  // Smooth exponential-damped camera transition targets
  private camAnimActive = false;
  private camTargetPos = new THREE.Vector3();
  private camTargetLook = new THREE.Vector3();

  constructor(container: HTMLElement, initialData: Scene3DHandData) {
    this.container = container;
    this.currentFeltTheme = initialData.feltTheme;
    this.soundEngine.enabled = initialData.soundEnabled ?? true;

    // Detect software WebGL cleanly and release probe context immediately
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    this.isSoftwareGl = probeGl ? detectSoftwareWebGL(probeGl) : false;
    probeGl?.getExtension('WEBGL_lose_context')?.loseContext();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastDpr = dpr;

    // Lightweight single-pass renderer capped at 1.5x DPR with on-demand shadow maps (low GPU footprint!)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'default',
      alpha: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    let createdPmrem: THREE.PMREMGenerator | null = null;
    let createdEnvTarget: THREE.WebGLRenderTarget | null = null;
    let createdControls: OrbitControls | null = null;
    let createdKeyLight: THREE.DirectionalLight | null = null;

    try {
      this.scene = new THREE.Scene();

      // Studio IBL via RoomEnvironment (zero external HDR network URLs)
      createdPmrem = new THREE.PMREMGenerator(this.renderer);
      this.pmrem = createdPmrem;
      const roomEnv = new RoomEnvironment();
      createdEnvTarget = this.pmrem.fromScene(roomEnv, 0.04);
      this.envRenderTarget = createdEnvTarget;
      this.scene.environment = this.envRenderTarget.texture;
      roomEnv.dispose();

      const aspect = width / height;
      const { vFov } = this.computeAspectFraming(aspect);
      this.camera = new THREE.PerspectiveCamera(vFov, aspect, 0.1, 55);
      const startAdapted = this.getAdaptedPreset('hero', aspect);
      this.camera.position.copy(startAdapted.pos);

      createdControls = new OrbitControls(this.camera, canvas);
      this.controls = createdControls;
      this.controls.target.copy(startAdapted.target);
      this.controls.enableDamping = !this.isSoftwareGl;
      this.controls.dampingFactor = 0.085;
      this.controls.enablePan = false;
      this.controls.minDistance = 2.0;
      this.controls.maxDistance = 16;
      this.controls.minPolarAngle = 0.14;
      this.controls.maxPolarAngle = Math.PI * 0.455;
      this.controls.addEventListener('start', () => {
        // Cancel scripted preset glide immediately so camera never fights manual user orbit
        this.camAnimActive = false;
        this.userHasOrbited = true;
      });
      this.controls.addEventListener('change', () => {
        this.requestRender();
      });
      this.controls.update();

      // Balanced Casino Chandelier Rig (no expensive RectAreaLight or multi-pass bloom overhead)
      this.hemiLight = new THREE.HemisphereLight(0x7aa2d4, 0x1e130c, 0.44);
      this.scene.add(this.hemiLight);

      createdKeyLight = new THREE.DirectionalLight(0xffe4bd, 1.08);
      this.keyLight = createdKeyLight;
      this.keyLight.position.set(2.4, 7.2, 3.2);
      this.keyLight.castShadow = !this.isSoftwareGl;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 16;
      this.keyLight.shadow.camera.left = -4.6;
      this.keyLight.shadow.camera.right = 4.6;
      this.keyLight.shadow.camera.top = 3.6;
      this.keyLight.shadow.camera.bottom = -3.6;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
      this.scene.add(this.keyLight);

      // Focused overhead casino chandelier spotlight creating a warm velvet pool across the felt
      this.casinoSpotLight = new THREE.SpotLight(0xffd596, 14, 16, Math.PI * 0.36, 0.92, 1.5);
      this.casinoSpotLight.position.set(0, 4.85, 0.22);
      this.casinoSpotLight.target.position.set(0, FELT_Y, 0);
      this.scene.add(this.casinoSpotLight);
      this.scene.add(this.casinoSpotLight.target);

      this.rimLight = new THREE.DirectionalLight(0xd99b43, 0.62);
      this.rimLight.position.set(-4.2, 3.4, -3.8);
      this.scene.add(this.rimLight);

      // Shared procedural textures (created once, reused across hand rebuilds)
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.contactShadowTex = createContactShadowTexture();
      this.cardBackTex = createCardBackTexture();
      this.floorTex = createStudioFloorTexture(maxAniso);
      this.chipSideTex = createChipSideTexture();
      this.chipTopTex = createChipTopTexture();
      this.dealerPuckTex = createDealerPuckTexture();

      // Luxury Axminster casino salon carpet floor
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.floorTex,
        roughness: 0.94,
        metalness: 0.02,
        envMapIntensity: 0.14,
      });
      const floor = new THREE.Mesh(new THREE.CircleGeometry(42, 56), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Grand Monte-Carlo Salon Privé architecture + Art-Deco chandelier + volumetric light cone
      const salonBackdrop = createCasinoSalonBackdropGroup(maxAniso);
      this.chandelierGroup = salonBackdrop.getObjectByName('ArtDecoSalonChandelier') ?? null;
      if (this.chandelierGroup) {
        const seenMats = new Set<THREE.Material>();
        this.chandelierGroup.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return;
          const mesh = obj as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (!m || seenMats.has(m)) continue;
            seenMats.add(m);
            const isShaderCone =
              m instanceof THREE.ShaderMaterial && Boolean(m.uniforms?.uOpacity);
            const baseOpacity = isShaderCone
              ? Number((m as THREE.ShaderMaterial).uniforms.uOpacity.value)
              : m.opacity;
            this.chandelierFadeEntries.push({ mat: m, baseOpacity, isShaderCone });
          }
        });
      }
      this.scene.add(salonBackdrop);

      // 5 Sculpted Executive Espresso-Leather Poker Chairs framing opponent seats
      const chairsGroup = createCasinoChairsGroup(this.contactShadowTex, !this.isSoftwareGl);
      this.scene.add(chairsGroup);

      // Composite Bellagio/Monte-Carlo casino poker table (with contrast piping & warm LED cove)
      this.tableAssembly = createPokerTableGroup(
        initialData.feltTheme,
        this.contactShadowTex,
        maxAniso,
        !this.isSoftwareGl
      );
      this.scene.add(this.tableAssembly.group);

      // Toggleable high-roller lounge props (crystal tumbler + gold protector + cigar rest)
      this.ambientPropsGroup = createAmbientPropsGroup(this.contactShadowTex, this.isSoftwareGl);
      this.ambientPropsGroup.visible = initialData.showProps ?? true;
      this.scene.add(this.ambientPropsGroup);

      // Warm golden dust motes suspended in the chandelier spotlight beam
      this.dustMotes = createChandelierDustMotes();
      this.scene.add(this.dustMotes);

      // Dynamic hand layer (rounded beveled cards, instanced chips, felt turn halos, dealer button, plaques)
      this.dynamicGroup = new THREE.Group();
      this.dynamicGroup.name = 'DynamicHandLayer';
      this.scene.add(this.dynamicGroup);

      // Persistent card layer: board + hole cards survive hand-layer rebuilds (keeps in-flight tweens & hero peek intact)
      this.cardsGroup = new THREE.Group();
      this.cardsGroup.name = 'PersistentCardsLayer';
      this.scene.add(this.cardsGroup);

      // Transient animation FX layer (individual staggered tossed bet chips & pot-sweep streams)
      this.fxGroup = new THREE.Group();
      this.fxGroup.name = 'AnimationFxLayer';
      this.scene.add(this.fxGroup);

      this.applyLighting(initialData.lighting);
      this.rebuildHandLayer(initialData);
      this.updateChandelierOpacity();
      this.updatePlaqueTilt(true);

      // Pre-compile shaders & render initial shadow map once so first deal has zero micro-stutter
      if (!this.isSoftwareGl) {
        this.renderer.shadowMap.needsUpdate = true;
        this.renderer.compile(this.scene, this.camera);
      }

      // Pointer listeners for Hero hole-card hover peek & WebGL context loss safety
      canvas.addEventListener('pointermove', this.handlePointerMove);
      canvas.addEventListener('pointerleave', this.handlePointerLeave);
      canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

      // ResizeObserver for crisp layout transitions (standard <-> Theater / Fullscreen)
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(container);

      this.requestRender();
    } catch (err) {
      // Clean up appended canvas & WebGL resources cleanly if constructor fails mid-init
      this.disposed = true;
      this.cancelScheduledFrame();
      this.soundEngine.dispose();
      createdControls?.dispose();
      createdKeyLight?.dispose();
      createdEnvTarget?.dispose();
      createdPmrem?.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      throw err;
    }
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (this.disposed || this.heroCardTargets.length === 0) return;
    const now = performance.now();
    if (now - this.lastRaycastMs < 40) return;
    this.lastRaycastMs = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointerNdc, this.camera);
    let hitIdx = -1;
    for (let i = 0; i < this.heroCardTargets.length; i++) {
      const hits = _raycaster.intersectObject(this.heroCardTargets[i].group, true);
      if (hits.length > 0) {
        hitIdx = i;
        break;
      }
    }

    if (hitIdx !== this.hoveredHeroCardIdx) {
      const wasHovering = this.hoveredHeroCardIdx >= 0;
      this.hoveredHeroCardIdx = hitIdx;
      this.renderer.domElement.style.cursor = hitIdx >= 0 ? 'pointer' : '';
      if (hitIdx >= 0) {
        this.soundEngine.playCardPeek(true);
      } else if (wasHovering) {
        this.soundEngine.playCardPeek(false);
      }
      this.requestRender();
    }
  };

  private handlePointerLeave = () => {
    if (this.hoveredHeroCardIdx !== -1) {
      this.hoveredHeroCardIdx = -1;
      this.renderer.domElement.style.cursor = '';
      this.soundEngine.playCardPeek(false);
      this.requestRender();
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.cancelScheduledFrame();
  };

  private handleContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    // Regenerate RoomEnvironment PMREM render target on restored WebGL context
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  };

  private cancelScheduledFrame() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private computeAspectFraming(aspect: number): { vFov: number; distScale: number } {
    const safeAspect = Math.max(0.42, aspect);
    const baseVFov = 42;
    const refAspect = 1.82;
    const targetHalfTanH = Math.tan(THREE.MathUtils.degToRad(baseVFov / 2)) * refAspect;
    const desiredVFov = THREE.MathUtils.radToDeg(2 * Math.atan(targetHalfTanH / safeAspect));
    const vFov = THREE.MathUtils.clamp(desiredVFov, 42, 58);
    const actualHalfTanH = Math.tan(THREE.MathUtils.degToRad(vFov / 2)) * safeAspect;
    const distScale = THREE.MathUtils.clamp(targetHalfTanH / actualHalfTanH, 1, 1.24);
    return { vFov, distScale };
  }

  private getAdaptedPreset(
    preset: CameraPresetId,
    aspect: number
  ): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const cfg = CAMERA_PRESETS[preset];
    const target = new THREE.Vector3(...cfg.target);
    const basePos = new THREE.Vector3(...cfg.pos);
    const { distScale } = this.computeAspectFraming(aspect);
    const effectiveScale = preset === 'closeup' ? Math.min(1.2, distScale) : distScale;
    const pos = target.clone().addScaledVector(basePos.sub(target), effectiveScale);
    return { pos, target };
  }

  private panForX(x: number): number {
    return THREE.MathUtils.clamp(x / 2.8, -0.8, 0.8);
  }

  private updateChandelierOpacity() {
    if (!this.chandelierGroup) return;
    const t = THREE.MathUtils.clamp((this.camera.position.y - 3.6) / (4.5 - 3.6), 0, 1);
    const smooth = t * t * (3 - 2 * t);
    const opacity = 1 - smooth;
    this.chandelierGroup.visible = opacity > 0.02;
    if (Math.abs(opacity - this.lastChandelierOpacity) < 0.002) return;
    this.lastChandelierOpacity = opacity;

    const isTransparent = opacity < 0.995;
    for (let i = 0; i < this.chandelierFadeEntries.length; i++) {
      const entry = this.chandelierFadeEntries[i];
      if (entry.isShaderCone) {
        (entry.mat as THREE.ShaderMaterial).uniforms.uOpacity.value = entry.baseOpacity * opacity;
      } else {
        entry.mat.opacity = entry.baseOpacity * opacity;
        entry.mat.transparent = isTransparent || entry.baseOpacity < 0.995;
        entry.mat.depthWrite = !isTransparent && entry.baseOpacity >= 0.995;
      }
    }
  }

  private updatePlaqueTilt(force = false) {
    if (this.seatPlaquePlates.length === 0) return;
    const dy = Math.max(0.01, this.camera.position.y - this.controls.target.y);
    const horiz = Math.hypot(
      this.camera.position.x - this.controls.target.x,
      this.camera.position.z - this.controls.target.z
    );
    const pitch = Math.atan2(dy, Math.max(0.01, horiz));
    const tiltBlend = THREE.MathUtils.clamp((pitch - 0.52) / (1.35 - 0.52), 0, 1);
    const smoothTilt = tiltBlend * tiltBlend * (3 - 2 * tiltBlend);
    const rotX = THREE.MathUtils.lerp(-0.14, -1.05, smoothTilt);
    if (!force && Math.abs(rotX - this.lastPlaqueRotX) < 0.002) return;
    this.lastPlaqueRotX = rotX;
    for (let i = 0; i < this.seatPlaquePlates.length; i++) {
      this.seatPlaquePlates[i].rotation.x = rotX;
    }
  }

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    if (width === this.lastWidth && height === this.lastHeight && dpr === this.lastDpr) {
      return;
    }
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastDpr = dpr;

    const aspect = width / height;
    const { vFov } = this.computeAspectFraming(aspect);
    this.camera.aspect = aspect;
    this.camera.fov = vFov;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    if (!this.userHasOrbited) {
      const adapted = this.getAdaptedPreset(this.currentCameraPreset, aspect);
      if (this.camAnimActive) {
        this.camTargetPos.copy(adapted.pos);
        this.camTargetLook.copy(adapted.target);
      } else {
        this.camera.position.copy(adapted.pos);
        this.controls.target.copy(adapted.target);
        this.controls.update();
      }
    }
    this.updateChandelierOpacity();
    this.updatePlaqueTilt();
    // Synchronous render prevents the cleared black WebGL drawing buffer from ever being presented
    if (!this.contextLost) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Mobile orbit lock/unlock: when disabled, single-finger vertical swipes scroll the page instead of orbiting. */
  public setOrbitEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.controls.enabled = enabled;
    this.renderer.domElement.style.touchAction = enabled ? 'none' : 'pan-y';
    if (!enabled) this.handlePointerLeave();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEngine.enabled = enabled;
  }

  public setShowProps(show: boolean) {
    if (this.disposed) return;
    if (this.ambientPropsGroup.visible !== show) {
      this.ambientPropsGroup.visible = show;
      this.requestRender();
    }
  }

  public setFeltTheme(theme: FeltThemeId) {
    if (this.disposed) return;
    if (theme !== this.currentFeltTheme) {
      this.currentFeltTheme = theme;
      this.tableAssembly.updateFeltTheme(theme, this.renderer.capabilities.getMaxAnisotropy());
      this.requestRender();
    }
  }

  public applyLighting(preset: LightingPresetId) {
    if (this.disposed) return;
    const cfg = LIGHTING_PRESETS[preset];
    this.scene.background = new THREE.Color(cfg.bg);
    this.scene.fog = new THREE.FogExp2(cfg.bg, cfg.fogDensity);
    this.keyLight.color.setHex(cfg.keyColor);
    this.keyLight.intensity = cfg.keyIntensity;
    this.casinoSpotLight.color.setHex(cfg.spotColor);
    this.casinoSpotLight.intensity = cfg.spotIntensity;
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;
    this.rimLight.color.setHex(cfg.rimColor);
    this.rimLight.intensity = cfg.rimIntensity;
    this.renderer.toneMappingExposure = cfg.exposure;
    this.requestRender();
  }

  public setCameraPreset(preset: CameraPresetId) {
    if (this.disposed) return;
    this.currentCameraPreset = preset;
    this.userHasOrbited = false;
    const adapted = this.getAdaptedPreset(preset, this.camera.aspect);
    if (this.isSoftwareGl) {
      this.camera.position.copy(adapted.pos);
      this.controls.target.copy(adapted.target);
      this.controls.update();
      this.camAnimActive = false;
      this.requestRender();
      return;
    }
    this.camTargetPos.copy(adapted.pos);
    this.camTargetLook.copy(adapted.target);
    this.camAnimActive = true;
    this.requestRender();
  }

  public updateHandLayer(
    data: Pick<Scene3DHandData, 'board' | 'potBb' | 'potText' | 'seats' | 'fourColorDeck' | 'cardStyle'>
  ) {
    if (this.disposed) return;
    this.rebuildHandLayer(data);
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  public updateSceneData(data: Scene3DHandData) {
    if (this.disposed) return;
    if (typeof data.soundEnabled === 'boolean') {
      this.soundEngine.enabled = data.soundEnabled;
    }
    if (data.feltTheme !== this.currentFeltTheme) {
      this.currentFeltTheme = data.feltTheme;
      this.tableAssembly.updateFeltTheme(
        data.feltTheme,
        this.renderer.capabilities.getMaxAnisotropy()
      );
    }
    this.ambientPropsGroup.visible = data.showProps ?? true;
    this.applyLighting(data.lighting);
    this.rebuildHandLayer(data);
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  private isSharedTexture(tex: THREE.Texture): boolean {
    return (
      tex === this.cardBackTex ||
      tex === this.contactShadowTex ||
      tex === this.chipSideTex ||
      tex === this.chipTopTex ||
      tex === this.dealerPuckTex ||
      this.cardFaceTexSet.has(tex) ||
      Boolean(tex.userData?.sharedFeltBadge)
    );
  }

  private getCardFaceTexture(
    card: Card,
    fourColor: boolean,
    cardStyle: CardStyle = 'classic'
  ): THREE.CanvasTexture {
    const key = `${card.rank}${card.suit}_${fourColor ? '4' : '2'}_${cardStyle}`;
    let tex = this.cardFaceTexCache.get(key);
    if (!tex) {
      tex = createCardFaceTexture(card, fourColor, cardStyle);
      this.cardFaceTexCache.set(key, tex);
      this.cardFaceTexSet.add(tex);
    }
    return tex;
  }

  /**
   * Spawns individually staggered clay poker chips with natural curved toss arcs,
   * playful mid-air tumble, and a crisp damped felt landing bounce.
   */
  private spawnFlyingChips(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    colorHex: number,
    chipCount: number,
    arcHeight: number,
    duration: number,
    baseDelay = 0,
    onLandFirst?: () => void,
    onLandLast?: () => void
  ) {
    const chipRadius = 0.095;
    const chipHeight = 0.023;
    const count = Math.max(1, Math.min(8, chipCount));

    // Direction perpendicular to toss vector for organic staggered lateral spread
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const perpX = -dz / len;
    const perpZ = dx / len;

    for (let c = 0; c < count; c++) {
      const singleChip = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(chipRadius, chipRadius, chipHeight, 16, 1, true);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        map: this.chipSideTex,
        roughness: 0.56,
        metalness: 0.06,
        envMapIntensity: 0.24,
      });
      const capGeo = new THREE.CylinderGeometry(chipRadius * 0.99, chipRadius * 0.99, 0.004, 16);
      const capColor = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.2);
      const capMat = new THREE.MeshStandardMaterial({
        color: capColor,
        map: this.chipTopTex,
        roughness: 0.54,
        metalness: 0.06,
        envMapIntensity: 0.22,
      });

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = chipHeight / 2;
      singleChip.add(body);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = chipHeight + 0.001;
      singleChip.add(cap);

      const spread = (c - (count - 1) / 2) * 0.14;
      const start = fromPos.clone().add(new THREE.Vector3(perpX * spread * 0.25, c * 0.015, perpZ * spread * 0.25));
      const end = toPos.clone().add(new THREE.Vector3(perpX * spread * 0.45, c * chipHeight, perpZ * spread * 0.45));
      const curveOffset = new THREE.Vector3(perpX * spread * 1.15, 0, perpZ * spread * 1.15);

      singleChip.position.copy(start);
      singleChip.visible = false;
      this.fxGroup.add(singleChip);

      this.activeTweens.push({
        obj: singleChip,
        fromPos: start,
        toPos: end,
        curveOffset,
        arcHeight: arcHeight + (c % 2) * 0.05,
        bounceHeight: 0.055,
        fromRot: new THREE.Euler(0.45 * (c % 2 === 0 ? 1 : -1), c * 0.7, -0.35),
        toRot: new THREE.Euler(0, Math.PI * (0.8 + c * 0.35), 0),
        delay: baseDelay + c * (this.isSoftwareGl ? 0.02 : 0.042),
        elapsed: 0,
        duration: duration + c * 0.018,
        disposeOnEnd: true,
        initialHidden: true,
        onLand:
          c === 0 || c === count - 1
            ? () => {
                if (c === 0) onLandFirst?.();
                if (c === count - 1) onLandLast?.();
              }
            : undefined,
      });
    }
  }

  private spawnCheckRipple(x: number, z: number) {
    const mesh = createCheckRippleMesh(0xf59e0b, 0.58);
    mesh.position.set(x, FELT_Y + 0.005, z);
    this.fxGroup.add(mesh);
    this.activeRipples.push({
      mesh,
      mat: mesh.material as THREE.ShaderMaterial,
      elapsed: 0,
      duration: this.isSoftwareGl ? 0.25 : 0.55,
    });
  }

  private spawnFoldMuckCards(
    fromX: number,
    fromZ: number,
    rotY: number,
    deckOrigin: THREE.Vector3,
    isHero: boolean
  ) {
    const dummyCard: Card = { rank: 'A', suit: 's' };
    const pan = this.panForX(fromX);
    for (let c = 0; c < 2; c++) {
      const muckCard = createPlayingCardGroup(
        dummyCard,
        false,
        false,
        this.cardBackTex,
        this.contactShadowTex,
        isHero ? 1.05 : 0.94
      );
      const startPos = new THREE.Vector3(
        fromX + (c === 0 ? -0.14 : 0.14),
        FELT_Y + (isHero ? 0.09 : 0.012),
        fromZ + c * 0.02
      );
      const startRot = new THREE.Euler(0, rotY + (c === 0 ? 0.12 : -0.12), 0);
      const endRot = new THREE.Euler(0, rotY + Math.PI * (1.25 + c * 0.35), 0);
      muckCard.position.copy(startPos);
      muckCard.rotation.copy(startRot);
      this.fxGroup.add(muckCard);

      this.activeTweens.push({
        obj: muckCard,
        fromPos: startPos,
        toPos: deckOrigin.clone(),
        curveOffset: new THREE.Vector3((c === 0 ? -0.18 : 0.18), 0, -0.12),
        arcHeight: 0.09 + c * 0.03,
        bounceHeight: 0,
        fromRot: startRot,
        toRot: endRot,
        delay: c * (this.isSoftwareGl ? 0.02 : 0.05),
        elapsed: 0,
        duration: this.isSoftwareGl ? 0.2 : 0.38,
        disposeOnEnd: true,
        onStart: c === 0 ? () => this.soundEngine.playCardMuck(pan) : undefined,
      });
    }
  }

  private disposeSingleFxObj(obj: THREE.Object3D) {
    this.fxGroup.remove(obj);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          m.dispose();
        }
      }
    });
  }

  private disposeTree(root: THREE.Object3D) {
    root.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        (obj as THREE.InstancedMesh).dispose();
      }
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const uniqueMats = new Set(mats);
        for (const m of uniqueMats) {
          if (!m) continue;
          const std = m as THREE.MeshStandardMaterial;
          if (std.map && !this.isSharedTexture(std.map)) {
            std.map.dispose();
          }
          m.dispose();
        }
      }
    });
  }

  private disposeCardGroup(obj: THREE.Object3D) {
    this.activeTweens = this.activeTweens.filter((tw) => tw.obj !== obj);
    this.cardsGroup.remove(obj);
    this.disposeTree(obj);
  }

  private disposeSeatEntry(entry: SeatCardEntry) {
    this.disposeCardGroup(entry.c1);
    this.disposeCardGroup(entry.c2);
  }

  /** Re-aim a persistent card: retarget its running tween, or snap if it is idle. */
  private retargetCard(obj: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler) {
    const tw = this.activeTweens.find((t) => t.obj === obj);
    if (tw) {
      tw.toPos.copy(pos);
      tw.toRot.copy(rot);
    } else {
      obj.position.copy(pos);
      obj.rotation.copy(rot);
    }
  }

  private refreshChipsMesh() {
    if (this.chipsGroup) {
      this.dynamicGroup.remove(this.chipsGroup);
      this.disposeTree(this.chipsGroup);
      this.chipsGroup = null;
    }
    const specs: ChipStackSpec[] = [...this.chipBaseSpecs];
    for (const entry of this.betChipEntries) {
      const pending = this.pendingBetChips.get(entry.seatIndex);
      const chips = pending ? pending.chips : entry.fullChips;
      if (chips > 0) specs.push({ ...entry.spec, chips });
    }
    this.chipsGroup = createChipStacksGroup(
      specs,
      this.contactShadowTex,
      this.chipSideTex,
      this.chipTopTex
    );
    this.dynamicGroup.add(this.chipsGroup);
  }

  private addFeltBadge(text: string, variant: 'pot' | 'bet', x: number, z: number) {
    const badge = createFeltBadgeMesh(createFeltBadgeTexture(text, variant));
    badge.position.x = x;
    badge.position.z = z;
    this.dynamicGroup.add(badge);
  }

  private rebuildHandLayer(
    data: Pick<Scene3DHandData, 'board' | 'potBb' | 'potText' | 'seats' | 'fourColorDeck' | 'cardStyle'>
  ) {
    const cardStyle: CardStyle = data.cardStyle ?? 'classic';
    // Keep FX tweens and persistent card tweens running; only drop tweens of meshes about to be disposed
    this.activeTweens = this.activeTweens.filter(
      (tw) => tw.disposeOnEnd || tw.obj.parent === this.cardsGroup
    );
    this.activeHaloMats = [];
    this.seatPlaquePlates = [];
    this.chipsGroup = null;

    // Cleanly dispose previous dynamic meshes & per-plaque textures (preserve shared & cached textures)
    while (this.dynamicGroup.children.length > 0) {
      const child = this.dynamicGroup.children[0];
      this.dynamicGroup.remove(child);
      this.disposeTree(child);
    }

    const deckOrigin = new THREE.Vector3(
      DEALER_DECK_POS[0],
      DEALER_DECK_POS[1] + 0.045,
      DEALER_DECK_POS[2]
    );
    const nextBoardKeys = data.board.map((c) => `${c.rank}${c.suit}`);
    const isFreshBoard =
      this.initializedHandOnce &&
      (nextBoardKeys.length < this.prevBoardKeys.length ||
        nextBoardKeys.some((k, idx) => idx < this.prevBoardKeys.length && k !== this.prevBoardKeys[idx]));

    const heroSeat = data.seats.find((s) => s.isHero);
    const nextHeroCardsSig = heroSeat?.cards
      ? `${heroSeat.cards[0].rank}${heroSeat.cards[0].suit}-${heroSeat.cards[1].rank}${heroSeat.cards[1].suit}`
      : '';
    const isNewHoleDeal =
      this.initializedHandOnce && nextHeroCardsSig !== '' && nextHeroCardsSig !== this.prevHeroCardsSig;

    if (isFreshBoard) {
      for (const entry of this.boardCardMap.values()) this.disposeCardGroup(entry.group);
      this.boardCardMap.clear();
    }
    if (isNewHoleDeal) {
      for (const entry of this.seatCardMap.values()) this.disposeSeatEntry(entry);
      this.seatCardMap.clear();
    }

    // On real GPUs, animate the very first hand deal smoothly so the studio comes alive on open
    const animateInitialEntrance = !this.initializedHandOnce && !this.isSoftwareGl;

    // 1. Community Board Cards — face-down flight from dealer stub with crisp mid-air 180° flip & settle bounce!
    const boardCount = data.board.length;
    const cardSpacing = 0.44;
    const startX = -((Math.max(boardCount, 1) - 1) * cardSpacing) / 2;
    let boardAnimOrder = 0;
    const newlyDealtCount = data.board.filter(
      (_, i) => animateInitialEntrance || (this.initializedHandOnce && (isFreshBoard || i >= this.prevBoardKeys.length))
    ).length;
    const isSingleStreetPeel = newlyDealtCount === 1 && boardCount >= 4;

    const seenBoardKeys = new Set<string>();
    for (let i = 0; i < boardCount; i++) {
      const boardKey = `${i}|${nextBoardKeys[i]}|${data.fourColorDeck ? 4 : 2}|${cardStyle}`;
      seenBoardKeys.add(boardKey);
      const targetPos = new THREE.Vector3(startX + i * cardSpacing, FELT_Y + 0.002, -0.08);
      const targetRot = new THREE.Euler(0, (i - (boardCount - 1) / 2) * 0.018, 0);
      const existingBoard = this.boardCardMap.get(boardKey);
      if (existingBoard) {
        this.retargetCard(existingBoard.group, targetPos, targetRot);
        continue;
      }
      const cardGrp = createPlayingCardGroup(
        data.board[i],
        true,
        data.fourColorDeck,
        this.cardBackTex,
        this.contactShadowTex,
        1.05,
        this.getCardFaceTexture(data.board[i], data.fourColorDeck, cardStyle)
      );
      cardGrp.position.copy(targetPos);
      cardGrp.rotation.copy(targetRot);
      this.cardsGroup.add(cardGrp);
      this.boardCardMap.set(boardKey, { group: cardGrp });

      const isNewlyDealt =
        animateInitialEntrance ||
        (this.initializedHandOnce && (isFreshBoard || i >= this.prevBoardKeys.length));
      if (isNewlyDealt) {
        const baseBoardDelay = animateInitialEntrance ? 0.34 : isNewHoleDeal ? 0.42 : 0.08;
        const delay = baseBoardDelay + boardAnimOrder * (this.isSoftwareGl ? 0.025 : 0.14);
        const startRot = new THREE.Euler(-0.14, 0.56 + Math.PI * 0.25, Math.PI);
        cardGrp.position.copy(deckOrigin);
        cardGrp.rotation.copy(startRot);
        cardGrp.visible = false;

        const pan = this.panForX(targetPos.x);
        this.activeTweens.push({
          obj: cardGrp,
          fromPos: deckOrigin.clone(),
          toPos: targetPos,
          curveOffset: new THREE.Vector3(0.14, 0, -0.22),
          arcHeight: isSingleStreetPeel ? 0.31 : 0.21,
          bounceHeight: 0.022,
          fromRot: startRot,
          toRot: targetRot,
          flipCard: true,
          delay,
          elapsed: 0,
          duration: this.isSoftwareGl ? 0.22 : isSingleStreetPeel ? 0.62 : 0.48,
          initialHidden: true,
          onStart: !animateInitialEntrance
            ? () => this.soundEngine.playCardSlide(0, pan, 0.85)
            : undefined,
          onFlip: !animateInitialEntrance
            ? () => this.soundEngine.playCardFlipSnap(pan)
            : undefined,
          onLand: !animateInitialEntrance
            ? () => this.soundEngine.playCardFeltSlap(pan)
            : undefined,
        });
        boardAnimOrder++;
      }
    }

    for (const [key, entry] of this.boardCardMap) {
      if (!seenBoardKeys.has(key)) {
        this.disposeCardGroup(entry.group);
        this.boardCardMap.delete(key);
      }
    }

    // 2. Center Pot Clay Chip Stacks ($25 emerald, $100 charcoal, $500 purple, $1000 gold)
    const chipSpecs: ChipStackSpec[] = [];
    const betEntries: BetChipEntry[] = [];
    const nextHeroTargets: HeroCardPeekTarget[] = [];
    const seenSeatCards = new Set<number>();
    const potChipsTotal = Math.max(4, Math.min(28, Math.round(data.potBb * 0.7)));
    const stackColors = [0x0d7a55, 0x1d2432, 0xd97706, 0x6d28d9];
    const potStackCount = Math.min(4, Math.max(2, Math.ceil(potChipsTotal / 7)));
    for (let p = 0; p < potStackCount; p++) {
      const chipsInStack = Math.max(2, Math.min(9, Math.round(potChipsTotal / potStackCount) + (p % 2)));
      const angle = (p / potStackCount) * Math.PI * 2 + 0.4;
      chipSpecs.push({
        x: Math.cos(angle) * 0.28,
        z: -0.64 + Math.sin(angle) * 0.15,
        chips: chipsInStack,
        colorHex: stackColors[p % stackColors.length],
      });
    }

    // 3. Seats: Round-Robin Hole Cards, Active/Winner Felt Halos, Stacks, Staggered Bet Tosses & Plaques
    const activeSeatsCount = Math.min(6, data.seats.length);
    const anchors = getAnchorsForSeatCount(activeSeatsCount);
    const nextStreetBets = new Map<number, { bet: number; x: number; z: number }>();
    const nextFoldedSeats = new Set<number>();
    const nextActionSigs = new Map<number, string>();
    const nextRevealedSeats = new Set<number>();
    const nextAllInSeats = new Set<number>();
    let nextDealerSeatIdx: number | null = null;
    let nextDealerPos: THREE.Vector3 | null = null;
    let totalCurrentStreetBets = 0;
    let winnerPos: THREE.Vector3 | null = null;
    let winnerCount = 0;
    let heroIsWinner = false;
    let isHeroTurnNow = false;

    for (let i = 0; i < activeSeatsCount; i++) {
      const seat = data.seats[i];
      const anchor = anchors[i];
      const isTopCenter = Math.abs(anchor.x) < 0.1 && anchor.z < 0;
      const isSideSeat = !seat.isHero && !isTopCenter;
      const chipBaseX = seat.isHero
        ? -0.96
        : isTopCenter
          ? 0.56
          : anchor.x * 0.58;
      const chipBaseZ = seat.isHero
        ? anchor.z * 0.65 - 0.06
        : isTopCenter
          ? anchor.z * 0.65
          : anchor.z * 0.9;
      const sideHoleX = isSideSeat ? anchor.x * 0.75 : anchor.x * 0.72;
      const sideHoleZ = isSideSeat ? anchor.z * 0.46 : anchor.z * 0.54;
      const seatFxX = seat.isHero ? 0 : sideHoleX;
      const seatFxZ = seat.isHero ? 1.12 : sideHoleZ;

      if (seat.folded) {
        nextFoldedSeats.add(seat.seatIndex);
      }
      if (seat.isHero && !seat.folded && seat.isActiveTurn) {
        isHeroTurnNow = true;
      }

      if (seat.isWinner) {
        winnerCount++;
        if (seat.isHero) heroIsWinner = true;
        if (!winnerPos || seat.isHero) {
          winnerPos = new THREE.Vector3(chipBaseX, FELT_Y + 0.04, chipBaseZ);
        }
      }

      // Fold mucking: slide 2 face-down cards back to dealer deck + muck foley
      if (
        this.initializedHandOnce &&
        !isNewHoleDeal &&
        seat.folded &&
        !this.prevFoldedSeats.has(seat.seatIndex)
      ) {
        this.spawnFoldMuckCards(seatFxX, seatFxZ, anchor.rotY, deckOrigin, seat.isHero);
      }

      // Check ripple + double-tap foley when seat's action updates to check
      const actionSig = `${seat.actionKind ?? ''}|${seat.actionText ?? ''}|${seat.streetBetBb ?? 0}`;
      nextActionSigs.set(seat.seatIndex, actionSig);
      const isCheckAction =
        seat.actionKind === 'check' ||
        (!seat.actionKind &&
          Boolean(seat.actionText && (/check/i.test(seat.actionText) || seat.actionText.includes('过牌'))));
      if (
        this.initializedHandOnce &&
        !isNewHoleDeal &&
        !seat.folded &&
        isCheckAction &&
        actionSig !== this.prevActionSigs.get(seat.seatIndex)
      ) {
        this.spawnCheckRipple(seatFxX, seatFxZ);
        this.soundEngine.playCheckDoubleTap(this.panForX(seatFxX));
      }

      // Seat plaque mounted flush atop the padded leather bolster crown, gently angled toward Hero for effortless reading
      const plaque = createSeatPlaqueMesh(seat, data.fourColorDeck);
      plaque.position.set(anchor.x * 1.1, FELT_Y + 0.212, anchor.z * 1.1);
      plaque.lookAt(0, FELT_Y + 0.212, isSideSeat ? 1.55 : 0);
      if (seat.isHero) {
        plaque.position.set(1.12, FELT_Y + 0.212, 1.9);
        plaque.rotation.set(0, -0.2, 0);
      }
      const plateObj = plaque.getObjectByName('SeatPlaquePlate');
      if (plateObj && (plateObj as THREE.Mesh).isMesh) {
        this.seatPlaquePlates.push(plateObj as THREE.Mesh);
      }
      this.dynamicGroup.add(plaque);

      // Subtle glowing felt aura ring beneath active-turn seat (emerald) or showdown winner (gold)
      if (!seat.folded && (seat.isWinner || seat.isActiveTurn)) {
        const haloColor = seat.isWinner ? 0xfbbf24 : 0x34d399;
        const haloRadius = seat.isHero ? 0.72 : 0.58;
        const haloMesh = createTurnHaloMesh(haloColor, haloRadius);
        haloMesh.position.set(seatFxX, FELT_Y + 0.004, seatFxZ);
        this.dynamicGroup.add(haloMesh);
        this.activeHaloMats.push(haloMesh.material as THREE.ShaderMaterial);
      }

      // Player chip stacks on felt near seat (offset cleanly from opponent hole cards so Top-Down never overlaps)
      if (seat.stackBb > 0) {
        const stackA = Math.max(2, Math.min(10, Math.round(seat.stackBb / 12)));
        const stackB = Math.max(1, Math.min(8, Math.round(seat.stackBb / 18)));
        const stackBOffsetX = isSideSeat ? Math.sign(anchor.x) * 0.21 : 0.22;
        const stackBOffsetZ = isSideSeat ? Math.sign(anchor.z) * 0.05 : 0.08;

        chipSpecs.push({
          x: chipBaseX,
          z: chipBaseZ,
          chips: stackA,
          colorHex: seat.isHero ? 0x0d7a55 : 0x1d2432,
        });
        chipSpecs.push({
          x: chipBaseX + stackBOffsetX,
          z: chipBaseZ + stackBOffsetZ,
          chips: stackB,
          colorHex: seat.isHero ? 0xd97706 : 0x991b1b,
        });
      }

      // Forward street-bet chips pushed toward center betting line whenever seat has bet this street
      const betX = anchor.x * 0.45 + (seat.isHero ? 0.52 : 0);
      const betZ = anchor.z * 0.42 + (seat.isHero ? -0.05 : 0);
      const streetBet = seat.streetBetBb ?? 0;
      const isAllInNow = Boolean(
        seat.isAllIn ||
          seat.actionKind === 'all_in' ||
          (seat.actionText && (/all-?in/i.test(seat.actionText) || seat.actionText.includes('全下')))
      );
      if (isAllInNow) {
        nextAllInSeats.add(seat.seatIndex);
      }
      const newlyAllIn =
        this.initializedHandOnce &&
        !isNewHoleDeal &&
        isAllInNow &&
        !this.prevAllInSeats.has(seat.seatIndex);

      const prevSeatBet = this.prevStreetBets.get(seat.seatIndex)?.bet ?? 0;
      const betIncreased = this.initializedHandOnce && streetBet > prevSeatBet + 0.05;
      let releaseBetChips: (() => void) | undefined;
      if (betIncreased) {
        // Hold back newly added destination chips until the flying chips actually land
        const prevChips = prevSeatBet > 0 ? Math.max(1, Math.min(8, Math.ceil(prevSeatBet / 1.8))) : 0;
        const token = ++this.betTokenSeq;
        this.pendingBetChips.set(seat.seatIndex, { chips: prevChips, token });
        releaseBetChips = () => {
          if (this.disposed) return;
          if (this.pendingBetChips.get(seat.seatIndex)?.token !== token) return;
          this.pendingBetChips.delete(seat.seatIndex);
          this.refreshChipsMesh();
          this.renderer.shadowMap.needsUpdate = true;
          this.requestRender();
        };
      } else if (streetBet <= 0) {
        this.pendingBetChips.delete(seat.seatIndex);
      }

      if (newlyAllIn) {
        const allInPan = this.panForX(betX);
        this.spawnFlyingChips(
          new THREE.Vector3(chipBaseX, FELT_Y + 0.06, chipBaseZ),
          new THREE.Vector3(betX, FELT_Y + 0.015, betZ),
          0xd97706,
          7,
          0.32,
          this.isSoftwareGl ? 0.24 : 0.48,
          0,
          () => this.soundEngine.playChipClink(4, 0, allInPan),
          releaseBetChips
        );
        this.soundEngine.playAllInSting(allInPan);
      }

      if (streetBet > 0) {
        totalCurrentStreetBets += streetBet;
        nextStreetBets.set(seat.seatIndex, { bet: streetBet, x: betX, z: betZ });
        const betChips = Math.max(1, Math.min(8, Math.ceil(streetBet / 1.8)));
        const betColor = streetBet >= 8 ? 0xd97706 : 0x6d28d9;
        betEntries.push({
          seatIndex: seat.seatIndex,
          fullChips: betChips,
          spec: { x: betX, z: betZ, chips: betChips, colorHex: betColor },
        });
        this.addFeltBadge(
          seat.betText ?? `${streetBet.toFixed(1)}bb`,
          'bet',
          betX + (betX < 0 ? -0.3 : 0.3),
          betZ
        );

        // Staggered curved chip-toss arcs whenever this seat adds chips to the betting line
        if (!newlyAllIn && betIncreased) {
          const flyCount = Math.min(4, Math.max(1, Math.ceil((streetBet - prevSeatBet) / 2.2)));
          const betPan = this.panForX(betX);
          this.spawnFlyingChips(
            new THREE.Vector3(chipBaseX, FELT_Y + 0.06, chipBaseZ),
            new THREE.Vector3(betX, FELT_Y + 0.015, betZ),
            betColor,
            flyCount,
            0.25,
            this.isSoftwareGl ? 0.22 : 0.44,
            0,
            () => this.soundEngine.playChipClink(Math.min(4, flyCount), 0, betPan),
            releaseBetChips
          );
        }
      }

      // Dealer button puck near BTN seat (smoothly glides when dealer button moves!)
      if (seat.isDealer) {
        const puck = createDealerPuckGroup(this.contactShadowTex, this.dealerPuckTex);
        const puckTarget = isTopCenter
          ? new THREE.Vector3(0.56, FELT_Y + 0.002, anchor.z * 0.48)
          : new THREE.Vector3(anchor.x * 0.54 + 0.34, FELT_Y + 0.002, anchor.z * 0.52);
        nextDealerSeatIdx = seat.seatIndex;
        nextDealerPos = puckTarget.clone();

        if (
          this.initializedHandOnce &&
          this.prevDealerSeatIdx !== null &&
          seat.seatIndex !== this.prevDealerSeatIdx &&
          this.prevDealerPos
        ) {
          puck.position.copy(this.prevDealerPos);
          this.activeTweens.push({
            obj: puck,
            fromPos: this.prevDealerPos.clone(),
            toPos: puckTarget,
            curveOffset: new THREE.Vector3(0, 0, 0),
            arcHeight: 0.06,
            bounceHeight: 0.01,
            fromRot: new THREE.Euler(0, 0, 0),
            toRot: new THREE.Euler(0, 0, 0),
            delay: 0,
            elapsed: 0,
            duration: this.isSoftwareGl ? 0.2 : 0.42,
          });
        } else {
          puck.position.copy(puckTarget);
        }
        this.dynamicGroup.add(puck);
      }

      // Hole cards (round-robin casino deal: pass 1 then pass 2; Hero cards lift cleanly & support hover-peek!)
      if (seat.cards && !seat.folded) {
        const reveal = Boolean(seat.isHero || seat.revealCards);
        if (seat.revealCards) {
          nextRevealedSeats.add(seat.seatIndex);
        }
        const cardScale = seat.isHero ? 1.18 : reveal ? 1.08 : 0.96;
        const cardSig = `${seat.cards[0].rank}${seat.cards[0].suit}-${seat.cards[1].rank}${seat.cards[1].suit}|${reveal ? 1 : 0}|${data.fourColorDeck ? 4 : 2}|${cardStyle}|${seat.isHero ? 1 : 0}`;
        // Showdown winner spotlight: revealed winning hand rises slightly and tilts toward the camera
        const spot = Boolean(seat.isWinner && reveal);
        const liftY = spot ? 0.035 : 0;
        const liftRot = spot ? 0.1 : 0;

        let pos1: THREE.Vector3;
        let rot1: THREE.Euler;
        let pos2: THREE.Vector3;
        let rot2: THREE.Euler;

        if (seat.isHero) {
          pos1 = new THREE.Vector3(-0.24, FELT_Y + 0.115 + liftY, 1.12);
          rot1 = new THREE.Euler(0.22 + liftRot, 0.09, 0);
          pos2 = new THREE.Vector3(0.24, FELT_Y + 0.115 + liftY, 1.12);
          rot2 = new THREE.Euler(0.22 + liftRot, -0.09, 0);
        } else if (reveal) {
          // Showdown opponent reveal: rest flat on the felt, pulled clear of the far rail/puck and oriented upright
          const cx = isTopCenter ? 0 : anchor.x * 0.66;
          const cz = isTopCenter ? anchor.z * 0.54 : anchor.z * 0.46;
          pos1 = new THREE.Vector3(cx - 0.21, FELT_Y + 0.005 + liftY, cz);
          rot1 = new THREE.Euler(liftRot, 0.05, 0);
          pos2 = new THREE.Vector3(cx + 0.21, FELT_Y + 0.006 + liftY, cz);
          rot2 = new THREE.Euler(liftRot, -0.05, 0);
        } else {
          const cx = sideHoleX;
          const cz = sideHoleZ;
          pos1 = new THREE.Vector3(cx - 0.14, FELT_Y + 0.004 + liftY, cz);
          rot1 = new THREE.Euler(liftRot, anchor.rotY + 0.12, 0);
          pos2 = new THREE.Vector3(cx + 0.14, FELT_Y + 0.006 + liftY, cz + 0.02);
          rot2 = new THREE.Euler(liftRot, anchor.rotY - 0.12, 0);
        }

        const existingSeat = this.seatCardMap.get(seat.seatIndex);
        if (existingSeat && existingSeat.sig === cardSig) {
          // Unchanged hole cards stay mounted: running deal tweens and hero peek state are preserved
          seenSeatCards.add(seat.seatIndex);
          if (existingSeat.spot !== spot) {
            existingSeat.spot = spot;
            this.retargetCard(existingSeat.c1, pos1, rot1);
            this.retargetCard(existingSeat.c2, pos2, rot2);
            existingSeat.targets.forEach((target, idx) => {
              target.basePos.copy(idx === 0 ? pos1 : pos2);
              target.baseRot.copy(idx === 0 ? rot1 : rot2);
              if (
                (target.peekAmount !== 0 || target.sideOffset !== 0) &&
                !this.activeTweens.some((tw) => tw.obj === target.group)
              ) {
                target.group.position.set(
                  target.basePos.x + target.sideOffset * 0.045,
                  target.basePos.y + target.peekAmount * 0.125,
                  target.basePos.z + target.peekAmount * 0.065
                );
                target.group.rotation.set(
                  target.baseRot.x + target.peekAmount * 0.26,
                  target.baseRot.y - target.sideOffset * 0.04,
                  target.baseRot.z
                );
              }
            });
          }
          if (seat.isHero) nextHeroTargets.push(...existingSeat.targets);
          continue;
        }
        if (existingSeat) {
          this.disposeSeatEntry(existingSeat);
          this.seatCardMap.delete(seat.seatIndex);
        }

        const c1 = createPlayingCardGroup(
          seat.cards[0],
          reveal,
          data.fourColorDeck,
          this.cardBackTex,
          this.contactShadowTex,
          cardScale,
          reveal ? this.getCardFaceTexture(seat.cards[0], data.fourColorDeck, cardStyle) : undefined
        );
        const c2 = createPlayingCardGroup(
          seat.cards[1],
          reveal,
          data.fourColorDeck,
          this.cardBackTex,
          this.contactShadowTex,
          cardScale,
          reveal ? this.getCardFaceTexture(seat.cards[1], data.fourColorDeck, cardStyle) : undefined
        );

        const targets: HeroCardPeekTarget[] = [];
        if (seat.isHero) {
          targets.push(
            { group: c1, basePos: pos1.clone(), baseRot: rot1.clone(), peekAmount: 0, sideOffset: 0 },
            { group: c2, basePos: pos2.clone(), baseRot: rot2.clone(), peekAmount: 0, sideOffset: 0 }
          );
          nextHeroTargets.push(...targets);
        }

        c1.position.copy(pos1);
        c1.rotation.copy(rot1);
        c2.position.copy(pos2);
        c2.rotation.copy(rot2);
        this.cardsGroup.add(c1, c2);
        this.seatCardMap.set(seat.seatIndex, { sig: cardSig, spot, c1, c2, targets });
        seenSeatCards.add(seat.seatIndex);

        const newlyRevealedOpponent =
          this.initializedHandOnce &&
          !isNewHoleDeal &&
          !seat.isHero &&
          Boolean(seat.revealCards) &&
          !this.prevRevealedSeats.has(seat.seatIndex);

        if (isNewHoleDeal || animateInitialEntrance) {
          const dealDur = this.isSoftwareGl ? 0.22 : 0.46;
          const stagger = this.isSoftwareGl ? 0.02 : 0.075;
          // Authentic round-robin order: pass 1 across seats, then pass 2
          const delay1 = i * stagger;
          const delay2 = (activeSeatsCount + i) * stagger;
          const startRot1 = new THREE.Euler(0, 0.56 + 0.45, seat.isHero ? Math.PI : 0);
          const startRot2 = new THREE.Euler(0, 0.56 - 0.35, seat.isHero ? Math.PI : 0);

          c1.position.copy(deckOrigin);
          c1.rotation.copy(startRot1);
          c1.visible = false;
          c2.position.copy(deckOrigin);
          c2.rotation.copy(startRot2);
          c2.visible = false;

          // Subtle curved dealer-flick offset toward table center
          const flickCurve = new THREE.Vector3(-pos1.x * 0.14, 0, -0.18);
          const pan1 = this.panForX(pos1.x);
          const pan2 = this.panForX(pos2.x);
          const slideGain = seat.isHero ? 0.78 : 0.42;

          this.activeTweens.push(
            {
              obj: c1,
              fromPos: deckOrigin.clone(),
              toPos: pos1,
              curveOffset: flickCurve,
              arcHeight: seat.isHero ? 0.24 : 0.16,
              bounceHeight: seat.isHero ? 0.015 : 0.018,
              fromRot: startRot1,
              toRot: rot1,
              flipCard: seat.isHero,
              delay: delay1,
              elapsed: 0,
              duration: dealDur,
              initialHidden: true,
              onStart: !animateInitialEntrance
                ? () => this.soundEngine.playCardSlide(0, pan1, slideGain)
                : undefined,
              onFlip:
                seat.isHero && !animateInitialEntrance
                  ? () => this.soundEngine.playCardFlipSnap(pan1)
                  : undefined,
              onLand:
                seat.isHero && !animateInitialEntrance
                  ? () => this.soundEngine.playCardFeltSlap(pan1)
                  : undefined,
            },
            {
              obj: c2,
              fromPos: deckOrigin.clone(),
              toPos: pos2,
              curveOffset: flickCurve.clone().multiplyScalar(0.8),
              arcHeight: seat.isHero ? 0.26 : 0.18,
              bounceHeight: seat.isHero ? 0.015 : 0.018,
              fromRot: startRot2,
              toRot: rot2,
              flipCard: seat.isHero,
              delay: delay2,
              elapsed: 0,
              duration: dealDur,
              initialHidden: true,
              onStart: !animateInitialEntrance
                ? () => this.soundEngine.playCardSlide(0, pan2, slideGain)
                : undefined,
              onFlip:
                seat.isHero && !animateInitialEntrance
                  ? () => this.soundEngine.playCardFlipSnap(pan2)
                  : undefined,
              onLand:
                seat.isHero && !animateInitialEntrance
                  ? () => this.soundEngine.playCardFeltSlap(pan2)
                  : undefined,
            }
          );
        } else if (newlyRevealedOpponent) {
          // Snappy showdown flip-and-lift from face-down felt position into upright viewer-facing pose
          const pan = this.panForX(sideHoleX);
          const startPos1 = new THREE.Vector3(sideHoleX - 0.14, FELT_Y + 0.005, sideHoleZ);
          const startPos2 = new THREE.Vector3(sideHoleX + 0.14, FELT_Y + 0.006, sideHoleZ + 0.02);
          const flipStart1 = new THREE.Euler(0, rot1.y, Math.PI);
          const flipStart2 = new THREE.Euler(0, rot2.y, Math.PI);
          c1.position.copy(startPos1);
          c2.position.copy(startPos2);
          c1.rotation.copy(flipStart1);
          c2.rotation.copy(flipStart2);
          this.activeTweens.push(
            {
              obj: c1,
              fromPos: startPos1,
              toPos: pos1,
              curveOffset: new THREE.Vector3(0, 0, 0),
              arcHeight: 0.14,
              bounceHeight: 0.015,
              fromRot: flipStart1,
              toRot: rot1,
              flipCard: true,
              delay: 0,
              elapsed: 0,
              duration: this.isSoftwareGl ? 0.18 : 0.36,
              onFlip: () => this.soundEngine.playCardFlipSnap(pan),
              onLand: () => this.soundEngine.playCardFeltSlap(pan),
            },
            {
              obj: c2,
              fromPos: startPos2,
              toPos: pos2,
              curveOffset: new THREE.Vector3(0, 0, 0),
              arcHeight: 0.14,
              bounceHeight: 0.015,
              fromRot: flipStart2,
              toRot: rot2,
              flipCard: true,
              delay: this.isSoftwareGl ? 0.02 : 0.08,
              elapsed: 0,
              duration: this.isSoftwareGl ? 0.18 : 0.34,
              onFlip: () => this.soundEngine.playCardFlipSnap(pan),
              onLand: () => this.soundEngine.playCardFeltSlap(pan),
            }
          );
        }
      }
    }

    // Seats that folded / lost their cards: drop their persistent hole cards
    for (const [seatIdx, entry] of this.seatCardMap) {
      if (!seenSeatCards.has(seatIdx)) {
        this.disposeSeatEntry(entry);
        this.seatCardMap.delete(seatIdx);
      }
    }
    if (nextHeroTargets.length !== this.heroCardTargets.length) {
      this.hoveredHeroCardIdx = -1;
    }
    this.heroCardTargets = nextHeroTargets;

    // Hero turn attention ping when Hero's turn begins
    if (this.initializedHandOnce && isHeroTurnNow && !this.prevHeroTurn) {
      this.soundEngine.playHeroTurnPing();
    }

    // Pot-sweep animation when prior street bets are collected into center pot on a street transition
    if (
      this.initializedHandOnce &&
      this.prevStreetBets.size > 0 &&
      totalCurrentStreetBets === 0 &&
      data.potBb >= this.prevPotBb
    ) {
      let sweepIdx = 0;
      for (const prev of this.prevStreetBets.values()) {
        const isFirstSweep = sweepIdx === 0;
        this.spawnFlyingChips(
          new THREE.Vector3(prev.x, FELT_Y + 0.025, prev.z),
          new THREE.Vector3(0, FELT_Y + 0.04, -0.64),
          prev.bet >= 8 ? 0xd97706 : 0x0d7a55,
          2,
          0.14,
          this.isSoftwareGl ? 0.22 : 0.34,
          sweepIdx * 0.05,
          isFirstSweep ? () => this.soundEngine.playChipClink(3, 0, 0) : undefined
        );
        sweepIdx++;
      }
    }

    // Celebratory winner payout stream sweeping chips from center pot straight to the showdown winner!
    const hasWinnerNow = winnerCount > 0;
    if (this.initializedHandOnce && hasWinnerNow && !this.prevHadWinner) {
      const winnerPan = winnerPos ? this.panForX(winnerPos.x) : 0;
      const cue: 'win' | 'loss' | 'split' =
        winnerCount > 1 ? 'split' : heroIsWinner ? 'win' : 'loss';
      if (winnerPos) {
        this.spawnFlyingChips(
          new THREE.Vector3(0, FELT_Y + 0.05, -0.64),
          winnerPos,
          0xd97706,
          4,
          0.22,
          this.isSoftwareGl ? 0.26 : 0.44,
          0.08,
          () => this.soundEngine.playChipClink(4, 0, winnerPan)
        );
      }
      this.soundEngine.playShowdownCue(cue, winnerPan);
    }

    // Neat stacked casino dealer stub deck (filigree card back + warm matte edges) near far-left dealer bay
    const stubMatEdge = new THREE.MeshStandardMaterial({
      color: 0xbcb3a0,
      roughness: 0.86,
      metalness: 0.0,
      envMapIntensity: 0.05,
    });
    const stubMatTop = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.cardBackTex,
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.06,
    });
    const stubDeck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.075, 0.45), [
      stubMatEdge,
      stubMatEdge,
      stubMatTop,
      stubMatEdge,
      stubMatEdge,
      stubMatEdge,
    ]);
    stubDeck.position.set(DEALER_DECK_POS[0], DEALER_DECK_POS[1], DEALER_DECK_POS[2]);
    stubDeck.rotation.y = 0.56;
    stubDeck.castShadow = !this.isSoftwareGl;
    stubDeck.receiveShadow = true;
    this.dynamicGroup.add(stubDeck);

    // Center pot amount badge floating just in front of the pot chips
    if (data.potBb > 0) {
      this.addFeltBadge(data.potText ?? `Pot ${data.potBb.toFixed(1)} bb`, 'pot', 0, -0.44);
    }

    // Build all chips via single InstancedMesh group (bet chips lag behind until flying chips land)
    this.chipBaseSpecs = chipSpecs;
    this.betChipEntries = betEntries;
    this.refreshChipsMesh();

    // Ensure freshly created seat plaques match the current camera pitch immediately
    this.updatePlaqueTilt(true);

    // Persist state snapshots for next animation diff
    this.prevBoardKeys = nextBoardKeys;
    this.prevHeroCardsSig = nextHeroCardsSig;
    this.prevStreetBets = nextStreetBets;
    this.prevPotBb = data.potBb;
    this.prevHadWinner = hasWinnerNow;
    this.prevFoldedSeats = nextFoldedSeats;
    this.prevActionSigs = nextActionSigs;
    this.prevDealerSeatIdx = nextDealerSeatIdx;
    this.prevDealerPos = nextDealerPos;
    this.prevHeroTurn = isHeroTurnNow;
    this.prevRevealedSeats = nextRevealedSeats;
    this.prevAllInSeats = nextAllInSeats;
    this.initializedHandOnce = true;
  }

  public requestRender() {
    if (this.disposed || this.contextLost) return;
    this.dirty = true;
    if (this.rafId === null && this.timeoutId === null) {
      this.lastTickMs = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private scheduleNextFrame() {
    if (this.disposed || this.contextLost || this.rafId !== null || this.timeoutId !== null) return;
    if (!this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }
    // Software WebGL (SwiftShader): yield cleanly so main thread stays responsive without fenceSync deadlocks
    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;
      if (!this.disposed && !this.contextLost && this.rafId === null) {
        this.rafId = requestAnimationFrame(this.tick);
      }
    }, 24);
  }

  private tick = () => {
    this.rafId = null;
    if (this.disposed || this.contextLost) return;

    const now = performance.now();
    const maxStep = this.isSoftwareGl ? 1.0 : 0.05;
    const dt = Math.min(maxStep, Math.max(0.004, (now - (this.lastTickMs || now)) / 1000));
    this.lastTickMs = now;
    this.elapsedSec += dt;

    // Strictly on-demand rendering: 0% GPU usage when idle!
    let keepGoing = false;

    // 1. Step active curved card-flip & staggered chip-bounce physics tweens
    if (this.activeTweens.length > 0) {
      const remaining: ActiveTween[] = [];
      for (const tw of this.activeTweens) {
        tw.elapsed += dt;
        const activeTime = tw.elapsed - tw.delay;
        if (activeTime <= 0) {
          remaining.push(tw);
          continue;
        }
        if (tw.initialHidden) {
          tw.obj.visible = true;
          tw.initialHidden = false;
        }
        if (!tw.startedFired) {
          tw.startedFired = true;
          tw.onStart?.();
        }

        const rawT = Math.min(1, activeTime / tw.duration);
        if (tw.flipCard && !tw.flippedFired && rawT >= 0.5) {
          tw.flippedFired = true;
          tw.onFlip?.();
        }
        if (!tw.landedFired && rawT >= 0.78) {
          tw.landedFired = true;
          tw.onLand?.();
        }

        if (rawT >= 1) {
          tw.obj.position.copy(tw.toPos);
          tw.obj.rotation.copy(tw.toRot);
          if (tw.disposeOnEnd) {
            this.disposeSingleFxObj(tw.obj);
          }
          this.pendingShadowUpdate = true;
          continue;
        }

        const posT = easeOutQuart(rawT);
        // Quadratic Bezier lateral curve + parabolic flight arc + crisp damped micro-bounce on arrival
        const arcSin = Math.sin(rawT * Math.PI);
        const curveWeight = 2 * (1 - posT) * posT;
        _tmpVec.lerpVectors(tw.fromPos, tw.toPos, posT);
        _tmpVec.addScaledVector(tw.curveOffset, curveWeight);

        let yLift = arcSin * tw.arcHeight;
        if (rawT > 0.78 && tw.bounceHeight > 0) {
          const bt = (rawT - 0.78) / 0.22;
          yLift += Math.sin(bt * Math.PI) * tw.bounceHeight * (1 - bt * 0.35);
        }
        tw.obj.position.set(_tmpVec.x, _tmpVec.y + yLift, _tmpVec.z);

        if (tw.flipCard) {
          // Stay face-down during initial glide, then execute a snappy mid-air 180° flip as the card arrives
          const flipT = rawT < 0.38 ? 0 : easeInOutCubic(Math.min(1, (rawT - 0.38) / 0.48));
          const rotZ = THREE.MathUtils.lerp(tw.fromRot.z, tw.toRot.z, flipT);
          const flipLift = Math.sin(flipT * Math.PI) * 0.14;
          tw.obj.position.y += flipLift;
          tw.obj.rotation.set(
            THREE.MathUtils.lerp(tw.fromRot.x, tw.toRot.x, posT),
            THREE.MathUtils.lerp(tw.fromRot.y, tw.toRot.y, posT),
            rotZ
          );
        } else {
          tw.obj.rotation.set(
            THREE.MathUtils.lerp(tw.fromRot.x, tw.toRot.x, posT),
            THREE.MathUtils.lerp(tw.fromRot.y, tw.toRot.y, posT),
            THREE.MathUtils.lerp(tw.fromRot.z, tw.toRot.z, posT)
          );
        }
        remaining.push(tw);
      }
      this.activeTweens = remaining;
      this.dirty = true;
      keepGoing = true;
    }

    // Coalesce shadow-map re-bake once all active tweens settle (instead of per-tween)
    if (this.pendingShadowUpdate && this.activeTweens.length === 0 && !this.isSoftwareGl) {
      this.renderer.shadowMap.needsUpdate = true;
      this.pendingShadowUpdate = false;
    }

    // 1b. Step expanding check felt ripples
    if (this.activeRipples.length > 0) {
      const remainingRipples: ActiveRipple[] = [];
      for (const rip of this.activeRipples) {
        rip.elapsed += dt;
        const t = Math.min(1, rip.elapsed / rip.duration);
        if (t >= 1) {
          this.disposeSingleFxObj(rip.mesh);
          continue;
        }
        rip.mat.uniforms.uProgress.value = easeOutQuart(t);
        remainingRipples.push(rip);
      }
      this.activeRipples = remainingRipples;
      this.dirty = true;
      keepGoing = true;
    }

    // 2. Two-finger spring-damped Hero hole-card hover peek (lifts hovered card & fans neighbor slightly aside)
    if (this.activeTweens.length === 0 && this.heroCardTargets.length > 0) {
      for (let i = 0; i < this.heroCardTargets.length; i++) {
        const target = this.heroCardTargets[i];
        const desiredPeek = this.hoveredHeroCardIdx === i ? 1 : 0;
        const desiredSide =
          this.hoveredHeroCardIdx === -1 || this.hoveredHeroCardIdx === i
            ? 0
            : i < this.hoveredHeroCardIdx
              ? -1
              : 1;

        const nextPeek = THREE.MathUtils.damp(target.peekAmount, desiredPeek, 14, dt);
        const nextSide = THREE.MathUtils.damp(target.sideOffset, desiredSide, 12, dt);

        if (
          Math.abs(nextPeek - target.peekAmount) > 0.001 ||
          Math.abs(nextSide - target.sideOffset) > 0.001
        ) {
          target.peekAmount = Math.abs(nextPeek - desiredPeek) < 0.004 ? desiredPeek : nextPeek;
          target.sideOffset = Math.abs(nextSide - desiredSide) < 0.004 ? desiredSide : nextSide;

          target.group.position.set(
            target.basePos.x + target.sideOffset * 0.045,
            target.basePos.y + target.peekAmount * 0.125,
            target.basePos.z + target.peekAmount * 0.065
          );
          target.group.rotation.set(
            target.baseRot.x + target.peekAmount * 0.26,
            target.baseRot.y - target.sideOffset * 0.04,
            target.baseRot.z
          );
          this.dirty = true;
          keepGoing = true;
        }
      }
    }

    // 3. Frame-rate independent exponential-damped camera preset glide
    if (this.camAnimActive) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camTargetPos.x, 7.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camTargetPos.y, 7.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camTargetPos.z, 7.5, dt);
      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.camTargetLook.x, 7.5, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camTargetLook.y, 7.5, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.camTargetLook.z, 7.5, dt);
      this.controls.update();
      if (
        this.camera.position.distanceToSquared(this.camTargetPos) < 0.0006 &&
        this.controls.target.distanceToSquared(this.camTargetLook) < 0.0006
      ) {
        this.camera.position.copy(this.camTargetPos);
        this.controls.target.copy(this.camTargetLook);
        this.controls.update();
        this.camAnimActive = false;
      } else {
        this.dirty = true;
        keepGoing = true;
      }
    } else if (this.controls.enableDamping) {
      const moved = this.controls.update();
      if (moved) {
        this.dirty = true;
        keepGoing = true;
      }
    }

    // Subtle dust-mote & halo shimmer only while active frames are already being rendered (zero idle cost!)
    if (this.dirty || keepGoing) {
      if (this.activeHaloMats.length > 0) {
        for (let i = 0; i < this.activeHaloMats.length; i++) {
          this.activeHaloMats[i].uniforms.uTime.value = this.elapsedSec;
        }
      }
      if (!this.isSoftwareGl && this.dustMotes) {
        this.dustMotes.rotation.y = this.elapsedSec * 0.028;
      }
      this.updateChandelierOpacity();
      this.updatePlaqueTilt();
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }

    if (keepGoing) {
      this.scheduleNextFrame();
    }
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduledFrame();
    this.activeTweens = [];
    this.activeRipples = [];
    this.activeHaloMats = [];
    this.seatPlaquePlates = [];
    this.chandelierFadeEntries = [];
    this.heroCardTargets = [];
    this.boardCardMap.clear();
    this.seatCardMap.clear();
    this.pendingBetChips.clear();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.soundEngine.dispose();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    disposeObject3D(this.scene);
    this.keyLight.dispose();
    this.casinoSpotLight.dispose();
    this.hemiLight.dispose();
    this.rimLight.dispose();
    this.contactShadowTex.dispose();
    this.cardBackTex.dispose();
    this.floorTex.dispose();
    this.chipSideTex.dispose();
    this.chipTopTex.dispose();
    this.dealerPuckTex.dispose();
    for (const tex of this.cardFaceTexCache.values()) {
      tex.dispose();
    }
    this.cardFaceTexCache.clear();
    this.cardFaceTexSet.clear();
    disposeFeltBadgeTextures();
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }
}
