import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envPath = path.join(root, ".env");
const databasePath = path.join(root, "data", "questions.json");
const modelIds = {
  gemini: "gemini-2.5-flash",
  claude: "claude-haiku-4-5",
  kimi: "moonshotai/kimi-k2-thinking-maas",
  mistral: "mistral-small-latest",
};

async function loadEnv() {
  const text = await fs.readFile(envPath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function promptFor(question) {
  const randomizedOptions = shuffled(question.options);
  return {
    randomizedOptions,
    text: `Estimate which answer best fits this playful subjective question.

Question: ${question.question}

Options:
${randomizedOptions.map((option) => `- ${option.id}: ${option.label}`).join("\n")}

Rules:
- Assign an integer probability from 0 to 100 to every option.
- All probabilities must total exactly 100.
- Use the option IDs exactly as provided.
- Judge only the question provided.
- Give one concise sentence explaining the overall distribution.
- Return only valid JSON matching this shape:
{"probabilities":{"option-id":25},"explanation":"One concise sentence."}`,
  };
}

function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = trimmed.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < trimmed.length; index += 1) {
        const character = trimmed[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{") depth += 1;
        else if (character === "}") {
          depth -= 1;
          if (depth === 0) {
            return JSON.parse(trimmed.slice(start, index + 1));
          }
        }
      }
    }
    throw new Error("Model response did not contain valid JSON.");
  }
}

function normalizeDistribution(probabilities, optionIds) {
  const values = optionIds.map((id) => {
    const numeric =
      typeof probabilities?.[id] === "string"
        ? Number.parseFloat(probabilities[id])
        : Number(probabilities?.[id]);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error(`Invalid probability for ${id}.`);
    }
    return numeric;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Probability total must be positive.");

  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < remainder; index += 1) {
    rounded[order[index % order.length].index] += 1;
  }

  return Object.fromEntries(optionIds.map((id, index) => [id, rounded[index]]));
}

function validateResult(raw, question) {
  if (!raw || typeof raw !== "object") throw new Error("Empty result.");
  const optionIds = question.options.map((option) => option.id);
  const source = raw.probabilities ?? {};
  const normalizeKey = (value) =>
    String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sourceEntries = Object.entries(source);
  const mapped = Object.fromEntries(
    question.options.map((option) => {
      const aliases = new Set([
        normalizeKey(option.id),
        normalizeKey(option.label),
      ]);
      const match = sourceEntries.find(([key]) => aliases.has(normalizeKey(key)));
      return [option.id, match?.[1]];
    }),
  );
  const missingOptions = question.options
    .filter((option) => mapped[option.id] === undefined)
    .map((option) => option.id);
  if (missingOptions.length) {
    throw new Error(
      `Missing probabilities for ${missingOptions.join(", ")}; returned keys: ${sourceEntries
        .map(([key]) => key)
        .join(", ")}`,
    );
  }
  const probabilities = normalizeDistribution(mapped, optionIds);
  const explanation =
    typeof raw.explanation === "string" && raw.explanation.trim()
      ? raw.explanation.trim()
      : "The distribution reflects the model's relative preference among the four options.";
  return { probabilities, explanation };
}

async function fetchJson(url, init, label, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.message ||
          text.slice(0, 500) ||
          `HTTP ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
          continue;
        }
        throw new Error(`${label}: ${message}`);
      }

      return data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  throw lastError;
}

async function callGemini(prompt) {
  const key = process.env.API_KEY;
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${modelIds.gemini}:generateContent?key=${encodeURIComponent(key)}`;
  const data = await fetchJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
    "Gemini",
  );
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
}

async function callClaude(prompt) {
  const data = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelIds.claude,
        max_tokens: 500,
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    "Claude",
  );
  return data.content
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("") ?? "";
}

