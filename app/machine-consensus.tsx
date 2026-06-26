"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MCOption = { name: string; mark: string };
export type MCQuestion = {
  prompt: string;
  options: MCOption[];
  pct: number[];
  winnerIndex: number;
  explanation: string;
  disagreement: string;
};

type Props = {
  questions: MCQuestion[];
  models: string[];
  dateLabel: string;
  dateShort: string;
  editionLabel: string;
  revealMs?: number;
  forceReducedMotion?: boolean;
};

type Screen = "landing" | "playing" | "score";
type Phase = "predict" | "locked" | "reveal";

const WORDS = ["machine", "model", "AI", "consensus", "LLM"];
const BEST_SCORE_KEY = "outguess-best-score";

type FloatBarItem = { label: string; pct: number; winner?: boolean };
type FloatPillItem = { label: string; winner?: boolean };
type FloatCardDef = {
  prompt: string;
  pos: React.CSSProperties;
  rot: string;
  width: number; opacity: number;
  mobileHide?: boolean;
  bars?: FloatBarItem[];
  pills?: FloatPillItem[];
};

const FLOAT_CARDS: FloatCardDef[] = [
  {
    prompt: "What would four AIs agree on?",
    pos: { top: "41%", left: "24%" },
    rot: "-1deg", width: 190, opacity: 0.22,
    bars: [
      { label: "Mathematics", pct: 71, winner: true },
      { label: "Logic", pct: 20 },
      { label: "Efficiency", pct: 9 },
    ],
  },
  {
    prompt: "Which invention would confuse a medieval king?",
    pos: { top: "14%", left: "4%" },
    rot: "-3deg", width: 208, opacity: 0.30,
    bars: [
      { label: "Smartphone", pct: 67, winner: true },
      { label: "Microwave", pct: 21 },
      { label: "Escalator", pct: 12 },
    ],
  },
  {
    prompt: "Who would survive a group project?",
    pos: { top: "13%", left: "61%" },
    rot: "2.5deg", width: 194, opacity: 0.28,
    pills: [
      { label: "Quiet overachiever", winner: true },
      { label: "Natural delegator" },
    ],
  },
  {
    prompt: "Which fictional character makes the best mayor?",
    pos: { top: "75%", left: "7%" },
    rot: "-2deg", width: 214, opacity: 0.26,
    mobileHide: true,
    bars: [
      { label: "Leslie Knope", pct: 58, winner: true },
      { label: "Hermione", pct: 28 },
      { label: "Atticus Finch", pct: 14 },
    ],
  },
  {
    prompt: "Which animal would give the best TED talk?",
    pos: { top: "75%", left: "63%" },
    rot: "-1.5deg", width: 198, opacity: 0.24,
    mobileHide: true,
    bars: [
      { label: "Octopus", pct: 52, winner: true },
      { label: "Crow", pct: 31 },
      { label: "Dolphin", pct: 17 },
    ],
  },
  {
    prompt: "Which word best describes the internet?",
    pos: { top: "44%", left: "73%" },
    rot: "1deg", width: 190, opacity: 0.28,
    mobileHide: true,
    bars: [
      { label: "Chaotic", pct: 44, winner: true },
      { label: "Useful", pct: 35 },
      { label: "Weird", pct: 21 },
    ],
  },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const pad2 = (n: number) => String(n).padStart(2, "0");
const survivalVerdict = (score: number) => {
  if (score === 0) return "The machine got you immediately.";
  if (score < 3) return "A brief contact with the machine.";
  if (score < 7) return "You can hear the machine humming.";
  if (score < 12) return "You understand the machine.";
  if (score < 20) return "The machine recognizes one of its own.";
  return "You ARE the machine.";
};

function shuffleQuestions(
  questions: MCQuestion[],
  avoidFirst?: MCQuestion,
): MCQuestion[] {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  if (avoidFirst && shuffled.length > 1 && shuffled[0] === avoidFirst) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function ModelLogo({ id }: { id: string }) {
  const logos: Record<string, { src: string; w: number; label: string }> = {
    gemini: { src: "/logos/gemini.svg", w: 72,  label: "Gemini"    },
    claude: { src: "/logos/claude.svg", w: 76,  label: "Claude"    },
    kimi:   { src: "/logos/kimi.svg",   w: 38,  label: "Kimi"      },
    mistral:{ src: "/logos/mistral.svg",w: 90,  label: "Mistral AI" },
  };
  const logo = logos[id];
  if (!logo) return <span>{id}</span>;
  return (
    <img
      src={logo.src}
      alt={logo.label}
      width={logo.w}
      height={18}
      style={{ display: "block", objectFit: "contain" }}
      draggable={false}
    />
  );
}

function FloatCardLayer({ cards, isReduced }: { cards: FloatCardDef[]; isReduced: () => boolean }) {
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const statesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>(
    cards.map((_, i) => {
      const angle = (i * Math.PI * 2 / cards.length) + Math.PI / 5;
      const speed = 0.35 + (i % 3) * 0.12;
      return { x: 0, y: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    })
  );
  const cardRefs = useRef<(HTMLDivElement | null)[]>(cards.map(() => null));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isReduced()) return;
    const states = statesRef.current;

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    const REPEL        = 0.12;
    const RADIUS       = 130;
    const SEP          = 0.12;
    const GAP          = 20;
    const WALL_PAD     = 6;
    const RESTITUTION  = 0.92;
    const CARD_MIN     = 0.8;
    const TARGET_SPEED = 0.45;
    const SPEED_CORR   = 0.015;

    const tick = () => {
      const { x: mx, y: my } = mouseRef.current;
      const rects = cardRefs.current.map(el => el ? el.getBoundingClientRect() : null);
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      for (let i = 0; i < cards.length; i++) {
        const s = states[i];
        const r = rects[i];

        // Gently nudge speed toward TARGET_SPEED without changing direction
        const spd = Math.hypot(s.vx, s.vy);
        if (spd > 0.01) {
          const nudge = (TARGET_SPEED - spd) * SPEED_CORR;
          s.vx += (s.vx / spd) * nudge;
          s.vy += (s.vy / spd) * nudge;
        }

        if (r) {
          // Cursor repulsion
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = cx - mx;
          const dy = cy - my;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < RADIUS) {
            const strength = (1 - dist / RADIUS) * REPEL;
            s.vx += (dx / dist) * strength;
            s.vy += (dy / dist) * strength;
          }

          // Wall bounce — reflect and push card back inside
          if (r.left < WALL_PAD && s.vx < 0) {
            s.vx = Math.abs(s.vx) * RESTITUTION;
            s.x += WALL_PAD - r.left;
          }
          if (r.right > vw - WALL_PAD && s.vx > 0) {
            s.vx = -Math.abs(s.vx) * RESTITUTION;
            s.x -= r.right - (vw - WALL_PAD);
          }
          if (r.top < WALL_PAD && s.vy < 0) {
            s.vy = Math.abs(s.vy) * RESTITUTION;
            s.y += WALL_PAD - r.top;
          }
          if (r.bottom > vh - WALL_PAD && s.vy > 0) {
            s.vy = -Math.abs(s.vy) * RESTITUTION;
            s.y -= r.bottom - (vh - WALL_PAD);
          }
        }

        s.x += s.vx;
        s.y += s.vy;
      }

      for (let i = 0; i < cards.length - 1; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const ri = rects[i]; const rj = rects[j];
          if (!ri || !rj) continue;
          const cxi = ri.left + ri.width / 2;  const cyi = ri.top + ri.height / 2;
          const cxj = rj.left + rj.width / 2;  const cyj = rj.top + rj.height / 2;
          const ox = (ri.width + rj.width) / 2 + GAP - Math.abs(cxi - cxj);
          const oy = (ri.height + rj.height) / 2 + GAP - Math.abs(cyi - cyj);
          if (ox > 0 && oy > 0) {
            const dx = cxi - cxj; const dy = cyi - cyj;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist; const ny = dy / dist;

            // Positional separation nudge
            const sep = Math.min(ox, oy) * SEP;
            states[i].vx += nx * sep; states[i].vy += ny * sep;
            states[j].vx -= nx * sep; states[j].vy -= ny * sep;

            // Elastic collision: swap normal velocity components, enforce minimum impulse
            const v1n = states[i].vx * nx + states[i].vy * ny;
            const v2n = states[j].vx * nx + states[j].vy * ny;
            if (v1n - v2n < 0) {
              const dv = Math.min(v1n - v2n, -CARD_MIN);
              states[i].vx -= dv * nx; states[i].vy -= dv * ny;
              states[j].vx += dv * nx; states[j].vy += dv * ny;
            }
          }
        }
      }

      for (let i = 0; i < cards.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        el.style.transform = `translate(${states[i].x.toFixed(1)}px, ${states[i].y.toFixed(1)}px) rotate(${cards[i].rot})`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMouse);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cards, isReduced]);

  return (
    <div className="mc-float-layer" aria-hidden>
      {cards.map((card, i) => {
        const maxPct = card.bars ? Math.max(...card.bars.map(b => b.pct)) : 100;
        return (
          <div
            key={i}
            className={`mc-float-wrap${card.mobileHide ? " mc-float-wrap--mobile-hide" : ""}`}
            style={{ ...card.pos }}
          >
            <div
              ref={el => { cardRefs.current[i] = el; }}
              className="mc-float-card"
              style={{ width: card.width, opacity: card.opacity }}
            >
              <p className="mc-float-prompt">{card.prompt}</p>
              {card.bars && (
                <div className="mc-float-bars">
                  {card.bars.map((bar, j) => (
                    <div key={j} className="mc-float-bar-row">
                      <span className="mc-float-bar-label">{bar.label}</span>
                      <div className="mc-float-bar-track">
                        <div
                          className={`mc-float-bar-fill${bar.winner ? " mc-float-bar-fill--win" : ""}`}
                          style={{ width: `${(bar.pct / maxPct) * 100}%` }}
                        />
                      </div>
                      <span className="mc-float-bar-pct">{bar.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {card.pills && (
                <div className="mc-float-pills">
                  {card.pills.map((pill, j) => (
                    <span key={j} className={`mc-float-pill${pill.winner ? " mc-float-pill--win" : ""}`}>
                      {pill.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Outguess({
  questions,
  models,
  dateLabel,
  dateShort,
  editionLabel,
  revealMs = 1500,
  forceReducedMotion = false,
}: Props) {
  const total = questions.length;

  const [screen, setScreen] = useState<Screen>("landing");
  const [questionDeck, setQuestionDeck] = useState<MCQuestion[]>(questions);
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("predict");
  const [picked, setPicked] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [displayWord, setDisplayWord] = useState(WORDS[0]);
  const [wordIndex, setWordIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [introEnabled, setIntroEnabled] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundBodyRef = useRef<HTMLDivElement | null>(null);

  const isReduced = useCallback(
    () => {
      if (reduced || forceReducedMotion) return true;
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    },
    [reduced, forceReducedMotion],
  );

  const clearTimers = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  const typeWord = useCallback((target: string, onComplete?: () => void) => {
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    setDisplayWord("");
    let i = 0;
    typeTimerRef.current = setInterval(() => {
      i++;
      setDisplayWord(target.slice(0, i));
      if (i >= target.length && typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
        if (!onComplete) return;
        wordTimerRef.current = setTimeout(() => {
          let j = target.length;
          typeTimerRef.current = setInterval(() => {
            j--;
            setDisplayWord(target.slice(0, j));
            if (j <= 0) {
              clearInterval(typeTimerRef.current!);
              typeTimerRef.current = null;
              onComplete();
            }
          }, 72);
        }, 1800);
      }
    }, 105);
  }, []);

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        setReduced(true);

      const savedBest = Number.parseInt(
        window.localStorage.getItem(BEST_SCORE_KEY) || "0",
        10,
      );
      if (Number.isFinite(savedBest) && savedBest > 0) {
        setBestScore(savedBest);
      }
    } catch {
      /* no-op */
    }
    return () => {
      clearTimers();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, [clearTimers]);

  useEffect(() => {
    if (screen !== "landing" || isReduced()) return;

    let cancelled = false;
    const cycleNext = (idx: number) => {
      if (cancelled) return;
      const next = (idx + 1) % WORDS.length;
      setWordIndex(next);
      typeWord(WORDS[next], () => cycleNext(next));
    };

    const initialHold = setTimeout(() => {
      if (cancelled) return;
      let j = WORDS[0].length;
      typeTimerRef.current = setInterval(() => {
        j--;
        setDisplayWord(WORDS[0].slice(0, j));
        if (j <= 0) {
          clearInterval(typeTimerRef.current!);
          typeTimerRef.current = null;
          cycleNext(0);
        }
      }, 72);
    }, 2200);

    return () => {
      cancelled = true;
      clearTimeout(initialHold);
      if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, [screen, isReduced, typeWord]);

  const runReveal = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (isReduced()) {
      setProgress(1);
      setRevealDone(true);
      return;
    }
    const dur = revealMs;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setRevealDone(true);
    };
    rafRef.current = requestAnimationFrame(tick);
    revealTimerRef.current = setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(1);
      setRevealDone(true);
    }, dur + 300);
  }, [isReduced, revealMs]);

  const start = useCallback(() => {
    clearTimers();
    setHelpOpen(false);
    setQIndex(0);
    setPhase("predict");
    setPicked(null);
    setProgress(0);
    setRevealDone(false);
    setResults([]);
    setQuestionDeck(shuffleQuestions(questions));

    const shouldAnimateIntro = !isReduced();
    setIntroEnabled(shouldAnimateIntro);
    setRunKey((key) => key + 1);
    setScreen("playing");
  }, [clearTimers, isReduced, questions]);

  const choose = useCallback(
    (i: number) => {
      if (screen !== "playing" || phase !== "predict") return;
      const q = questionDeck[qIndex % total];
      const correct = i === q.winnerIndex;
      setPicked(i);
      setPhase("locked");
      const go = () => {
        setPhase("reveal");
        setResults((r) => [...r, { correct }]);
        runReveal();
      };
      if (isReduced()) go();
      else lockTimerRef.current = setTimeout(go, 560);
    },
    [screen, phase, questionDeck, qIndex, total, isReduced, runReveal],
  );

  const next = useCallback(() => {
    const lastAnswer = results[results.length - 1];
    if (lastAnswer && !lastAnswer.correct) {
      setScreen("score");
      return;
    }

    if ((qIndex + 1) % total === 0) {
      setQuestionDeck(shuffleQuestions(questions, questionDeck[qIndex % total]));
    }

    setQIndex((q) => q + 1);
    setPhase("predict");
    setPicked(null);
    setProgress(0);
    setRevealDone(false);
  }, [qIndex, questionDeck, questions, results, total]);

  const copyShare = useCallback(() => {
    const correct = results.filter((r) => r.correct).length;
    const grid = results
      .map((r) => (r.correct ? "◉" : "○"))
      .join("");
    const txt = `OUTGUESS — ${correct} correct\n${grid}\noutguess.game`;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
    } catch {
      /* no-op */
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
  }, [results, total]);

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (helpOpen) {
      if (e.key === "Escape") setHelpOpen(false);
      return;
    }
    if (shareOpen) {
      if (e.key === "Escape") setShareOpen(false);
      return;
    }
    if (screen === "landing") {
      if (e.key === "Enter") start();
      return;
    }
    if (screen === "playing") {
      if (phase === "predict") {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) { e.preventDefault(); choose(n - 1); }
      } else if (phase === "reveal" && revealDone) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
      }
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Clear the intro build class on first pick so feedback animations aren't blocked
  useEffect(() => {
    if (phase === "locked") setIntroEnabled(false);
  }, [phase]);

  useEffect(() => {
    if (screen !== "playing" || qIndex === 0 || isReduced()) return;
    const el = roundBodyRef.current;
    if (!el) return;

    // Fade whole body
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "pk-fadeUp .4s cubic-bezier(.22,.61,.36,1)";

    // Stagger choices within it
    const buttons = [...el.querySelectorAll<HTMLButtonElement>(".mc-choice")];
    buttons.forEach((btn) => { btn.style.animation = "none"; });
    void el.offsetWidth;
    buttons.forEach((btn, i) => {
      btn.style.setProperty("--choice-x", i % 2 === 0 ? "-10px" : "10px");
      btn.style.animation = `mc-choiceBuild .44s cubic-bezier(0.22,1,0.36,1) ${80 + i * 60}ms both`;
    });
  }, [qIndex, screen, isReduced]);

  // Derived
  const q = questionDeck[qIndex % total];
  const win = q.winnerIndex;
  const maxPct = q.pct[win];
  const eased = easeOutCubic(progress);
  const inChoose = phase === "predict" || phase === "locked";
  const inReveal = phase === "reveal";
  const pickedCorrect = picked === win;
  const runOver = inReveal && revealDone && !pickedCorrect;

  const correctCount = results.filter((r) => r.correct).length;
  const recentResults = results.slice(-5);
  const verdict = survivalVerdict(correctCount);
  const beatPct = Math.min(99, Math.round(6 + Math.log2(correctCount + 1) * 18));
  const totalLabel = "∞";

  useEffect(() => {
    if (correctCount <= bestScore) return;
    setBestScore(correctCount);
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(correctCount));
    } catch {
      /* no-op */
    }
  }, [bestScore, correctCount]);

  const choiceClass = (i: number): string => {
    const cls = ["mc-choice"];
    if (inReveal) {
      if (i === win) cls.push("mc-choice--winner");
      else if (i === picked) cls.push("mc-choice--wrong");
      else cls.push("mc-choice--faded");
      cls.push("mc-choice--locked", "mc-choice--compact");
    } else if (phase === "locked") {
      if (i === picked) cls.push("mc-choice--selected");
      else cls.push("mc-choice--faded");
      cls.push("mc-choice--locked");
    }
    return cls.join(" ");
  };

  const feedbackClass = inReveal
    ? pickedCorrect ? " mc-game-card--correct" : " mc-game-card--wrong"
    : "";

  const roundBadgeClass = (): string => {
    if (inReveal) {
      return pickedCorrect
        ? "mc-round-badge mc-round-badge--correct"
        : "mc-round-badge mc-round-badge--wrong";
    }
    return "mc-round-badge";
  };

  const roundBadgeLabel = (): string => {
    if (inReveal) return pickedCorrect ? "✓ Correct" : "✗ Missed";
    return `Round ${qIndex + 1}`;
  };

  return (
    <div className="mc-root">

      {/* ── Header ── */}
      <header className="mc-header">
        <div className="mc-header-inner">
          <div className="mc-brand">
            <span className="mc-logo-dot" />
            Outguess
          </div>

          {screen === "playing" ? (
            <div className="mc-progress">
              <div className="mc-pips">
                {recentResults.map((result, i) => (
                  <span
                    key={`${results.length - recentResults.length + i}-${result.correct ? "correct" : "wrong"}`}
                    className={`mc-pip${result.correct ? " mc-pip--done" : " mc-pip--wrong"}`}
                  />
                ))}
                {phase !== "reveal" || pickedCorrect ? (
                  <span className="mc-pip mc-pip--active" />
                ) : null}
              </div>
              <span className="mc-counter">
                {pad2(qIndex + 1)} / {totalLabel}
              </span>
            </div>
          ) : screen === "score" ? (
            <span className="mc-edition">{dateShort} · Edition {editionLabel}</span>
          ) : (
            <nav className="mc-nav-links">
              <a
                href="#"
                aria-haspopup="dialog"
                onClick={(e) => {
                  e.preventDefault();
                  setHelpOpen(true);
                }}
              >
                How to play
              </a>
              <a href="#" onClick={(e) => e.preventDefault()}>About</a>
            </nav>
          )}

          {screen === "playing" ? (
            <div className="mc-header-score" aria-label={`Score ${correctCount}`}>
              <span>Score</span>
              <strong>{correctCount}</strong>
            </div>
          ) : (
            <div className="mc-best-pill" aria-label={`Best run: ${bestScore}`}>
              <span className="mc-best-icon" aria-hidden>★</span>
              <span className="mc-best-label">best</span>
              <span className="mc-best-sep" aria-hidden />
              <span className="mc-best-num">{bestScore}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mc-main">

        {/* LANDING */}
        {screen === "landing" && (
          <>
            <FloatCardLayer cards={FLOAT_CARDS} isReduced={isReduced} />

            <div className="mc-landing">
              <div className="mc-badge">
                <span className="mc-badge-dot" />
                The AI prediction game
              </div>

              <h1 className="mc-display">
                Think like a<br />
                {displayWord || " "}
                <span className="mc-cursor" aria-hidden />.
              </h1>

              <p className="mc-lede">
                It&apos;s you against 4 AI models. Predict how the machine thinks.
                One wrong answer ends the run.
              </p>

              <div className="mc-cta-wrap">
                <button className="mc-btn-play" onClick={start}>
                  Start survival run
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <div className="mc-poll">
                <span className="mc-poll-label">Your opponents</span>
                <div className="mc-poll-logos">
                  {models.map((m) => (
                    <span key={m} className="mc-chip mc-chip--logo">
                      <ModelLogo id={m.toLowerCase()} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mc-meta-row">
                <span>{total} questions</span>
                <span className="mc-meta-sep" />
                <span>1 life</span>
              </div>
            </div>
          </>
        )}

        {/* PLAYING */}
        {screen === "playing" && (
          <section
            key={runKey}
            className={`mc-game-card${introEnabled ? " mc-game-card--building" : ""}${feedbackClass}`}
          >
            <div className="mc-card-top">
              <span className={roundBadgeClass()}>{roundBadgeLabel()}</span>
              <div className="mc-streak-area">
                <div className="mc-score-mini">
                  <span className="mc-streak-label">Score</span>
                  <span className="mc-streak-num">{correctCount}</span>
                </div>
                <div className="mc-score-mini mc-score-mini--muted">
                  <span className="mc-streak-label">Best</span>
                  <span className="mc-streak-num">{bestScore}</span>
                </div>
              </div>
            </div>

            <div ref={roundBodyRef} className="mc-round-body">
              <div className="mc-phase-label">
                {inReveal ? "The machine has voted" : "Predict the AI favorite"}
              </div>

              <div className="mc-prompt-box">
                <p className="mc-prompt-text">{q.prompt}</p>
              </div>

              {inChoose && (
                <p className="mc-choices-hint">
                  Which answer did the AI panel rank first?
                </p>
              )}

              <div className="mc-choices">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    className={choiceClass(i)}
                    onClick={() => choose(i)}
                    disabled={phase !== "predict"}
                  >
                    {inReveal && (
                      <span
                        className="mc-choice-fill"
                        style={{ width: `${((q.pct[i] / maxPct) * eased * 100).toFixed(1)}%` }}
                      />
                    )}
                    <span className="mc-choice-name">{opt.name}</span>
                    {inReveal && (
                      <span className="mc-choice-pct-label">
                        {Math.round(q.pct[i] * eased)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {inReveal && revealDone && (
                <div className="mc-explain">
                  <div className={`mc-result-line${pickedCorrect ? " mc-result-line--correct" : " mc-result-line--wrong"}`}>
                    {pickedCorrect ? "✓ You read the machine" : "✗ The machine disagreed"}
                  </div>
                  <p className="mc-explain-text">{q.explanation}</p>
                  <div className="mc-dissent-row">
                    <span className="mc-dissent-tag">Dissent</span>
                    <p className="mc-dissent-text">{q.disagreement}</p>
                  </div>
                  <button className="mc-btn-next" onClick={next}>
                    {runOver ? "See verdict" : "Next question"} →
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SCORE */}
        {screen === "score" && (
          <section className="mc-score-card">
            <div className="mc-score-over">Survival Verdict — {dateLabel}</div>
            <div className="mc-score-big">
              {correctCount}
            </div>
            <div className="mc-score-correct">
              correct answer{correctCount === 1 ? "" : "s"} before the miss
            </div>
            <div className="mc-score-verdict">{verdict}</div>

            <div className="mc-symbols">
              {results.map((r, i) => (
                <div key={i} className={`mc-symbol${r.correct ? " mc-symbol--correct" : " mc-symbol--wrong"}`}>
                  {r.correct ? "✓" : "✗"}
                </div>
              ))}
            </div>

            <div className="mc-stats">
              <div className="mc-stat">
                <div className="mc-stat-label">Score</div>
                <div className="mc-stat-value">
                  {correctCount}<span className="mc-stat-unit">rounds</span>
                </div>
              </div>
              <div className="mc-stat">
                <div className="mc-stat-label">Best</div>
                <div className="mc-stat-value">
                  {bestScore}<span className="mc-stat-unit">rounds</span>
                </div>
              </div>
              <div className="mc-stat">
                <div className="mc-stat-label">You beat</div>
                <div className="mc-stat-value">
                  {beatPct}<span className="mc-stat-unit">%</span>
                </div>
              </div>
            </div>

            <div className="mc-score-actions">
              <button
                className="mc-btn-share"
                onClick={() => { setShareOpen(true); setCopied(false); }}
              >
                Share result
              </button>
              <button className="mc-btn-ghost" onClick={start}>
                Play again →
              </button>
            </div>
          </section>
        )}

      </main>

      {/* ── How to play overlay ── */}
      {helpOpen && (
        <div className="mc-overlay" onClick={() => setHelpOpen(false)}>
          <section
            className="mc-help-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mc-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mc-help-kicker">How to play</div>
            <h2 id="mc-help-title" className="mc-help-title">
              Survive the machine.
            </h2>
            <p className="mc-help-text">
              Each round asks you to predict which answer a panel of AI models
              ranked highest. The answers are revealed after you lock in.
            </p>

            <div className="mc-help-steps">
              <div className="mc-help-step">
                <span>1</span>
                <div>
                  <strong>Choose the AI favorite</strong>
                  <p>Pick the option you think won the model consensus.</p>
                </div>
              </div>
              <div className="mc-help-step">
                <span>2</span>
                <div>
                  <strong>Watch the reveal</strong>
                  <p>The game shows the full percentage split and why AI leaned that way.</p>
                </div>
              </div>
              <div className="mc-help-step">
                <span>3</span>
                <div>
                  <strong>Keep your run alive</strong>
                  <p>Correct answers add to your score. One wrong answer ends the run.</p>
                </div>
              </div>
            </div>

            <div className="mc-help-rule">
              <span>∞</span>
              <p>
                Questions are shuffled from the full bank. If you clear the bank,
                it reshuffles and keeps going.
              </p>
            </div>

            <div className="mc-share-actions">
              <button className="mc-btn-copy" onClick={start}>
                Start survival run
              </button>
              <button className="mc-btn-close" onClick={() => setHelpOpen(false)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Share overlay ── */}
      {shareOpen && (
        <div className="mc-overlay" onClick={() => setShareOpen(false)}>
          <div className="mc-share-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-share-brand">
              <span className="mc-logo-dot" />
              Outguess
            </div>
            <div className="mc-share-edition">
              Edition {editionLabel} · {dateLabel}
            </div>
            <div className="mc-share-scorerow">
              <span className="mc-share-score">{correctCount}</span>
              <span className="mc-share-tag">{verdict}</span>
            </div>
            <div className="mc-share-grid">
              {results.map((r, i) => (
                <div key={i} className={`mc-share-cell${r.correct ? " mc-share-cell--correct" : " mc-share-cell--wrong"}`}>
                  {r.correct ? "✓" : "✗"}
                </div>
              ))}
            </div>
            <div className="mc-share-foot">No answers revealed · machineconsensus.game</div>
            <div className="mc-share-actions">
              <button className="mc-btn-copy" onClick={copyShare}>
                {copied ? "Copied ✓" : "Copy result"}
              </button>
              <button className="mc-btn-close" onClick={() => setShareOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
