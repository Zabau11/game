"use client";

import { useState } from "react";

type GameQuestion = {
  id: string;
  question: string;
  winner: string;
  options: Array<{
    id: string;
    label: string;
  }>;
};

type GameState =
  | { status: "playing"; questionIndex: number }
  | { status: "lost"; questionIndex: number; selectedId: string }
  | { status: "won" };

export function ConsensusGame({
  questions,
}: {
  questions: GameQuestion[];
}) {
  const [game, setGame] = useState<GameState>({
    status: "playing",
    questionIndex: 0,
  });

  function restart() {
    setGame({ status: "playing", questionIndex: 0 });
  }

  if (game.status === "won") {
    return (
      <section className="game-card end-card" aria-live="polite">
        <p className="kicker">Perfect run</p>
        <h1>You think like the machine.</h1>
        <p className="supporting-copy">
          You predicted the AI consensus for all {questions.length} questions.
        </p>
        <button className="primary-action" onClick={restart}>
          Play again
        </button>
      </section>
    );
  }

  const questionIndex = game.questionIndex;
  const question = questions[questionIndex];
  const correctOption = question.options.find(
    (option) => option.id === question.winner,
  );

  if (game.status === "lost") {
    const selectedOption = question.options.find(
      (option) => option.id === game.selectedId,
    );

    return (
      <section className="game-card end-card" aria-live="polite">
        <p className="kicker danger">Game over</p>
        <h1>AI disagreed.</h1>
        <p className="supporting-copy">
          You chose <strong>{selectedOption?.label}</strong>. The consensus
          winner was <strong>{correctOption?.label}</strong>.
        </p>
        <p className="score">
          Score: {questionIndex} / {questions.length}
        </p>
        <button className="primary-action" onClick={restart}>
          Try again
        </button>
      </section>
    );
  }

  function chooseAnswer(optionId: string) {
    if (optionId !== question.winner) {
      setGame({
        status: "lost",
        questionIndex,
        selectedId: optionId,
      });
      return;
    }

    if (questionIndex === questions.length - 1) {
      setGame({ status: "won" });
      return;
    }

    setGame({
      status: "playing",
      questionIndex: questionIndex + 1,
    });
  }

  return (
    <section className="game-card" aria-labelledby="question-heading">
      <header className="game-header">
        <span>AI Consensus</span>
        <span>
          {questionIndex + 1} / {questions.length}
        </span>
      </header>

      <div
        className="progress-track"
        aria-label={`Question ${questionIndex + 1} of ${questions.length}`}
      >
        <span
          style={{
            width: `${((questionIndex + 1) / questions.length) * 100}%`,
          }}
        />
      </div>

      <p className="prompt">Which answer did the models rank highest?</p>
      <h1 id="question-heading">{question.question}</h1>

      <div className="answers">
        {question.options.map((option, index) => (
          <button
            className="answer"
            key={option.id}
            onClick={() => chooseAnswer(option.id)}
          >
            <span>{String.fromCharCode(65 + index)}</span>
            {option.label}
          </button>
        ))}
      </div>

      <p className="rule">One wrong answer ends the run.</p>
    </section>
  );
}
