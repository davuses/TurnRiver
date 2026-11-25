import { sharedCasinoSoundEngine } from '../three/soundEngine';

export function closePokerSound(): void {
  sharedCasinoSoundEngine.dispose();
}

export function playPokerSound(
  kind: 'card' | 'chip' | 'optimal' | 'mistake',
  enabled: boolean
): void {
  if (!enabled) return;
  sharedCasinoSoundEngine.enabled = true;

  if (kind === 'card') {
    sharedCasinoSoundEngine.playCardSlide(0, 0, 0.95);
  } else if (kind === 'chip') {
    sharedCasinoSoundEngine.playChipClink(2, 0, 0);
  } else if (kind === 'optimal') {
    sharedCasinoSoundEngine.playShowdownCue('win', 0);
  } else {
    sharedCasinoSoundEngine.playShowdownCue('loss', 0);
  }
}