async function callKimi(prompt) {
  const projectId = process.env.PROJECT_ID;
  const key = process.env.API_KEY;
  const url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/global/endpoints/openapi/chat/completions?key=${encodeURIComponent(key)}`;
  const data = await fetchJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelIds.kimi,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8000,
        temperature: 0.35,
        stream: false,
      }),
    },
    "Kimi",
  );
  const message = data.choices?.[0]?.message;
  return message?.content || message?.reasoning_content || "";
}

async function callMistral(prompt) {
  const data = await fetchJson(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelIds.mistral,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.35,
        response_format: { type: "json_object" },
        stream: false,
      }),
    },
    "Mistral",
  );
  return data.choices?.[0]?.message?.content ?? "";
}

const callers = {
  gemini: callGemini,
  claude: callClaude,
  kimi: callKimi,
  mistral: callMistral,
};

function aggregate(question) {
  const optionIds = question.options.map((option) => option.id);
  const totals = Object.fromEntries(optionIds.map((id) => [id, 0]));

  for (const result of question.modelResults) {
    for (const id of optionIds) totals[id] += result.probabilities[id];
  }

  const averages = Object.fromEntries(
    optionIds.map((id) => [id, totals[id] / question.modelResults.length]),
  );
  const percentages = normalizeDistribution(averages, optionIds);
  const winner = [...optionIds].sort(
    (left, right) => percentages[right] - percentages[left],
  )[0];

  for (const option of question.options) {
    option.percentage = percentages[option.id];
  }

  question.winner = winner;
  question.explanation = question.modelResults
    .map((result) => result.explanation)
    .sort((left, right) => left.length - right.length)[0];
  question.status = "ready";
  question.generatedAt = new Date().toISOString();
}

async function save(database) {
  database.updatedAt = new Date().toISOString();
  await fs.writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`);
}

async function main() {
  await loadEnv();
  const required = [
    "API_KEY",
    "PROJECT_ID",
    "ANTHROPIC_API_KEY",
    "MISTRAL_API_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

  const database = JSON.parse(await fs.readFile(databasePath, "utf8"));
  const requestedQuestionId = process.argv
    .find((argument) => argument.startsWith("--question="))
    ?.split("=")[1];
  const questions = requestedQuestionId
    ? database.questions.filter((question) => question.id === requestedQuestionId)
    : database.questions;

  if (!questions.length) throw new Error("No matching questions found.");

  for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
    const question = questions[questionIndex];
    question.modelResults ||= [];
    const completed = new Set(question.modelResults.map((result) => result.provider));
    const prompt = promptFor(question).text;

    console.log(`[${questionIndex + 1}/${questions.length}] ${question.id}`);

    for (const provider of Object.keys(callers)) {
      if (completed.has(provider)) {
        console.log(`  ${provider}: already complete`);
        continue;
      }

      let completedResult = false;
      let lastError;
      for (let attempt = 1; attempt <= 3 && !completedResult; attempt += 1) {
        try {
          const startedAt = Date.now();
          const retryPrompt =
            attempt === 1
              ? prompt
              : `${prompt}\n\nImportant: emit the final JSON object now, with no analysis before or after it.`;
          const text = await callers[provider](retryPrompt);
          const result = validateResult(extractJson(text), question);
          question.modelResults.push({
            provider,
            model: modelIds[provider],
            probabilities: result.probabilities,
            explanation: result.explanation,
            latencyMs: Date.now() - startedAt,
          });
          console.log(
            `  ${provider}: complete${attempt > 1 ? ` (attempt ${attempt})` : ""}`,
          );
          await save(database);
          completedResult = true;
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
            console.log(`  ${provider}: retrying structured output`);
          }
        }
      }
      if (!completedResult) {
        console.error(`  ${provider}: ${lastError.message}`);
        await save(database);
        throw lastError;
      }
    }

    if (question.modelResults.length === Object.keys(callers).length) {
      aggregate(question);
      await save(database);
      console.log(`  consensus: ${question.winner}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
