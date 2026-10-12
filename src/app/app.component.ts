import { Component, computed, signal } from '@angular/core';
import { Color, Move, State, best, file, initial, legal, play, rank, san, status } from './engine';

const G: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const START: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
const VAL: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };

@Component({ selector: 'app-root', templateUrl: './app.component.html', styleUrl: './app.component.scss' })
export class AppComponent {
  states = signal<State[]>([initial()]);
  sans = signal<string[]>([]);
  lastMv = signal<Move[]>([]);
  sel = signal(-1);
  flipped = signal(false);
  mode = signal<'ai' | 'local'>('ai');
  level = signal(2);
  busy = signal(false);
  promo = signal<Move[] | null>(null);
  hint = signal<Move | null>(null);

  s = computed(() => this.states().at(-1)!);
  legal = computed(() => legal(this.s()));
  st = computed(() => status(this.s(), this.legal().length));
  over = computed(() => this.st() === 'checkmate' || this.st() === 'stalemate');
  targets = computed(() => this.legal().filter(m => m.from === this.sel()));
  last = computed(() => this.lastMv().at(-1) ?? null);
  checkSq = computed(() => (this.st() === 'check' || this.st() === 'checkmate') ? this.s().b.indexOf(this.s().turn + 'K') : -1);
  order = computed(() => { const a = Array.from({ length: 64 }, (_, i) => i); return this.flipped() ? a.reverse() : a; });
  rows = computed(() => { const a = this.sans(); return Array.from({ length: Math.ceil(a.length / 2) }, (_, k) => ({ n: k + 1, w: a[2 * k], b: a[2 * k + 1] ?? '' })); });
  caps = computed(() => {
    const cnt: Record<string, number> = {};
    for (const p of this.s().b) if (p) cnt[p] = (cnt[p] || 0) + 1;
    const lost = (c: Color) => Object.keys(START).flatMap(t => Array(Math.max(0, START[t] - (cnt[c + t] || 0))).fill(c + t) as string[]);
    return { w: lost('w'), b: lost('b') };
  });
  adv = computed(() => { const sum = (a: string[]) => a.reduce((n, p) => n + VAL[p[1]], 0); return sum(this.caps().b) - sum(this.caps().w); });
  whitePct = computed(() => 50 + Math.max(-45, Math.min(45, this.adv() * 4)));
  statusText = computed(() => {
    const who = this.s().turn === 'w' ? 'White' : 'Black';
    if (this.st() === 'checkmate') return `Checkmate. ${who === 'White' ? 'Black' : 'White'} wins.`;
    if (this.st() === 'stalemate') return 'Stalemate. The game is drawn.';
    if (this.busy()) return 'Engine is thinking…';
    return this.st() === 'check' ? `${who} is in check` : `${who} to move`;
  });

  glyph = (p: string) => G[p[1]] + '\uFE0E';
  light = (i: number) => (((i >> 3) + (i & 7)) % 2) === 0;
  file = file; rank = rank;
  isLast = (i: number) => this.last()?.from === i || this.last()?.to === i;
  isTarget = (i: number) => this.targets().some(m => m.to === i);
  isHint = (i: number) => this.hint()?.from === i || this.hint()?.to === i;
  promoGlyph = (m: Move) => this.glyph(this.s().turn + m.promo!);

  pick(i: number) { const p = this.s().b[i]; if (!this.busy() && p && p[0] === this.s().turn && !(this.mode() === 'ai' && p[0] === 'b')) this.sel.set(i); }
  drop(i: number) { if (i !== this.sel()) this.click(i); }

  click(i: number) {
    if (this.busy() || this.over()) return;
    const s = this.s();
    if (this.mode() === 'ai' && s.turn === 'b') return;
    const p = s.b[i];
    if (p && p[0] === s.turn) { this.sel.set(i === this.sel() ? -1 : i); this.hint.set(null); return; }
    const ms = this.targets().filter(m => m.to === i);
    if (!ms.length) { this.sel.set(-1); return; }
    ms.length > 1 ? this.promo.set(ms) : this.make(ms[0]);
  }

  make(m: Move) {
    const s = this.s();
    this.sans.update(a => [...a, san(s, m)]);
    this.lastMv.update(a => [...a, m]);
    this.states.update(a => [...a, play(s, m)]);
    this.sel.set(-1); this.promo.set(null); this.hint.set(null);
    if (this.mode() === 'ai' && this.s().turn === 'b' && !this.over()) {
      this.busy.set(true);
      setTimeout(() => { const mv = best(this.s(), this.level()); this.busy.set(false); if (mv) this.make(mv); }, 60);
    }
  }

  undo() {
    if (this.busy()) return;
    const n = this.mode() === 'ai' && this.s().turn === 'w' ? 2 : 1;
    if (this.sans().length < n) return;
    this.states.update(a => a.slice(0, -n)); this.sans.update(a => a.slice(0, -n)); this.lastMv.update(a => a.slice(0, -n));
    this.sel.set(-1); this.hint.set(null);
  }
  getHint() {
    if (this.busy() || this.over()) return;
    this.busy.set(true);
    setTimeout(() => { this.hint.set(best(this.s(), 3)); this.busy.set(false); }, 40);
  }
  newGame() { this.states.set([initial()]); this.sans.set([]); this.lastMv.set([]); this.sel.set(-1); this.hint.set(null); this.promo.set(null); this.busy.set(false); }
  setMode(m: 'ai' | 'local') { this.mode.set(m); this.newGame(); }
}
