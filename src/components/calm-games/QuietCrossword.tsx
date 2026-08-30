import { useEffect, useState } from "react";
import { sfx } from "@/components/neon-drift/audio";

// A real (if small) crossword generator: words are placed by finding letter
// intersections, not a fixed template — so the layout, not just the word
// selection, is genuinely different on every page load / "New puzzle".
type Direction = "across" | "down";
type BankEntry = { word: string; clue: string };
type Placed = { word: string; clue: string; row: number; col: number; dir: Direction; number: number };
type Cell = { letter: string; number: number | null } | null;

// General-knowledge clues spanning geography, nature, science, food, and
// everyday objects — nothing app-specific, so it reads like an ordinary
// newspaper mini crossword rather than in-app flavor text.
const WORD_BANK: BankEntry[] = [
  { word: "PLANET", clue: "A world orbiting a star" },
  { word: "OCEAN", clue: "Covers most of Earth's surface" },
  { word: "GUITAR", clue: "Instrument with six strings, usually" },
  { word: "VOLCANO", clue: "A mountain that can erupt" },
  { word: "COMPASS", clue: "A tool that always points north" },
  { word: "GLACIER", clue: "A slow-moving river of ice" },
  { word: "EAGLE", clue: "A bird of prey with famously sharp eyesight" },
  { word: "TIGER", clue: "A striped big cat" },
  { word: "DESERT", clue: "A dry, sandy, sparsely vegetated region" },
  { word: "BRIDGE", clue: "A structure built to span a river or gap" },
  { word: "CASTLE", clue: "A fortified home for medieval royalty" },
  { word: "GARDEN", clue: "A plot of land for growing flowers or vegetables" },
  { word: "WINTER", clue: "The coldest season of the year" },
  { word: "CANDLE", clue: "Wax and a wick, lit for light" },
  { word: "MIRROR", clue: "It reflects your image back at you" },
  { word: "PENCIL", clue: "A wooden writing tool with graphite inside" },
  { word: "ROBOT", clue: "A machine built to act on its own" },
  { word: "JUNGLE", clue: "A dense, tangled tropical forest" },
  { word: "KITCHEN", clue: "The room where meals get cooked" },
  { word: "DIAMOND", clue: "The hardest naturally occurring mineral" },
  { word: "LANTERN", clue: "A portable light housed in a case" },
  { word: "HARBOR", clue: "A sheltered place where ships dock" },
  { word: "MEADOW", clue: "An open field covered in grass and wildflowers" },
  { word: "THUNDER", clue: "The rumbling sound that follows lightning" },
  { word: "RAINBOW", clue: "An arc of colors that appears after rain" },
  { word: "MARBLE", clue: "A smooth stone favored by sculptors" },
  { word: "ORCHID", clue: "An exotic, often colorful flowering plant" },
  { word: "FALCON", clue: "A fast-diving bird of prey" },
  { word: "PYRAMID", clue: "The shape of an ancient Egyptian tomb" },
  { word: "CINEMA", clue: "Where you go to watch a film on a big screen" },
  { word: "ORIGAMI", clue: "The Japanese art of paper folding" },
  { word: "FROST", clue: "Ice crystals coating a cold morning" },
  { word: "EMBER", clue: "A glowing remnant of a dying fire" },
  { word: "ISLAND", clue: "A piece of land surrounded entirely by water" },
  { word: "RIVER", clue: "It flows from a source down to the sea" },
  { word: "GALAXY", clue: "A vast system of stars, like our Milky Way" },
  { word: "GRAVITY", clue: "The force that pulls objects toward Earth" },
  { word: "COFFEE", clue: "A morning brew made from roasted beans" },
  { word: "PENGUIN", clue: "A flightless bird built for icy waters" },
  { word: "DOLPHIN", clue: "A highly intelligent marine mammal" },
  { word: "VELVET", clue: "A soft, plush fabric" },
  { word: "HORIZON", clue: "Where the sky appears to meet the land or sea" },
  { word: "LAGOON", clue: "A shallow body of water separated from the sea" },
  { word: "MELODY", clue: "A pleasing sequence of musical notes" },
  { word: "SATURN", clue: "The ringed planet" },
  { word: "AMBER", clue: "Fossilized tree resin, sometimes holding insects" },
  { word: "CANYON", clue: "A deep gorge carved by a river" },
  { word: "SPARROW", clue: "A small, common backyard bird" },
];

const TARGET_WORDS = 9;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Draft = { word: string; clue: string; row: number; col: number; dir: Direction };
type WordShape = { word: string; row: number; col: number; dir: Direction };

function cellsOf(w: WordShape): { r: number; c: number; ch: string }[] {
  return [...w.word].map((ch, i) => ({ r: w.dir === "down" ? w.row + i : w.row, c: w.dir === "across" ? w.col + i : w.col, ch }));
}

