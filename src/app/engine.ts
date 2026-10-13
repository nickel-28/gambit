export type Color = 'w' | 'b';
export interface Move { from: number; to: number; promo?: string; ep?: boolean; castle?: boolean; cap?: boolean }
export interface State { b: string[]; turn: Color; c: string; ep: number; h: number }
const D: Record<string, number[][]> = {
  N: [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]],
  B: [[1,1],[1,-1],[-1,1],[-1,-1]], R: [[1,0],[-1,0],[0,1],[0,-1]] };
D['Q'] = [...D['B'], ...D['R']]; D['K'] = D['Q'];
export const opp = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const file = (i: number) => 'abcdefgh'[i & 7];
export const rank = (i: number) => 8 - (i >> 3);

export function initial(): State {
  const back = 'RNBQKBNR', b: string[] = new Array(64).fill('');
  for (let c = 0; c < 8; c++) { b[c] = 'b' + back[c]; b[8 + c] = 'bP'; b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c]; }
  return { b, turn: 'w', c: 'KQkq', ep: -1, h: 0 };
}
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function attacked(b: string[], sq: number, by: Color): boolean {
  const r = sq >> 3, c = sq & 7, pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (on(pr, c + dc) && b[pr * 8 + c + dc] === by + 'P') return true;
  for (const t of ['N', 'K'])
    for (const [dr, dc] of D[t]) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + t) return true;
  for (const t of ['B', 'R'])
    for (const [dr, dc] of D[t]) {
      let rr = r + dr, cc = c + dc;
      while (on(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (p[0] === by && (p[1] === t || p[1] === 'Q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
  return false;
}

function pseudo(s: State): Move[] {
  const { b, turn } = s, e = opp(turn), out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || p[0] !== turn) continue;
    const t = p[1], r = i >> 3, c = i & 7;
    if (t === 'P') {
      const d = turn === 'w' ? -1 : 1, pr = r + d;
      const add = (to: number, x: Partial<Move> = {}) => {
        if (pr === (turn === 'w' ? 0 : 7)) for (const q of 'QRBN') out.push({ from: i, to, promo: q, ...x });
        else out.push({ from: i, to, ...x });
      };
      if (!b[pr * 8 + c]) {
        add(pr * 8 + c);
        if (r === (turn === 'w' ? 6 : 1) && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c);
      }
      for (const dc of [-1, 1]) {
        if (!on(pr, c + dc)) continue;
        const to = pr * 8 + c + dc;
        if (b[to] && b[to][0] === e) add(to, { cap: true });
        else if (to === s.ep) add(to, { cap: true, ep: true });
      }
    } else {
      const slide = t !== 'N' && t !== 'K';
      for (const [dr, dc] of D[t]) {
        let rr = r + dr, cc = c + dc;
        while (on(rr, cc)) {
          const to = rr * 8 + cc, q = b[to];
          if (q) { if (q[0] === e) out.push({ from: i, to, cap: true }); break; }
          out.push({ from: i, to });
          if (!slide) break;
          rr += dr; cc += dc;
        }
      }
      if (t === 'K' && i === (turn === 'w' ? 60 : 4) && !attacked(b, i, e)) {
        const k = turn === 'w' ? 'K' : 'k', q = turn === 'w' ? 'Q' : 'q';
        if (s.c.includes(k) && !b[i + 1] && !b[i + 2] && b[i + 3] === turn + 'R' && !attacked(b, i + 1, e) && !attacked(b, i + 2, e))
          out.push({ from: i, to: i + 2, castle: true });
        if (s.c.includes(q) && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] === turn + 'R' && !attacked(b, i - 1, e) && !attacked(b, i - 2, e))
          out.push({ from: i, to: i - 2, castle: true });
      }
    }
  }
  return out;
}

export function play(s: State, m: Move): State {
  const b = s.b.slice(), t = s.turn, p = b[m.from]; let c = s.c, ep = -1;
  const h = p[1] === 'P' || b[m.to] || m.ep ? 0 : s.h + 1;
  b[m.to] = m.promo ? t + m.promo : p; b[m.from] = '';
  if (m.ep) b[m.to + (t === 'w' ? 8 : -8)] = '';
  if (m.castle) {
    if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
    else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
  }
  if (p[1] === 'P' && Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
  const rm: Record<number, string> = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' };
  for (const q of [m.from, m.to]) if (rm[q]) for (const ch of rm[q]) c = c.replace(ch, '');
  return { b, turn: opp(t), c, ep, h };
}

export function legal(s: State): Move[] {
  return pseudo(s).filter(m => { const n = play(s, m); return !attacked(n.b, n.b.indexOf(s.turn + 'K'), n.turn); });
}
export const inCheck = (s: State) => attacked(s.b, s.b.indexOf(s.turn + 'K'), opp(s.turn));
export function status(s: State, n = legal(s).length): 'play' | 'check' | 'checkmate' | 'stalemate' {
  const ch = inCheck(s); return n ? (ch ? 'check' : 'play') : (ch ? 'checkmate' : 'stalemate');
}

export function san(s: State, m: Move): string {
  const sq = (i: number) => file(i) + rank(i); let x: string;
  if (m.castle) x = m.to > m.from ? 'O-O' : 'O-O-O';
  else {
    const p = s.b[m.from][1];
    if (p === 'P') x = (m.cap ? file(m.from) + 'x' : '') + sq(m.to) + (m.promo ? '=' + m.promo : '');
    else {
      const amb = legal(s).some(o => o !== m && s.b[o.from] === s.b[m.from] && o.to === m.to);
      x = p + (amb ? file(m.from) : '') + (m.cap ? 'x' : '') + sq(m.to);
    }
  }
  const st = status(play(s, m));
  return x + (st === 'checkmate' ? '#' : st === 'check' ? '+' : '');
}

// ---- Engine: negamax + alpha-beta, material + centre/pawn-advance heuristics ----
const V: Record<string, number> = { P: 100, N: 320, B: 335, R: 500, Q: 900, K: 0 };
function evaluate(s: State): number {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i]; if (!p) continue;
    const r = i >> 3, c = i & 7, t = p[1], w = p[0] === 'w';
    let x = V[t];
    if (t !== 'K') x += (6 - Math.abs(3.5 - r) - Math.abs(3.5 - c)) * (t === 'P' ? 4 : 3);
    if (t === 'P') x += (w ? 6 - r : r - 1) * 6;
    v += w ? x : -x;
  }
  return s.turn === 'w' ? v : -v;
}
// ---- Repetition, material and FEN helpers ----
export const key = (s: State) => s.b.map(p => p || '-').join('') + s.turn + s.c;

