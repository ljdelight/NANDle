// Daily statistics: recording results and the stats dialog.
import * as L from '../logic';
import { $ } from './dom';
import { MAX_RUNS, isDaily, state } from './state';
import { KEYS, isRecord, store } from './storage';

interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastNumber: number | null;
  lastWonNumber: number | null;
  dist: number[];
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isPuzzleRef = (v: unknown): v is number | null => v === null || typeof v === 'number';

/** Stored stats are rendered as HTML, so every field is checked, not just its presence. */
function isStats(v: unknown): v is Stats {
  return (
    isRecord(v) &&
    isCount(v.played) &&
    isCount(v.won) &&
    isCount(v.streak) &&
    isCount(v.maxStreak) &&
    isPuzzleRef(v.lastNumber ?? null) &&
    isPuzzleRef(v.lastWonNumber ?? null) &&
    Array.isArray(v.dist) &&
    v.dist.length === MAX_RUNS &&
    v.dist.every(isCount)
  );
}

function defaultStats(): Stats {
  return { played: 0, won: 0, streak: 0, maxStreak: 0, lastNumber: null, lastWonNumber: null, dist: [0, 0, 0, 0, 0, 0] };
}

export function recordStats(): void {
  const puzzle = state.puzzle;
  if (!isDaily(puzzle)) return;
  const s = store.get<Stats>(KEYS.stats, defaultStats(), isStats);
  if (s.lastNumber === puzzle.number) return;
  s.played++;
  if (state.status === 'won') {
    s.won++;
    s.streak = s.lastWonNumber === puzzle.number - 1 ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastWonNumber = puzzle.number;
    const slot = state.guesses.length - 1;
    s.dist[slot] = (s.dist[slot] ?? 0) + 1;
  } else {
    s.streak = 0;
  }
  s.lastNumber = puzzle.number;
  store.set(KEYS.stats, s);
}

export function openStats(): void {
  const s = store.get<Stats>(KEYS.stats, defaultStats(), isStats);
  // A streak only counts if yesterday's (or today's) puzzle was won.
  const today = L.puzzleNumber(new Date());
  const streak = s.lastWonNumber !== null && s.lastWonNumber >= today - 1 ? s.streak : 0;
  const pct = s.played ? Math.round((100 * s.won) / s.played) : 0;
  const tiles: readonly [number, string][] = [
    [s.played, 'Played'],
    [pct, 'Win %'],
    [streak, 'Streak'],
    [s.maxStreak, 'Best'],
  ];
  $('#stats').innerHTML = tiles.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  const max = Math.max(1, ...s.dist);
  const highlight = state.mode === 'daily' && state.status === 'won' ? state.guesses.length - 1 : -1;
  $('#dist').innerHTML = s.dist
    .map(
      (n, i) =>
        `<div class="dist-row"><span>${i + 1}</span><div class="bar${i === highlight ? ' now' : ''}" style="width:${Math.max(8, (100 * n) / max)}%">${n}</div></div>`
    )
    .join('');
  updateCountdown();
  $<HTMLDialogElement>('#dlg-stats').showModal();
}

function updateCountdown(): void {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const secs = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const pad = (n: number): string => String(n).padStart(2, '0');
  $('#next').textContent = `Next daily puzzle in ${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}

export function bindStats(): void {
  $('#btn-stats').addEventListener('click', openStats);
  setInterval(() => {
    if ($<HTMLDialogElement>('#dlg-stats').open) updateCountdown();
  }, 1000);
}