// Beyond "letters must match where words overlap", a placement also has to
// avoid *accidental* adjacency: two unrelated words ending up touching would
// fake a phantom word in the grid that isn't in `words[]` — the numbering
// pass then can't find its head cell and falls back to a bogus "0." clue.
function fits(draft: Draft, occupied: Map<string, string>): boolean {
  const cells = cellsOf(draft);

  const before = draft.dir === "across" ? `${draft.row},${draft.col - 1}` : `${draft.row - 1},${draft.col}`;
  const afterR = draft.dir === "down" ? draft.row + draft.word.length : draft.row;
  const afterC = draft.dir === "across" ? draft.col + draft.word.length : draft.col;
  if (occupied.has(before) || occupied.has(`${afterR},${afterC}`)) return false;

  for (const { r, c, ch } of cells) {
    const existing = occupied.get(`${r},${c}`);
    if (existing) {
      if (existing !== ch) return false; // conflicting overlap
      continue; // intended intersection — fine
    }
    // an empty cell along this word's path must not brush against an
    // unrelated word running the other way
    const sideA = draft.dir === "across" ? `${r - 1},${c}` : `${r},${c - 1}`;
    const sideB = draft.dir === "across" ? `${r + 1},${c}` : `${r},${c + 1}`;
    if (occupied.has(sideA) || occupied.has(sideB)) return false;
  }
  return true;
}

function generatePuzzle() {
  const candidates = shuffle(WORD_BANK);
  const placed: Draft[] = [{ word: candidates[0].word, clue: candidates[0].clue, row: 0, col: 0, dir: "across" }];
  const occupied = new Map<string, string>();
  for (const { r, c, ch } of cellsOf(placed[0])) occupied.set(`${r},${c}`, ch);

  for (let i = 1; i < candidates.length && placed.length < TARGET_WORDS; i++) {
    const cand = candidates[i];
    let bestDraft: Draft | null = null;
    outer: for (const pw of placed) {
      for (let pi = 0; pi < pw.word.length; pi++) {
        for (let ci = 0; ci < cand.word.length; ci++) {
          if (pw.word[pi] !== cand.word[ci]) continue;
          const dir: Direction = pw.dir === "across" ? "down" : "across";
          const row = dir === "down" ? pw.row - ci : pw.row + pi;
          const col = dir === "across" ? pw.col - ci : pw.col + pi;
          const draft: Draft = { word: cand.word, clue: cand.clue, row, col, dir };
          if (fits(draft, occupied)) { bestDraft = draft; break outer; }
        }
      }
    }
    if (bestDraft) {
      placed.push(bestDraft);
      for (const { r, c, ch } of cellsOf(bestDraft)) occupied.set(`${r},${c}`, ch);
    }
  }

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const p of placed) for (const { r, c } of cellsOf(p)) {
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
  }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const norm = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));

  const grid: Cell[][] = Array.from({ length: rows }, () => Array<Cell>(cols).fill(null));
  for (const p of norm) for (const { r, c, ch } of cellsOf(p)) grid[r][c] = { letter: ch, number: null };

  let num = 1;
  const heads = new Map<string, number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const startsAcross = (c === 0 || !grid[r][c - 1]) && c + 1 < cols && !!grid[r][c + 1];
      const startsDown = (r === 0 || !grid[r - 1][c]) && r + 1 < rows && !!grid[r + 1][c];
      if (startsAcross || startsDown) {
        heads.set(`${r},${c}`, num);
        grid[r][c]!.number = num;
        num++;
      }
    }
  }

  const words: Placed[] = norm.map((p) => ({
    word: p.word, clue: p.clue, row: p.row, col: p.col, dir: p.dir,
    number: heads.get(`${p.row},${p.col}`) ?? 0,
  })).sort((a, b) => a.number - b.number || (a.dir === "across" ? -1 : 1));

  return { grid, words, rows, cols };
}

function wordKey(w: Placed) { return `${w.number}-${w.dir}`; }

