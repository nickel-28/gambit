import { Component, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { Color, Move, State, file, fromFen, inCheck, initial, insufficient, key, legal, play, rank, san, status, toFen } from './engine';
import { openingName } from './openings';
import { SoundService } from './sound.service';

const G: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const START: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
const VAL: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const BOARDS = [
  { id: 'jade', name: 'Jade', l: '#d9e6dd', d: '#5d8a79' },
  { id: 'walnut', name: 'Walnut', l: '#f0d9b5', d: '#b58863' },
  { id: 'slate', name: 'Slate', l: '#c9d1d9', d: '#5a6b7d' },
  { id: 'rose', name: 'Rose', l: '#f6dfe3', d: '#c27c92' },
  { id: 'ocean', name: 'Ocean', l: '#dcebf2', d: '#3f7ea6' },
];
const SETS = [{ id: 'glyph', name: 'Glyph' }, { id: 'cburnett', name: 'Cburnett' }];
const PRESETS = [
  { id: 'off', name: 'No clock', m: 0, i: 0 }, { id: '1+0', name: 'Bullet 1+0', m: 1, i: 0 },
  { id: '3+2', name: 'Blitz 3+2', m: 3, i: 2 }, { id: '5+0', name: 'Blitz 5+0', m: 5, i: 0 },
  { id: '10+0', name: 'Rapid 10+0', m: 10, i: 0 }, { id: '15+10', name: 'Rapid 15+10', m: 15, i: 10 },
];
const LEVELS: Record<number, [number, number]> = { 1: [1, 200], 2: [3, 1000], 3: [5, 2500] }; // [depth, ms]
type Cell = { t: string; i: number } | null;

const load = (): Record<string, any> => { try { return JSON.parse(localStorage.getItem('gambit') || '{}'); } catch { return {}; } };

@Component({ selector: 'app-root', templateUrl: './app.component.html', styleUrl: './app.component.scss' })
export class AppComponent {
  private inj = inject(Injector);
  private sfx = inject(SoundService);
  private worker = new Worker(new URL('./engine.worker', import.meta.url), { type: 'module' });
  private gen = 0; private noAnim = false; private rfrom = -1; private zw = false;
  private t0 = Date.now(); private recorded = false;
  private saved = load();
  boards = BOARDS; sets = SETS; presets = PRESETS;

  states = signal<State[]>([initial()]);
  sans = signal<string[]>([]);
  lastMv = signal<Move[]>([]);
  view = signal<number | null>(null);
  result = signal<{ text: string; r: string } | null>(null);
  clockId = signal('off');
  tw = signal(0);
  tb = signal(0);
  custom = signal(false);
  io = signal('');
  msg = signal('');
  stats = signal<{ w: number; l: number; d: number }>(this.saved['stats'] ?? { w: 0, l: 0, d: 0 });
  sel = signal(-1);
  flipped = signal(false);
  mode = signal<'ai' | 'local'>('ai');
  level = signal(2);
  busy = signal(false);
  promo = signal<Move[] | null>(null);
  hint = signal<Move | null>(null);
  premove = signal<Move | null>(null);
  arrows = signal<{ from: number; to: number }[]>([]);
  marks = signal<number[]>([]);
  ghost = signal<{ i: number; p: string } | null>(null);
  cursor = signal(52);
  focus = signal(false);
  live = signal('');
  sheet = signal(false);
  board = signal<string>(this.saved['board'] ?? 'jade');
  set = signal<string>(this.saved['set'] ?? 'glyph');
  theme = signal<'dark' | 'light'>(this.saved['theme'] ?? 'dark');
  sound = signal<boolean>(this.saved['sound'] ?? true);

  s = computed(() => this.states().at(-1)!);
  shown = computed(() => (this.view() === null ? this.s() : this.states()[this.view()!]));
  curPly = computed(() => this.view() ?? this.states().length - 1);
  legal = computed(() => legal(this.s()));
  st = computed(() => status(this.s(), this.legal().length));
  draw = computed(() => {
    const s = this.s();
    if (this.st() === 'checkmate' || this.st() === 'stalemate') return '';
    if (insufficient(s)) return 'insufficient material';
    if (s.h >= 100) return 'the fifty-move rule';
    const k = key(s);
    return this.states().filter(x => key(x) === k).length >= 3 ? 'threefold repetition' : '';
  });
  over = computed(() => this.st() === 'checkmate' || this.st() === 'stalemate' || !!this.draw() || !!this.result());
  outcome = computed(() => {
    const r = this.result();
    if (r) return r.r;
    if (this.st() === 'checkmate') return this.s().turn === 'w' ? '0-1' : '1-0';
    return this.st() === 'stalemate' || this.draw() ? '1/2-1/2' : '*';
  });
  clock = computed(() => PRESETS.find(p => p.id === this.clockId()) ?? PRESETS[0]);
  clockOn = computed(() => this.clock().m > 0);
  topSide = computed<Color>(() => (this.flipped() ? 'w' : 'b'));
  botSide = computed<Color>(() => (this.flipped() ? 'b' : 'w'));
  mine = computed(() => { const s = this.s(); return this.mode() === 'ai' && s.turn === 'b' ? legal({ ...s, turn: 'w', ep: -1 }) : this.legal(); });
  targets = computed(() => this.mine().filter(m => m.from === this.sel()));
  last = computed(() => (this.view() === null ? this.lastMv().at(-1) : this.lastMv()[this.view()! - 1]) ?? null);
  checkSq = computed(() => { const sh = this.shown(); return inCheck(sh) ? sh.b.indexOf(sh.turn + 'K') : -1; });
  order = computed(() => { const a = Array.from({ length: 64 }, (_, i) => i); return this.flipped() ? a.reverse() : a; });
  bt = computed(() => BOARDS.find(b => b.id === this.board()) ?? BOARDS[0]);
  fen = computed(() => toFen(this.shown()));
  opening = computed(() => (this.custom() ? '' : openingName(this.sans())));
  rows = computed(() => {
    const off = this.states()[0].turn === 'b' ? 1 : 0; // black moves first when set up from a FEN
    const cells: Cell[] = [...Array<Cell>(off).fill(null), ...this.sans().map((t, k) => ({ t, i: k + 1 }))];
    return Array.from({ length: Math.ceil(cells.length / 2) }, (_, k) => ({ n: k + 1, w: cells[2 * k] ?? null, b: cells[2 * k + 1] ?? null }));
  });
  caps = computed(() => {
    const cnt: Record<string, number> = {};
    for (const p of this.shown().b) if (p) cnt[p] = (cnt[p] || 0) + 1;
    const lost = (c: Color) => Object.keys(START).flatMap(t => Array(Math.max(0, START[t] - (cnt[c + t] || 0))).fill(c + t) as string[]);
    return { w: lost('w'), b: lost('b') };
  });
  adv = computed(() => { const sum = (a: string[]) => a.reduce((n, p) => n + VAL[p[1]], 0); return sum(this.caps().b) - sum(this.caps().w); });
  whitePct = computed(() => 50 + Math.max(-45, Math.min(45, this.adv() * 4)));
  statusText = computed(() => {
    const who = this.s().turn === 'w' ? 'White' : 'Black', r = this.result();
    if (r) return r.text;
    if (this.st() === 'checkmate') return `Checkmate. ${who === 'White' ? 'Black' : 'White'} wins.`;
    if (this.st() === 'stalemate') return 'Stalemate. The game is drawn.';
    if (this.draw()) return `Draw by ${this.draw()}.`;
    if (this.busy()) return 'Engine is thinking…';
    return this.st() === 'check' ? `${who} is in check` : `${who} to move`;
  });

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      this.sfx.muted = !this.sound();
      localStorage.setItem('gambit', JSON.stringify({ board: this.board(), set: this.set(), theme: this.theme(), sound: this.sound(), stats: this.stats() }));
    });
    // Autosave the current game
    effect(() => {
      const data = {
        start: toFen(this.states()[0]), moves: this.lastMv(), mode: this.mode(), level: this.level(), clock: this.clockId(),
        result: this.result(), custom: this.custom(), t: untracked(() => [this.tw(), this.tb()]),
      };
      localStorage.setItem('gambit-game', JSON.stringify(data));
    });
    // Record the result once per finished game
    effect(() => {
      if (!this.over()) return;
      untracked(() => {
        if (this.recorded) return;
        this.recorded = true;
        if (this.mode() !== 'ai') return;
        const o = this.outcome(), k = o === '1-0' ? 'w' : o === '0-1' ? 'l' : 'd';
        this.stats.update(s => ({ ...s, [k]: s[k] + 1 }));
      });
    });
    // Resume the saved game
    try {
      const g = JSON.parse(localStorage.getItem('gambit-game') || 'null'), start = g && fromFen(g.start);
      if (start) {
        this.mode.set(g.mode); this.level.set(g.level); this.clockId.set(g.clock);
        this.custom.set(!!g.custom); this.result.set(g.result);
        this.restore(start, g.moves);
        this.tw.set(g.t[0]); this.tb.set(g.t[1]);
      }
    } catch { /* ignore corrupt save */ }
    this.recorded = this.over();
    if (this.mode() === 'ai' && this.s().turn === 'b' && !this.over()) this.engineMove();
    setInterval(() => this.tick(), 100);
  }

  // ---------- display helpers ----------
  glyph = (p: string) => G[p[1]] + '\uFE0E';
  img = (p: string) => `assets/pieces/${this.set()}/${p}.svg`;
  light = (i: number) => (((i >> 3) + (i & 7)) % 2) === 0;
  file = file; rank = rank;
  pos = (i: number) => (this.flipped() ? 63 - i : i);
  cx = (i: number) => (this.pos(i) & 7) + 0.5;
  cy = (i: number) => (this.pos(i) >> 3) + 0.5;
  isLast = (i: number) => this.last()?.from === i || this.last()?.to === i;
  isPre = (i: number) => this.premove()?.from === i || this.premove()?.to === i;
  isTarget = (i: number) => this.targets().some(m => m.to === i);
  isHint = (i: number) => this.hint()?.from === i || this.hint()?.to === i;
  promoGlyph = (m: Move) => this.glyph(this.s().turn + m.promo!);
  time = (c: Color) => (c === 'w' ? this.tw() : this.tb());
  runs = (c: Color) => this.clockOn() && !this.over() && this.sans().length > 0 && this.s().turn === c;
  low = (c: Color) => this.time(c) < 20000;
  fmt = (ms: number) => {
    if (ms < 10000) return (ms / 1000).toFixed(1);
    const t = Math.ceil(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  arrow(a: { from: number; to: number }) {
    const x1 = this.cx(a.from), y1 = this.cy(a.from), x2 = this.cx(a.to), y2 = this.cy(a.to);
    const L = Math.hypot(x2 - x1, y2 - y1), k = (L - 0.28) / L;
    return { x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k };
  }

  // ---------- input ----------
  private isPre0() { return this.mode() === 'ai' && this.s().turn === 'b'; }

  pick(i: number) {
    if (this.view() !== null) return;
    const pre = this.isPre0(), p = this.s().b[i];
    if ((!this.busy() || pre) && p && p[0] === (pre ? 'w' : this.s().turn)) this.sel.set(i);
  }
  drop(i: number) { if (i !== this.sel()) { this.noAnim = true; this.click(i); this.noAnim = false; } }

  click(i: number) {
    if (this.arrows().length || this.marks().length) { this.arrows.set([]); this.marks.set([]); }
    if (this.over() || this.view() !== null) return;
    const s = this.s(), pre = this.isPre0();
    if (this.busy() && !pre) return;
    const p = s.b[i];
    if (p && p[0] === (pre ? 'w' : s.turn)) { this.sel.set(i === this.sel() ? -1 : i); this.hint.set(null); return; }
    const ms = this.targets().filter(m => m.to === i);
    if (!ms.length) { this.sel.set(-1); if (pre) this.premove.set(null); return; }
    if (pre) { this.premove.set(ms.find(m => m.promo === 'Q') ?? ms[0]); this.sel.set(-1); this.sfx.play('move'); return; }
    ms.length > 1 ? this.promo.set(ms) : this.make(ms[0]);
  }

  rdown(e: PointerEvent, i: number) { if (e.button === 2) this.rfrom = i; }
  rup(e: PointerEvent, i: number) {
    if (e.button !== 2 || this.rfrom < 0) return;
    const f = this.rfrom; this.rfrom = -1;
    if (f === i) this.marks.update(m => (m.includes(i) ? m.filter(x => x !== i) : [...m, i]));
    else this.arrows.update(a => (a.some(x => x.from === f && x.to === i) ? a.filter(x => !(x.from === f && x.to === i)) : [...a, { from: f, to: i }]));
  }

  key(e: KeyboardEvent) {
    const nav: Record<string, () => void> = { Home: () => this.goto(0), End: () => this.end(), PageUp: () => this.step(-1), PageDown: () => this.step(1) };
    if (nav[e.key]) { e.preventDefault(); nav[e.key](); return; }
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const k = d[e.key];
    if (k) {
      e.preventDefault();
      const p = this.pos(this.cursor());
      const r = Math.max(0, Math.min(7, (p >> 3) + k[0])), c = Math.max(0, Math.min(7, (p & 7) + k[1]));
      this.cursor.set(this.pos(r * 8 + c));
      this.say(this.describe(this.cursor()));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const c = this.cursor(), n = this.sans().length;
      this.click(c);
      if (this.sans().length === n) this.say(this.describe(c));
    } else if (e.key === 'Escape') { this.sel.set(-1); this.premove.set(null); this.say('Selection cleared'); }
  }
  describe(i: number) {
    const p = this.shown().b[i];
    return `${file(i)}${rank(i)}, ${p ? (p[0] === 'w' ? 'white ' : 'black ') + NAMES[p[1]] : 'empty'}${this.sel() === i ? ', selected' : ''}${this.isTarget(i) ? ', legal move' : ''}${this.isPre(i) ? ', premove' : ''}`;
  }
  say(t: string) { this.zw = !this.zw; this.live.set(t + (this.zw ? '\u200b' : '')); }
  private toast(t: string) { this.msg.set(t); setTimeout(() => this.msg.set(''), 2200); }

  // ---------- game flow ----------
  make(m: Move) {
    const s = this.s(), first = this.sans().length === 0;
    const v = m.cap ? m.to + (m.ep ? (s.turn === 'w' ? 8 : -8) : 0) : -1;
    if (v >= 0) { this.ghost.set({ i: v, p: s.b[v] }); setTimeout(() => this.ghost.set(null), 320); }
    if (this.clockOn() && !first) { const inc = this.clock().i * 1000; (s.turn === 'w' ? this.tw : this.tb).update(t => t + inc); }
    this.sans.update(a => [...a, san(s, m)]);
    this.lastMv.update(a => [...a, m]);
    this.states.update(a => [...a, play(s, m)]);
    this.sel.set(-1); this.promo.set(null); this.hint.set(null); this.arrows.set([]); this.marks.set([]);
    this.feedback(m);
    if (!this.noAnim && this.view() === null) {
      this.slide(m.from, m.to);
      if (m.castle) m.to > m.from ? this.slide(m.to + 1, m.to - 1) : this.slide(m.to - 2, m.to + 1);
    }
    this.noAnim = false;
    afterNextRender(() => { const el = document.querySelector('.moves'); el?.scrollTo({ top: el.scrollHeight }); }, { injector: this.inj });
    this.say(`${this.sans().at(-1)}. ${this.statusText()}`);
    if (this.mode() === 'ai' && this.s().turn === 'b' && !this.over()) this.engineMove();
  }

  private async engineMove() {
    const g = this.gen, [d, t] = LEVELS[this.level()];
    this.busy.set(true);
    const m = await this.think(this.s(), d, t);
    if (g !== this.gen) return; // game was reset while thinking
    this.busy.set(false);
    if (m && !this.over()) this.make(m);
    this.runPremove();
  }
  private runPremove() {
    const p = this.premove(); if (!p) return;
    this.premove.set(null);
    if (this.over()) return;
    const m = this.legal().find(x => x.from === p.from && x.to === p.to && x.promo === p.promo);
    m ? this.make(m) : this.sfx.play('illegal');
  }
  private think(s: State, d: number, t: number) {
    const id = this.gen;
    return new Promise<Move | null>(res => {
      this.worker.onmessage = e => { if (e.data.id === id) res(e.data.m); };
      this.worker.postMessage({ id, s, d, t });
    });
  }

  // ---------- clock ----------
  private tick() {
    const now = Date.now(), dt = now - this.t0; this.t0 = now;
    if (!this.clockOn() || this.over() || this.sans().length < 1) return;
    const w = this.s().turn === 'w', sig = w ? this.tw : this.tb;
    sig.update(t => Math.max(0, t - dt));
    if (sig() === 0) { this.result.set({ text: `${w ? 'Black' : 'White'} wins on time.`, r: w ? '0-1' : '1-0' }); this.sfx.play('end'); }
  }
  setClock(id: string) { this.clockId.set(id); this.newGame(); }

  // ---------- history review ----------
  goto(i: number) {
    const n = this.states().length - 1;
    this.view.set(i >= n ? null : Math.max(0, i));
    this.sel.set(-1); this.premove.set(null);
  }
  step(d: number) { this.goto(this.curPly() + d); }
  end() { this.view.set(null); }
  branch() {
    const v = this.view(); if (v === null || this.busy()) return;
    this.gen++;
    this.states.update(a => a.slice(0, v + 1)); this.sans.update(a => a.slice(0, v)); this.lastMv.update(a => a.slice(0, v));
    this.view.set(null); this.result.set(null); this.recorded = this.over();
    if (this.mode() === 'ai' && this.s().turn === 'b' && !this.over()) this.engineMove();
  }

  // ---------- resign / draw ----------
  resign() {
    if (this.over()) return;
    const w = this.mode() === 'ai' || this.s().turn === 'w';
    this.result.set({ text: `${w ? 'White' : 'Black'} resigns.`, r: w ? '0-1' : '1-0' });
    this.sfx.play('end');
  }
  offerDraw() {
    if (this.over()) return;
    const agree = () => { this.result.set({ text: 'Draw agreed.', r: '1/2-1/2' }); this.sfx.play('end'); };
    if (this.mode() === 'ai') this.adv() >= 0 ? agree() : this.toast('The engine declines the draw.');
    else if (confirm(`${this.s().turn === 'w' ? 'Black' : 'White'}, do you accept the draw?`)) agree();
  }

  // ---------- FEN / PGN ----------
  pgn() {
    const body = this.rows().map(r => (r.w ? `${r.n}. ${r.w.t}${r.b ? ' ' + r.b.t : ''}` : `${r.n}... ${r.b!.t}`)).join(' ');
    const o = this.outcome(), d = new Date().toISOString().slice(0, 10).replace(/-/g, '.'), ai = this.mode() === 'ai';
    const setup = this.custom() ? `[SetUp "1"]\n[FEN "${toFen(this.states()[0])}"]\n` : '';
    return `[Event "Gambit game"]\n[Date "${d}"]\n[White "${ai ? 'You' : 'White'}"]\n[Black "${ai ? 'Gambit (level ' + this.level() + ')' : 'Black'}"]\n[Result "${o}"]\n${setup}\n${body} ${o}`;
  }
  copy(text: string, what: string) {
    this.io.set(text);
    navigator.clipboard.writeText(text).then(() => this.toast(`${what} copied`), () => this.toast('Copy failed. Select the text manually.'));
  }
  loadText(text: string) {
    const t = text.trim(); if (!t) return;
    const f = fromFen(t);
    if (f) { this.load(f, [], true); return; }
    const g = this.parsePgn(t);
    g ? this.load(g.start, g.moves, g.custom) : this.toast('Could not read that FEN or PGN.');
  }
  private parsePgn(t: string): { start: State; moves: Move[]; custom: boolean } | null {
    const tag = /\[FEN\s+"([^"]+)"\]/.exec(t), start = tag ? fromFen(tag[1]) : initial();
    if (!start) return null;
    const body = t.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ');
    let s = start; const moves: Move[] = [];
    for (const tok of body.split(/\s+/)) {
      const x = tok.replace(/[+#!?]/g, '');
      if (!x || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(x)) continue;
      const cur = s, m = legal(cur).find(c => san(cur, c).replace(/[+#]/g, '') === x);
      if (!m) return null;
      moves.push(m); s = play(cur, m);
    }
    return moves.length || tag ? { start, moves, custom: !!tag } : null;
  }

  // ---------- state loading ----------
  private restore(start: State, moves: Move[]) {
    const st = [start], sn: string[] = [];
    for (const m of moves) { const cur = st[st.length - 1]; sn.push(san(cur, m)); st.push(play(cur, m)); }
    this.states.set(st); this.sans.set(sn); this.lastMv.set(moves); this.view.set(null);
  }
  private load(start: State, moves: Move[], custom: boolean) {
    this.gen++;
    this.restore(start, moves); this.custom.set(custom); this.result.set(null);
    this.sel.set(-1); this.premove.set(null); this.promo.set(null); this.hint.set(null);
    this.arrows.set([]); this.marks.set([]); this.busy.set(false);
    const c = this.clock().m * 60000; this.tw.set(c); this.tb.set(c);
    this.recorded = this.over();
    this.say(this.statusText());
    if (this.mode() === 'ai' && this.s().turn === 'b' && !this.over()) this.engineMove();
  }

  // ---------- animation + feedback ----------
  private slide(from: number, to: number) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    afterNextRender(() => {
      const el = document.getElementById('pc' + to); if (!el) return;
      const a = this.pos(from), b = this.pos(to);
      el.style.zIndex = '9';
      el.animate(
        [{ transform: `translate(${((a & 7) - (b & 7)) * 100}%, ${((a >> 3) - (b >> 3)) * 100}%)` }, { transform: 'none' }],
        { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }
      ).onfinish = () => (el.style.zIndex = '');
    }, { injector: this.inj });
  }
  private feedback(m: Move) {
    const k = this.over() ? 'end' : this.st() === 'check' ? 'check' : m.castle ? 'castle' : m.cap ? 'capture' : 'move';
    this.sfx.play(k);
    navigator.vibrate?.(k === 'end' ? [40, 60, 40] : k === 'check' ? [20, 40, 20] : k === 'capture' ? 25 : 10);
  }

  // ---------- controls ----------
  undo() {
    if (this.busy() || this.result()) return;
    const n = this.mode() === 'ai' && this.s().turn === 'w' ? 2 : 1;
    if (this.sans().length < n) return;
    this.gen++; this.view.set(null);
    this.states.update(a => a.slice(0, -n)); this.sans.update(a => a.slice(0, -n)); this.lastMv.update(a => a.slice(0, -n));
    this.sel.set(-1); this.hint.set(null); this.premove.set(null);
  }
  async getHint() {
    if (this.busy() || this.over() || this.view() !== null) return;
    const g = this.gen;
    this.busy.set(true);
    const m = await this.think(this.s(), 4, 1200);
    if (g !== this.gen) return;
    this.busy.set(false);
    this.hint.set(m);
  }
  newGame() { this.load(initial(), [], false); }
  setMode(m: 'ai' | 'local') { this.mode.set(m); this.newGame(); }
}