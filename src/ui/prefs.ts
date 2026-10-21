// Saved player preferences: display settings and the K-map helper's view.
import type { Form } from '../kmap';
import { $ } from './dom';
import { KEYS, isRecord, store } from './storage';

export interface Settings {
  highContrast: boolean;
}

export type HelperForm = Form | 'none';

export interface HelperPrefs {
  open: boolean;
  form: HelperForm;
  markGuess: boolean;
}

function isSettings(v: unknown): v is Settings {
  return isRecord(v) && typeof v.highContrast === 'boolean';
}

export const isHelperForm = (v: unknown): v is HelperForm => v === 'none' || v === 'sop' || v === 'pos';

function isHelperPrefs(v: unknown): v is HelperPrefs {
  return isRecord(v) && typeof v.open === 'boolean' && isHelperForm(v.form) && typeof v.markGuess === 'boolean';
}

// Until the player chooses, follow the operating system's contrast preference.
export const settings: Settings = store.get<Settings>(
  KEYS.settings,
  { highContrast: window.matchMedia('(prefers-contrast: more)').matches },
  isSettings
);

export const helper: HelperPrefs = store.get<HelperPrefs>(
  KEYS.helper,
  { open: false, form: 'none', markGuess: true },
  isHelperPrefs
);

export function applySettings(): void {
  if (settings.highContrast) document.documentElement.dataset.contrast = 'high';
  else delete document.documentElement.dataset.contrast;
  $<HTMLInputElement>('#set-contrast').checked = settings.highContrast;
}

export function saveSettings(): void {
  store.set(KEYS.settings, settings);
  applySettings();
}

export function saveHelperPrefs(): void {
  store.set(KEYS.helper, helper);
}
