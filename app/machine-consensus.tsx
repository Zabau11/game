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

const VERDICTS = [
  "The machine is unknowable to you.",
  "You think like a human.",
  "The machine remains a mystery.",
  "A respectful disagreement.",
  "You understand the machine.",
  "You ARE the machine.",
];
const BEATS = [6, 19, 43, 68, 85, 97];
const WORDS = ["machine", "model", "AI", "consensus", "LLM"];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const pad2 = (n: number) => String(n).padStart(2, "0");

export function MachineConsensus({
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
  const [qIndex, setQIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("predict");
  const [picked, setPicked] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const [results, setResults] = useState<{ correct: boolean }[]>([]);
  const [streak, setStreak] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [endless, setEndless] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [displayWord, setDisplayWord] = useState(WORDS[0]);
  const [wordIndex, setWordIndex] = useState(0);

  const rafRef = useRef<number | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundBodyRef = useRef<HTMLDivElement | null>(null);

  const isReduced = useCallback(
    () => reduced || forceReducedMotion,
    [reduced, forceReducedMotion],
  );

  const clearTimers = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  const typeWord = useCallback((target: string) => {
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    setDisplayWord("");
    let i = 0;
    typeTimerRef.current = setInterval(() => {
      i++;
      setDisplayWord(target.slice(0, i));
      if (i >= target.length && typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
      }
    }, 72);
  }, []);

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        setReduced(true);
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
    wordTimerRef.current = setInterval(() => {
      setWordIndex((prev) => {
        const next = (prev + 1) % WORDS.length;
        typeWord(WORDS[next]);
        return next;
      });
    }, 3000);
    return () => {
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
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
    setScreen("playing");
    setQIndex(0);
    setPhase("predict");
    setPicked(null);
    setProgress(0);
    setRevealDone(false);
    setResults([]);
    setEndless(false);
  }, [clearTimers]);

  const choose = useCallback(
    (i: number) => {
      if (phase !== "predict") return;
      const q = questions[qIndex % total];
      const correct = i === q.winnerIndex;
      setPicked(i);
      setPhase("locked");
      const go = () => {
        setPhase("reveal");
        setResults((r) => [...r, { correct }]);
        setStreak((s) => (correct ? s + 1 : 0));
        runReveal();
      };
      if (isReduced()) go();
      else lockTimerRef.current = setTimeout(go, 560);
    },
    [phase, questions, qIndex, total, isReduced, runReveal],
  );

  const next = useCallback(() => {
    if (!endless && qIndex >= total - 1) {
      setScreen("score");
      return;
    }
    setQIndex((q) => q + 1);
    setPhase("predict");
    setPicked(null);
    setProgress(0);
    setRevealDone(false);
  }, [endless, qIndex, total]);

  const endlessMode = useCallback(() => {
    clearTimers();
    setScreen("playing");
    setEndless(true);
    setQIndex(0);
    setPhase("predict");
    setPicked(null);
    setProgress(0);
    setRevealDone(false);
    setResults([]);
  }, [clearTimers]);

  const copyShare = useCallback(() => {
    const correct = results.slice(0, total).filter((r) => r.correct).length;
    const grid = results
      .slice(0, total)
      .map((r) => (r.correct ? "◉" : "○"))
      .join("");
    const txt = `MACHINE CONSENSUS — ${correct}/${total}\n${grid}\nmachineconsensus.game`;
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

  useEffect(() => {
    if (screen !== "playing" || isReduced()) return;
    const el = roundBodyRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "pk-fadeUp .4s cubic-bezier(.22,.61,.36,1)";
  }, [qIndex, screen, isReduced]);

  // Derived
  const q = questions[qIndex % total];
  const win = q.winnerIndex;
  const maxPct = q.pct[win];
  const eased = easeOutCubic(progress);
  const inChoose = phase === "predict" || phase === "locked";
  const inReveal = phase === "reveal";
  const pickedCorrect = picked === win;

  const answered = Math.min(results.length, total);
  const cur = qIndex % total;

  const dailyResults = results.slice(0, total);
  const correctCount = dailyResults.filter((r) => r.correct).length;
  const verdict = VERDICTS[correctCount] || VERDICTS[0];
  const beatPct = BEATS[correctCount] || 0;
  const totalLabel = endless ? "∞" : pad2(total);

  const choiceClass = (i: number): string => {
    const cls = ["mc-choice"];
    if (inReveal) {
      if (i === win) cls.push("mc-choice--winner");
      else if (i === picked) cls.push("mc-choice--wrong");
      else cls.push("mc-choice--faded");
      cls.push("mc-choice--locked");
    } else if (phase === "locked") {
      if (i === picked) cls.push("mc-choice--selected");
      else cls.push("mc-choice--faded");
      cls.push("mc-choice--locked");
    }
    return cls.join(" ");
  };

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
    return endless ? `Round ${qIndex + 1}` : `Question ${qIndex + 1} of ${total}`;
  };

  return (
    <div className="mc-root">

      {/* ── Header ── */}
      <header className="mc-header">
        <div className="mc-header-inner">
          <div className="mc-brand">
            <span className="mc-logo-dot" />
            Machine Consensus
          </div>

          {screen === "playing" ? (
            <div className="mc-progress">
              <div className="mc-pips">
                {questions.map((_, i) => (
                  <span
                    key={i}
                    className={`mc-pip${i < answered ? " mc-pip--done" : i === cur ? " mc-pip--active" : ""}`}
                  />
                ))}
              </div>
              <span className="mc-counter">
                {pad2(qIndex + 1)} / {totalLabel}
              </span>
            </div>
          ) : screen === "score" ? (
            <span className="mc-edition">{dateShort} · Edition {editionLabel}</span>
          ) : (
            <nav className="mc-nav-links">
              <a href="#" onClick={(e) => e.preventDefault()}>How to play</a>
              <a href="#" onClick={(e) => e.preventDefault()}>About</a>
            </nav>
          )}

          <div style={{ width: 140, flexShrink: 0 }} />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mc-main">

        {/* LANDING */}
        {screen === "landing" && (
          <>
            <div className="mc-ambient" aria-hidden>
              <span style={{ top: "11%", left: "3%",  opacity: 0.055, animation: "pk-float1 24s ease-in-out infinite" }}>Which model ranks empathy highest?</span>
              <span style={{ top: "74%", left: "2%",  opacity: 0.045, animation: "pk-float3 30s ease-in-out infinite", animationDelay: "-6s" }}>What do AIs agree on?</span>
              <span style={{ top: "88%", left: "22%", opacity: 0.04,  animation: "pk-float2 34s ease-in-out infinite", animationDelay: "-14s" }}>Name the most creative model.</span>
              <span style={{ top: "18%", right: "2%", opacity: 0.055, animation: "pk-float4 27s ease-in-out infinite", animationDelay: "-3s" }}>Which AI prefers poetry over code?</span>
              <span style={{ top: "62%", right: "3%", opacity: 0.05,  animation: "pk-float1 32s ease-in-out infinite", animationDelay: "-11s" }}>What is the consensus on beauty?</span>
              <span style={{ top: "6%",  left: "36%", opacity: 0.038, animation: "pk-float3 38s ease-in-out infinite", animationDelay: "-20s" }}>Can machines dream of logic?</span>
              <span style={{ top: "84%", right: "10%",opacity: 0.048, animation: "pk-float2 29s ease-in-out infinite", animationDelay: "-8s" }}>Which answer ranked first?</span>
              <span style={{ top: "44%", left: "1%",  opacity: 0.04,  animation: "pk-float4 36s ease-in-out infinite", animationDelay: "-17s" }}>Give a synonym for &ldquo;consensus.&rdquo;</span>
            </div>

            <div className="mc-landing">
              <div className="mc-badge">
                <span className="mc-badge-dot" />
                The AI prediction game
              </div>

              <h1 className="mc-display">
                Think like a<br />
                {displayWord || " "}.
              </h1>

              <p className="mc-lede">
                Five questions. A panel of AI models votes in secret.
                Predict the consensus — then watch the tally revealed.
              </p>

              <div className="mc-cta-wrap">
                <button className="mc-btn-play" onClick={start}>
                  Play today&rsquo;s five
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <div className="mc-meta-row">
                <span>5 questions</span>
                <span className="mc-meta-sep" />
                <span>~2 minutes</span>
                <span className="mc-meta-sep" />
                <span>No account needed</span>
              </div>

              <div className="mc-poll">
                <span className="mc-poll-label">Polling</span>
                {models.map((m) => (
                  <span key={m} className="mc-chip">{m}</span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PLAYING */}
        {screen === "playing" && (
          <section className="mc-game-card">
            <div className="mc-card-top">
              <span className={roundBadgeClass()}>{roundBadgeLabel()}</span>
              <div className="mc-streak-area">
                <span className="mc-streak-label">Streak</span>
                <span className="mc-streak-num">
                  {results.filter((r) => r.correct).length}
                </span>
              </div>
            </div>

            <div ref={roundBodyRef} className="mc-round-body" key={qIndex}>
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
                    {opt.name}
                  </button>
                ))}
              </div>

              {inReveal && (
                <>
                  <div className="mc-reveal-bars">
                    {q.options.map((opt, i) => (
                      <div key={i} className="mc-bar-item">
                        <div className="mc-bar-header">
                          <span className={`mc-bar-name${i === win ? " mc-bar-name--winner" : ""}`}>
                            {opt.name}
                          </span>
                          <span className={`mc-bar-pct${i === win ? " mc-bar-pct--winner" : ""}`}>
                            {Math.round(q.pct[i] * eased)}%
                          </span>
                        </div>
                        <div className="mc-bar-track">
                          <div
                            className={`mc-bar-fill${i === win ? " mc-bar-fill--winner" : ""}`}
                            style={{ width: `${((q.pct[i] / maxPct) * eased * 100).toFixed(2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {revealDone && (
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
                        {!endless && qIndex >= total - 1 ? "See verdict" : "Next question"} →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* SCORE */}
        {screen === "score" && (
          <section className="mc-score-card">
            <div className="mc-score-over">Today&rsquo;s Verdict — {dateLabel}</div>
            <div className="mc-score-big">
              {correctCount}
              <span className="mc-score-denom"> / {total}</span>
            </div>
            <div className="mc-score-correct">correct answers</div>
            <div className="mc-score-verdict">{verdict}</div>

            <div className="mc-symbols">
              {dailyResults.map((r, i) => (
                <div key={i} className={`mc-symbol${r.correct ? " mc-symbol--correct" : " mc-symbol--wrong"}`}>
                  {r.correct ? "✓" : "✗"}
                </div>
              ))}
            </div>

            <div className="mc-stats">
              <div className="mc-stat">
                <div className="mc-stat-label">Streak</div>
                <div className="mc-stat-value">
                  {streak}<span className="mc-stat-unit">days</span>
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
              <button className="mc-btn-ghost" onClick={endlessMode}>
                Endless mode →
              </button>
            </div>
          </section>
        )}

      </main>

      {/* ── Share overlay ── */}
      {shareOpen && (
        <div className="mc-overlay" onClick={() => setShareOpen(false)}>
          <div className="mc-share-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-share-brand">
              <span className="mc-logo-dot" />
              Machine Consensus
            </div>
            <div className="mc-share-edition">
              Edition {editionLabel} · {dateLabel}
            </div>
            <div className="mc-share-scorerow">
              <span className="mc-share-score">{correctCount}</span>
              <span className="mc-share-tag">{verdict}</span>
            </div>
            <div className="mc-share-grid">
              {dailyResults.map((r, i) => (
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
