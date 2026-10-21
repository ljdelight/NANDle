// localStorage access that tolerates blocked or corrupt storage.

export const KEYS = {
  stats: 'nandle:stats',
  tutorialDone: 'nandle:tutorial-done',
  helper: 'nandle:helper',
  settings: 'nandle:settings',
  daily: (dateKey: string): string => 'nandle:daily:' + dateKey,
} as const;

export const store = {
  get<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed: unknown = JSON.parse(raw);
      return valid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: progress just won't persist */
    }
  },
};

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export const isTrue = (v: unknown): v is boolean => v === true;