export function insufficient(s: State): boolean {
  const ps = s.b.filter(p => p && p[1] !== 'K');
  if (!ps.length) return true;
  if (ps.length === 1 && (ps[0][1] === 'N' || ps[0][1] === 'B')) return true;
  if (ps.every(p => p[1] === 'B')) {
    const cols = s.b.map((p, i) => (p && p[1] === 'B' ? ((i >> 3) + (i & 7)) % 2 : -1)).filter(x => x >= 0);
    return cols.every(x => x === cols[0]);
  }
  return false;
}

export function toFen(s: State): string {
  let f = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let c = 0; c < 8; c++) {
      const p = s.b[r * 8 + c];
      if (!p) { e++; continue; }
      if (e) { f += e; e = 0; }
      f += p[0] === 'w' ? p[1] : p[1].toLowerCase();
    }
    if (e) f += e;
    if (r < 7) f += '/';
  }
  return `${f} ${s.turn} ${s.c || '-'} ${s.ep >= 0 ? file(s.ep) + rank(s.ep) : '-'} ${s.h} 1`;
}

export function fromFen(fen: string): State | null {
  const [pos, t, c, ep, h] = fen.trim().split(/\s+/);
  const rows = (pos || '').split('/');
  if (rows.length !== 8) return null;
  const b: string[] = [];
  for (const row of rows)
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push('');
      else if ('KQRBNP'.includes(ch.toUpperCase())) b.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
      else return null;
    }
  if (b.length !== 64 || !b.includes('wK') || !b.includes('bK')) return null;
  return {
    b, turn: t === 'b' ? 'b' : 'w', c: c && c !== '-' ? c : '',
    ep: ep && ep !== '-' ? (8 - +ep[1]) * 8 + 'abcdefgh'.indexOf(ep[0]) : -1, h: +h || 0,
  };
}

// ---- Search: iterative deepening, alpha-beta, quiescence, MVV-LVA ordering, time limit ----
class Timeout {}
let deadline = 0, nodes = 0;
const mvv = (s: State, m: Move) =>
  (m.cap ? 10 * V[(s.b[m.to] || 'wP')[1]] - V[s.b[m.from][1]] / 10 : 0) + (m.promo ? 800 : 0);
const order = (s: State, ms: Move[]) => ms.sort((a, b) => mvv(s, b) - mvv(s, a));
const tick = () => { if ((++nodes & 1023) === 0 && performance.now() > deadline) throw new Timeout(); };

function quiesce(s: State, a: number, b: number, q = 0): number {
  tick();
  const stand = evaluate(s);
  if (q >= 6 || stand >= b) return Math.min(stand, b) === stand && stand >= b ? b : stand;
  if (stand > a) a = stand;
  for (const m of order(s, legal(s).filter(x => x.cap || x.promo))) {
    const v = -quiesce(play(s, m), -b, -a, q + 1);
    if (v >= b) return b;
    if (v > a) a = v;
  }
  return a;
}

function search(s: State, d: number, a: number, b: number): number {
  tick();
  const ms = legal(s);
  if (!ms.length) return inCheck(s) ? -1e5 - d : 0;
  if (d === 0) return quiesce(s, a, b);
  for (const m of order(s, ms)) {
    const v = -search(play(s, m), d - 1, -b, -a);
    if (v >= b) return b;
    if (v > a) a = v;
  }
  return a;
}

export function best(s: State, depth: number, ms = 1500): Move | null {
  const root = legal(s);
  if (!root.length) return null;
  deadline = performance.now() + ms; nodes = 0;
  let bm = order(s, root)[0];
  for (let d = 1; d <= depth; d++) {
    try {
      const list = [bm, ...order(s, root.filter(m => m !== bm))];
      let a = -1e9, cur = bm;
      for (const m of list) {
        const v = -search(play(s, m), d - 1, -1e9, -a) + Math.random() * 3;
        if (v > a) { a = v; cur = m; }
      }
      bm = cur;
      if (a > 9e4) break;
    } catch (e) { if (e instanceof Timeout) break; throw e; }
  }
  return bm;
}