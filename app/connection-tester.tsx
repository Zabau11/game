"use client";

import { useState } from "react";

type ModelName = "gemini" | "claude" | "kimi" | "mistral";

type TestResult = {
  ok: boolean;
  message: string;
  response?: string;
  model?: string;
  latencyMs?: number;
  hint?: string;
  note?: string;
};

const models: Array<{
  id: ModelName;
  name: string;
  detail: string;
}> = [
  {
    id: "gemini",
    name: "Gemini 2.5 Flash",
    detail: "Google · Express mode",
  },
  {
    id: "claude",
    name: "Claude Haiku 4.5",
    detail: "Anthropic · Direct API",
  },
  {
    id: "kimi",
    name: "Kimi K2 Thinking",
    detail: "Moonshot AI · Managed open model",
  },
  {
    id: "mistral",
    name: "Mistral Small",
    detail: "Mistral AI · Direct API",
  },
];

export function ConnectionTester() {
  const [results, setResults] = useState<
    Partial<Record<ModelName, TestResult>>
  >({});
  const [testing, setTesting] = useState<ModelName | "all" | null>(null);

  async function runTest(model: ModelName) {
    const response = await fetch(`/api/test-vertex?model=${model}`, {
      method: "POST",
    });
    return (await response.json()) as TestResult;
  }

  async function testOne(model: ModelName) {
    setTesting(model);
    setResults((current) => {
      const next = { ...current };
      delete next[model];
      return next;
    });

    try {
      const result = await runTest(model);
      setResults((current) => ({ ...current, [model]: result }));
    } catch {
      setResults((current) => ({
        ...current,
        [model]: {
          ok: false,
          message: "The browser could not reach the local test endpoint.",
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  async function testAll() {
    setTesting("all");
    setResults({});

    const settled = await Promise.all(
      models.map(async ({ id }) => {
        try {
          return [id, await runTest(id)] as const;
        } catch {
          return [
            id,
            {
              ok: false,
              message: "The browser could not reach the local test endpoint.",
            },
          ] as const;
        }
      }),
    );

    setResults(Object.fromEntries(settled));
    setTesting(null);
  }

  return (
    <div className="tester">
      <button className="test-all" onClick={testAll} disabled={testing !== null}>
        {testing === "all" ? (
          <>
            <span className="spinner" /> Testing model panel…
          </>
        ) : (
          "Test all available models"
        )}
      </button>

      <div className="model-list">
        {models.map((model) => {
          const result = results[model.id];
          const isTesting =
            testing === model.id || (testing === "all" && !result);

          return (
            <article className="model-card" key={model.id}>
              <div className="model-topline">
                <div>
                  <h2>{model.name}</h2>
                  <p>{model.detail}</p>
                </div>
                <button
                  className="test-one"
                  onClick={() => testOne(model.id)}
                  disabled={testing !== null}
                >
                  {isTesting ? "Testing…" : "Test"}
                </button>
              </div>

              {result && (
                <div
                  className={`result compact ${result.ok ? "success" : "failure"}`}
                >
                  <div className="result-heading">
                    <span>{result.ok ? "✓" : "!"}</span>
                    <div>
                      <small>{result.ok ? "Connected" : "Unavailable"}</small>
                      <h3>{result.message}</h3>
                    </div>
                  </div>

                  {result.response && <blockquote>“{result.response}”</blockquote>}
                  {result.hint && <p className="hint">{result.hint}</p>}
                  {result.note && <p className="note">{result.note}</p>}

                  {result.latencyMs !== undefined && (
                    <div className="meta">
                      <span>{result.model}</span>
                      <span>{result.latencyMs} ms</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
