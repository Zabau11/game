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
  showShortcuts?: boolean;
};

type Screen = "landing" | "playing" | "score";
type Phase = "predict" | "locked" | "reveal";

const LETTERS = ["A", "B", "C", "D"];
const ACCENTS = ["#F04A2E", "#26C2CE", "#F2A93B", "#67C24A"];
const VERDICTS = [
  "The machine is unknowable to you.",
  "You think like a human.",
  "The machine remains a mystery.",
  "A respectful disagreement.",
  "You understand the machine.",
  "You ARE the machine.",
];
const BEATS = [6, 19, 43, 68, 85, 97];

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
  showShortcuts = true,
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

  const rafRef = useRef<number | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qRef = useRef<HTMLHeadingElement | null>(null);

  const isReduced = useCallback(
    () => reduced || forceReducedMotion,
    [reduced, forceReducedMotion],
  );

  const clearTimers = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
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
    };
  }, [clearTimers]);

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

  // keyboard — keep a fresh handler in a ref so the listener reads latest state
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
        if (n >= 1 && n <= 4) {
          e.preventDefault();
          choose(n - 1);
        }
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

  // question flip animation on question / screen change
  useEffect(() => {
    if (screen !== "playing" || isReduced()) return;
    const el = qRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "mcFlip .5s cubic-bezier(.2,.8,.2,1)";
  }, [qIndex, screen, isReduced]);

  // ----- derived values -----
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

  return (
    <div className="mc-root">
      <header className="mc-header">
        <div className="mc-brand">
          <span className="mc-logo-dot" />
          <span className="mc-wordmark">MACHINE CONSENSUS</span>
        </div>

        {screen === "playing" ? (
          <div className="mc-head-meta">
            <div className="mc-pips">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className="mc-pip"
                  style={{
                    background:
                      i < answered
                        ? "#F1ECDF"
                        : i === cur
                          ? "#F2A93B"
                          : "rgba(241,236,223,0.2)",
                  }}
                />
              ))}
            </div>
            <span className="mc-counter">
              {pad2(qIndex + 1)} / {totalLabel}
            </span>
          </div>
        ) : (
          <span className="mc-edition">
            EDITION {editionLabel} · {dateShort}
          </span>
        )}
      </header>

      <main className="mc-main">
        {/* ============ LANDING ============ */}
        {screen === "landing" && (
          <section className="mc-section mc-landing">
            <div className="mc-landing-mid">
              <div
                className="mc-kicker"
                style={{ marginBottom: "clamp(12px,2.4vh,24px)" }}
              >
                DAILY EDITION — {dateLabel}
              </div>
              <h1
                className="mc-display"
                style={{ fontSize: "clamp(34px,7.4vh,86px)", maxWidth: "15ch" }}
              >
                Can you predict what{" "}
                <span className="accent">the machines</span> agree on?
              </h1>
              <p
                className="mc-lede"
                style={{ margin: "clamp(16px,2.6vh,26px) 0 0" }}
              >
                Five questions. Five hidden machine votes. Guess which answer the
                AI models ranked first — then watch the electorate reveal its
                tally.
              </p>
              <div className="mc-cta-row">
                <button className="mc-btn mc-btn--light mc-hx7 mc-play" onClick={start}>
                  Play today&rsquo;s five<span className="mc-arrow">→</span>
                </button>
                <span className="mc-hint">5 QUESTIONS · PRESS ENTER</span>
              </div>
            </div>
            <div className="mc-poll">
              <span className="mc-poll-label">POLLING —</span>
              {models.map((model) => (
                <span key={model} className="mc-chip">
                  {model}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ============ PLAYING ============ */}
        {screen === "playing" && (
          <section className="mc-section mc-playing">
            <div className="mc-topbar">
              {inChoose && (
                <div className="mc-phase mc-phase--predict">
                  PREDICT THE AI FAVORITE
                </div>
              )}
              {inReveal && (
                <div className="mc-phase mc-phase--reveal">
                  THE MACHINE HAS VOTED
                </div>
              )}
              {phase === "predict" && !isReduced() && (
                <div className="mc-needle">
                  <div className="mc-needle-sweep" />
                </div>
              )}
            </div>

            <h1
              ref={qRef}
              className="mc-question"
              style={{
                fontSize: inReveal
                  ? "clamp(22px,3.6vh,40px)"
                  : "clamp(28px,5.4vh,62px)",
              }}
            >
              {q.prompt}
            </h1>

            {/* choose / locked */}
            {inChoose && (
              <>
                <div className="mc-cards">
                  {q.options.map((opt, i) => {
                    const accent = ACCENTS[i];
                    const isPicked = picked === i;
                    const lockStyle: React.CSSProperties = {};
                    if (phase === "locked") {
                      if (isPicked) {
                        lockStyle.background = accent;
                        lockStyle.color = "#15130E";
                        lockStyle.transform = "translateY(-8px)";
                        lockStyle.borderColor = accent;
                        lockStyle.pointerEvents = "none";
                      } else {
                        lockStyle.opacity = 0.26;
                        lockStyle.filter = "grayscale(.6)";
                        lockStyle.pointerEvents = "none";
                      }
                    }
                    return (
                      <button
                        key={i}
                        className={`mc-card${phase === "locked" ? " mc-card--locked" : ""}`}
                        onClick={() => choose(i)}
                        style={
                          {
                            "--accent": accent,
                            ...lockStyle,
                          } as React.CSSProperties
                        }
                      >
                        <div className="mc-card-top">
                          <span className="mc-card-letter">{LETTERS[i]}</span>
                          <span className="mc-card-shortcut">{i + 1}</span>
                        </div>
                        <div>
                          <div className="mc-card-name">{opt.name}</div>
                          <div className="mc-card-mark">{opt.mark}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {showShortcuts && (
                  <div className="mc-keys">
                    KEYS 1–4 TO PREDICT · ENTER ADVANCES
                  </div>
                )}
              </>
            )}

            {/* reveal */}
            {inReveal && (
              <div className="mc-reveal">
                <div className="mc-bars">
                  {q.options.map((opt, i) => {
                    const accent = ACCENTS[i];
                    const isPicked = picked === i;
                    const isWinner = i === win;
                    return (
                      <div
                        key={i}
                        style={{ ["--accent" as string]: accent } as React.CSSProperties}
                      >
                        <div className="mc-bar-head">
                          <div className="mc-bar-labels">
                            <span
                              className="mc-bar-name"
                              style={
                                isWinner || isPicked ? undefined : { opacity: 0.55 }
                              }
                            >
                              {opt.name}
                            </span>
                            {isPicked && (
                              <span
                                className="mc-tag"
                                style={
                                  pickedCorrect
                                    ? { color: "#67C24A", borderColor: "#67C24A" }
                                    : { color: "#F04A2E", borderColor: "#F04A2E" }
                                }
                              >
                                {pickedCorrect ? "YOUR PICK ✓" : "YOUR PICK ✗"}
                              </span>
                            )}
                            {isWinner && (
                              <span className="mc-tag mc-tag--consensus">
                                CONSENSUS
                              </span>
                            )}
                          </div>
                          <span className="mc-bar-pct">
                            {Math.round(q.pct[i] * eased)}
                            <span className="sign">%</span>
                          </span>
                        </div>
                        <div className="mc-bar-track">
                          <div
                            className="mc-bar-fill"
                            style={{
                              width: `${((q.pct[i] / maxPct) * eased * 100).toFixed(2)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {revealDone && (
                  <div className="mc-explain">
                    <div
                      className="mc-result-line"
                      style={{ color: pickedCorrect ? "#67C24A" : "#F04A2E" }}
                    >
                      {pickedCorrect ? "✓" : "✗"}{" "}
                      {pickedCorrect
                        ? "YOU READ THE MACHINE"
                        : "THE MACHINE DISAGREED"}
                    </div>
                    <div className="mc-winrow">
                      <span className="mc-winname">{q.options[win].name}</span>
                      <span
                        className="mc-winpct"
                        style={{ color: ACCENTS[win] }}
                      >
                        {q.pct[win]}%
                      </span>
                    </div>
                    <p className="mc-explain-text">{q.explanation}</p>
                    <div className="mc-dissent">
                      <span className="mc-dissent-tag">DISSENT</span>
                      <p className="mc-dissent-text">{q.disagreement}</p>
                    </div>
                    <button className="mc-btn mc-btn--light mc-hx6 mc-next" onClick={next}>
                      {!endless && qIndex >= total - 1
                        ? "See verdict"
                        : "Next question"}
                      <span className="mc-arrow">→</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ============ SCORE ============ */}
        {screen === "score" && (
          <section className="mc-section mc-score">
            <div className="mc-kicker">TODAY&rsquo;S VERDICT — {dateLabel}</div>
            <div className="mc-score-row">
              <div className="mc-score-num">
                {correctCount} / {total}
              </div>
              <div className="mc-verdict-wrap">
                <div className="mc-verdict">{verdict}</div>
              </div>
            </div>

            <div className="mc-symbols">
              {dailyResults.map((r, i) => (
                <div
                  key={i}
                  className="mc-symbol"
                  style={
                    r.correct
                      ? {
                          background: "#67C24A",
                          color: "#15130E",
                          borderColor: "#67C24A",
                        }
                      : {
                          background: "transparent",
                          color: "#F04A2E",
                          borderColor: "rgba(240,74,46,0.7)",
                        }
                  }
                >
                  {r.correct ? "✓" : "✗"}
                </div>
              ))}
            </div>

            <div className="mc-stats">
              <div>
                <div className="mc-stat-label">CURRENT STREAK</div>
                <div className="mc-stat-num">
                  {streak}
                  <span className="mc-stat-unit">DAYS</span>
                </div>
              </div>
              <div>
                <div className="mc-stat-label">YOU BEAT</div>
                <div className="mc-stat-num mc-stat-num--amber">{beatPct}%</div>
                <div className="mc-stat-sub">OF HUMAN PLAYERS TODAY</div>
              </div>
            </div>

            <div className="mc-actions">
              <button
                className="mc-btn mc-btn--light mc-hy3 mc-action"
                onClick={() => {
                  setShareOpen(true);
                  setCopied(false);
                }}
              >
                Share result
              </button>
              <button
                className="mc-btn mc-btn--ghost mc-hy3 mc-action"
                onClick={endlessMode}
              >
                Endless mode<span className="mc-arrow">→</span>
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ============ SHARE OVERLAY ============ */}
      {shareOpen && (
        <div className="mc-overlay" onClick={() => setShareOpen(false)}>
          <div
            className="mc-share-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mc-share-stripe">
              <span style={{ background: "#F04A2E" }} />
              <span style={{ background: "#26C2CE" }} />
              <span style={{ background: "#F2A93B" }} />
              <span style={{ background: "#67C24A" }} />
            </div>
            <div className="mc-share-body">
              <div className="mc-share-brand">
                <span className="dot" />
                <span className="name">MACHINE CONSENSUS</span>
              </div>
              <div className="mc-share-edition">
                EDITION {editionLabel} · {dateLabel}
              </div>
              <div className="mc-share-scorerow">
                <span className="mc-share-score">
                  {correctCount} / {total}
                </span>
                <span className="mc-share-tag">{verdict}</span>
              </div>
              <div className="mc-share-grid">
                {dailyResults.map((r, i) => (
                  <div
                    key={i}
                    className="mc-share-cell"
                    style={
                      r.correct
                        ? {
                            background: "#67C24A",
                            color: "#15130E",
                            borderColor: "#67C24A",
                          }
                        : {
                            background: "transparent",
                            color: "#F04A2E",
                            borderColor: "rgba(240,74,46,0.7)",
                          }
                    }
                  >
                    {r.correct ? "✓" : "✗"}
                  </div>
                ))}
              </div>
              <div className="mc-share-foot">
                NO ANSWERS REVEALED · MACHINECONSENSUS.GAME
              </div>
              <div className="mc-share-actions">
                <button
                  className="mc-btn mc-btn--light mc-share-copy"
                  onClick={copyShare}
                >
                  {copied ? "COPIED ✓" : "Copy result"}
                </button>
                <button
                  className="mc-btn mc-btn--ghost mc-share-close"
                  onClick={() => setShareOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
