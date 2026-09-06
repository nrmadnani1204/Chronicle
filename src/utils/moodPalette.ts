import type { MoodState } from '../types';
import type { ChronicleMoodPersonality } from '../components/RoomNavigation';

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  return [lerp(a[0], b[0], clamped), lerp(a[1], b[1], clamped), lerp(a[2], b[2], clamped)];
}

function toRgbString([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Base anchors, kept close to the app's existing dark obsidian theme (#08080E).
const CORE_NEUTRAL: RGB = [8, 8, 14];
const CORE_NEGATIVE: RGB = [10, 10, 18];
const CORE_POSITIVE: RGB = [28, 15, 22];
const DEEP_NEUTRAL: RGB = [4, 4, 8];
const DEEP_NEGATIVE: RGB = [6, 4, 6];
const DEEP_POSITIVE: RGB = [18, 8, 14];
const ACCENT_NEUTRAL: RGB = [70, 70, 110];
const ACCENT_NEGATIVE: RGB = [90, 40, 60];
const ACCENT_POSITIVE: RGB = [255, 130, 170];
const TENSION_RED: RGB = [90, 15, 15];

export interface MoodGradient {
  core: string;
  coreDeep: string;
  accent: string;
  durationSeconds: number;
}

// Recency-weighted blend of recent sessions' mood — reflects emotional
// trajectory rather than only the latest session, so a heavy day eases off
// gradually as lighter ones follow instead of snapping instantly.
export function getBlendedMood(trajectory: MoodState[]): MoodState | null {
  const recent = trajectory.filter(Boolean).slice(0, 5);
  if (recent.length === 0) return null;

  const weights = recent.map((_, i) => Math.pow(0.7, i));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const valence = recent.reduce((sum, m, i) => sum + m.valence * weights[i], 0) / totalWeight;
  const energy = recent.reduce((sum, m, i) => sum + m.energy * weights[i], 0) / totalWeight;
  const tension = recent.reduce((sum, m, i) => sum + m.tension * weights[i], 0) / totalWeight;

  return { valence, energy, tension, weather: recent[0].weather };
}

export function getMoodGradient(mood: MoodState | null, trajectory: MoodState[] = []): MoodGradient {
  const blended = mood || getBlendedMood(trajectory) || { valence: 0, energy: 0.4, tension: 0.3, weather: '' };
  const { valence, energy, tension } = blended;

  let core: RGB;
  let deep: RGB;
  let accent: RGB;

  if (valence < 0) {
    const t = Math.min(1, -valence);
    core = lerpColor(CORE_NEUTRAL, CORE_NEGATIVE, t);
    deep = lerpColor(DEEP_NEUTRAL, DEEP_NEGATIVE, t);
    accent = lerpColor(ACCENT_NEUTRAL, ACCENT_NEGATIVE, t);
  } else {
    const t = Math.min(1, valence);
    core = lerpColor(CORE_NEUTRAL, CORE_POSITIVE, t);
    deep = lerpColor(DEEP_NEUTRAL, DEEP_POSITIVE, t);
    accent = lerpColor(ACCENT_NEUTRAL, ACCENT_POSITIVE, t);
  }

  // Tension bleeds red into the palette, most visible when the mood is also
  // negative (the "angry = black with red undertones" case) — tense-but-
  // positive moods are only lightly warmed by it.
  const tensionPull = Math.max(0, tension - 0.3) * (valence < 0 ? 1 : 0.4);
  core = lerpColor(core, TENSION_RED, tensionPull * 0.5);
  deep = lerpColor(deep, TENSION_RED, tensionPull * 0.35);
  accent = lerpColor(accent, TENSION_RED, tensionPull * 0.6);

  // Higher energy = faster-moving atmosphere; lower energy = slower, heavier.
  const durationSeconds = Math.round(lerp(34, 14, Math.max(0, Math.min(1, energy))));

  return {
    core: toRgbString(core),
    coreDeep: toRgbString(deep),
    accent: toRgbString(accent),
    durationSeconds,
  };
}

// Pure mapping from numeric mood to the existing 5-label personality system —
// the single point that lets VentButton/RoomNavigation/getGreeting keep their
// existing per-label styling completely unchanged.
export function deriveMoodPersonality(mood: MoodState | null): ChronicleMoodPersonality {
  if (!mood) return 'midnight';
  const { valence, energy, tension } = mood;

  if (valence < -0.4 && tension > 0.5) return 'angry';
  if (valence < -0.2 && energy < 0.4) return 'heavy';
  if (valence > 0.3) return 'happy';
  if (tension > 0.7) return 'overwhelmed';
  return 'midnight';
}
