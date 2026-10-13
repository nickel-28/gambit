const BOOK: [string, string][] = [
  ['e4', "King's Pawn Game"], ['e4 e5', 'Open Game'], ['e4 e5 Nf3', "King's Knight Opening"],
  ['e4 e5 Nf3 Nc6 Bb5', 'Ruy Lopez'], ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Giuoco Piano'], ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Two Knights Defence'],
  ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'], ['e4 e5 Nf3 Nf6', 'Petrov Defence'], ['e4 e5 Nf3 d6', 'Philidor Defence'],
  ['e4 e5 Bc4', "Bishop's Opening"], ['e4 e5 Nc3', 'Vienna Game'], ['e4 e5 f4', "King's Gambit"],
  ['e4 c5', 'Sicilian Defence'], ['e4 c5 c3', 'Sicilian Defence: Alapin'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian Defence: Najdorf'],
  ['e4 e6', 'French Defence'], ['e4 c6', 'Caro-Kann Defence'], ['e4 d5', 'Scandinavian Defence'],
  ['e4 d6', 'Pirc Defence'], ['e4 g6', 'Modern Defence'], ['e4 Nf6', "Alekhine's Defence"],
  ['d4', "Queen's Pawn Game"], ['d4 d5', 'Closed Game'], ['d4 d5 c4', "Queen's Gambit"],
  ['d4 d5 c4 e6', "Queen's Gambit Declined"], ['d4 d5 c4 dxc4', "Queen's Gambit Accepted"],
  ['d4 d5 c4 c6', 'Slav Defence'], ['d4 d5 Nf3 Nf6 Bf4', 'London System'],
  ['d4 Nf6', 'Indian Defence'], ['d4 Nf6 c4 g6', "King's Indian Defence"],
  ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defence'], ['d4 Nf6 c4 e6 Nf3 b6', "Queen's Indian Defence"],
  ['c4', 'English Opening'], ['Nf3', 'Réti Opening'], ['f4', "Bird's Opening"],
];

export function openingName(sans: string[]): string {
  const m = sans.map(x => x.replace(/[+#]/g, '')).join(' ');
  let name = '', len = 0;
  for (const [p, n] of BOOK) if ((m === p || m.startsWith(p + ' ')) && p.length > len) { name = n; len = p.length; }
  return name;
}