export function QuietCrossword() {
  const [puzzle, setPuzzle] = useState(() => generatePuzzle());
  const [bank, setBank] = useState<string[]>([]);
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [solvedWords, setSolvedWords] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  // The puzzle is randomized, so it must never be part of the SSR-rendered
  // markup — server and client would each roll a different one and React
  // would flag a hydration mismatch. Generate it client-side only, after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setBank(shuffle(puzzle.words.map((w) => w.word)));
    setSelectedKey(wordKey(puzzle.words[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newPuzzle = () => {
    const p = generatePuzzle();
    setPuzzle(p);
    setBank(shuffle(p.words.map((w) => w.word)));
    setFilled({});
    setSolvedWords(new Set());
    setSelectedKey(wordKey(p.words[0]));
    setSolved(false);
  };

  const activeWord = puzzle.words.find((w) => wordKey(w) === selectedKey) ?? null;

  const selectWord = (w: Placed) => {
    if (solvedWords.has(wordKey(w))) return;
    setSelectedKey(wordKey(w));
  };

  const wordsAt = (r: number, c: number) => puzzle.words.filter((w) =>
    (w.dir === "across" && w.row === r && c >= w.col && c < w.col + w.word.length) ||
    (w.dir === "down" && w.col === c && r >= w.row && r < w.row + w.word.length));

  const onCellClick = (r: number, c: number) => {
    const here = wordsAt(r, c);
    if (here.length === 0) return;
    const other = here.find((w) => wordKey(w) !== selectedKey);
    const pick = here.length > 1 && here.some((w) => wordKey(w) === selectedKey) && other ? other : here[0];
    selectWord(pick);
  };

  const pickFromBank = (word: string) => {
    if (!activeWord) return;
    if (word !== activeWord.word) {
      setWrongPick(word);
      sfx.ui();
      setTimeout(() => setWrongPick(null), 450);
      return;
    }
    sfx.collect(3);
    setFilled((prev) => {
      const next = { ...prev };
      for (const { r, c, ch } of cellsOf(activeWord)) next[`${r},${c}`] = ch;
      return next;
    });
    setBank((prev) => {
      const idx = prev.indexOf(word);
      const next = [...prev];
      if (idx >= 0) next.splice(idx, 1);
      return next;
    });
    setSolvedWords((prev) => {
      const next = new Set(prev);
      next.add(wordKey(activeWord));
      if (next.size === puzzle.words.length) { setSolved(true); sfx.power(); }
      else {
        const nextWord = puzzle.words.find((w) => !next.has(wordKey(w)));
        if (nextWord) setSelectedKey(wordKey(nextWord));
      }
      return next;
    });
  };

  if (!mounted) {
    return (
      <div className="glass rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow mb-1">Quiet Crossword</p>
        <p className="text-sm text-muted-foreground">Laying out a fresh grid…</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-[2rem] p-6 md:p-8">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow">Quiet Crossword</p>
        <p className="text-sm text-muted-foreground tabular-nums">{solvedWords.size}/{puzzle.words.length} words</p>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        A new grid every time you refresh. Pick a clue, then tap the matching word below — no spelling required.
      </p>

      {activeWord && (
        <div className="mb-4 px-4 py-2 rounded-full bg-ink text-canvas text-sm inline-block">
          {activeWord.number} {activeWord.dir === "across" ? "Across" : "Down"} — {activeWord.clue}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <div
          className="grid gap-[2px] bg-ink/10 p-[2px] rounded-lg select-none shrink-0"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 2rem)`, gridAutoRows: "2rem" }}
        >
          {puzzle.grid.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              if (!cell) return <div key={key} className="bg-transparent" />;
              const isActive = !!activeWord && (
                (activeWord.dir === "across" && activeWord.row === r && c >= activeWord.col && c < activeWord.col + activeWord.word.length) ||
                (activeWord.dir === "down" && activeWord.col === c && r >= activeWord.row && r < activeWord.row + activeWord.word.length)
              );
              const letter = filled[key];
              return (
                <button
                  key={key}
                  onClick={() => onCellClick(r, c)}
                  className={`relative flex items-center justify-center font-serif text-sm md:text-base ${isActive ? "bg-sage/40" : "bg-canvas"} ${letter ? "text-emerald-600 font-semibold" : "text-ink"}`}
                >
                  {cell.number && <span className="absolute top-0 left-0.5 text-[8px] text-muted-foreground leading-none">{cell.number}</span>}
                  {letter ?? ""}
                </button>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm flex-1">
          <div>
            <p className="eyebrow mb-2">Across</p>
            <ul className="space-y-1.5">
              {puzzle.words.filter((w) => w.dir === "across").map((w) => (
                <li key={`a${w.number}`}>
                  <button
                    onClick={() => selectWord(w)}
                    disabled={solvedWords.has(wordKey(w))}
                    className={`text-left transition ${solvedWords.has(wordKey(w)) ? "text-emerald-600 line-through decoration-emerald-600/40" : wordKey(w) === selectedKey ? "text-ink font-medium" : "text-muted-foreground hover:text-ink"}`}
                  >
                    <span className="tabular-nums mr-1">{w.number}.</span>{w.clue}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">Down</p>
            <ul className="space-y-1.5">
              {puzzle.words.filter((w) => w.dir === "down").map((w) => (
                <li key={`d${w.number}`}>
                  <button
                    onClick={() => selectWord(w)}
                    disabled={solvedWords.has(wordKey(w))}
                    className={`text-left transition ${solvedWords.has(wordKey(w)) ? "text-emerald-600 line-through decoration-emerald-600/40" : wordKey(w) === selectedKey ? "text-ink font-medium" : "text-muted-foreground hover:text-ink"}`}
                  >
                    <span className="tabular-nums mr-1">{w.number}.</span>{w.clue}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="eyebrow mb-2">Word bank</p>
        <div className="flex flex-wrap gap-2">
          {bank.map((w) => (
            <button
              key={w}
              onClick={() => pickFromBank(w)}
              className={`px-4 py-2 rounded-xl font-serif tracking-[0.15em] text-sm transition ${
                wrongPick === w ? "bg-destructive/20 text-destructive" : "glass hover:bg-sage/30"
              }`}
            >
              {w}
            </button>
          ))}
          {bank.length === 0 && <p className="text-sm text-muted-foreground">All placed.</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={newPuzzle} className="px-5 py-2.5 rounded-full glass text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-ink transition">
          New puzzle
        </button>
        {solved && <p className="text-sm text-emerald-600 font-serif italic ml-2">Solved. ✦</p>}
      </div>
    </div>
  );
}
