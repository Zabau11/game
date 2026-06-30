import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type QuestionOption = {
  id: string;
  label: string;
  percentage?: number;
};

export type ModelResult = {
  provider: string;
  model: string;
  probabilities: Record<string, number>;
  explanation: string;
  latencyMs?: number;
};

export type QuestionRecord = {
  id: string;
  category: string;
  question: string;
  options: QuestionOption[];
  status: string;
  winner: string;
  explanation: string;
  modelResults: ModelResult[];
};

export type PublicQuestion = {
  id: string;
  prompt: string;
  category: string;
  options: Array<{
    id: string;
    name: string;
    mark: string;
  }>;
};

export type RevealResult = {
  questionId: string;
  pickedOptionId: string;
  winnerId: string;
  correct: boolean;
  percentages: Record<string, number>;
  explanation: string;
  disagreement: string;
};

export type QuestionRun = {
  token: string;
  questions: PublicQuestion[];
  total: number;
};

export type ActiveQuestionRun = {
  id: string;
  deck: string[];
  currentIndex: number;
};

const PROVIDER_NAMES: Record<string, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT",
  mistral: "Mistral",
  grok: "Grok",
  llama: "Llama",
};

function providerName(provider: string) {
  return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error("Missing DATABASE_URL or POSTGRES_URL.");
  return neon(url);
}

let ensuredRunTable = false;

async function ensureRunTable() {
  if (ensuredRunTable) return;
  const sql = getSql();
  await sql`
    create table if not exists question_runs (
      id text primary key,
      deck jsonb not null,
      current_index integer not null default 0,
      completed boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '2 hours'
    )
  `;
  await sql`
    create index if not exists question_runs_expires_idx
      on question_runs (expires_at)
  `;
  ensuredRunTable = true;
}

function normalizeQuestion(row: Record<string, unknown>): QuestionRecord {
  return {
    id: String(row.id),
    category: String(row.category),
    question: String(row.question),
    options: row.options as QuestionOption[],
    status: String(row.status),
    winner: String(row.winner),
    explanation: String(row.explanation),
    modelResults: row.model_results as ModelResult[],
  };
}

export async function getReadyQuestions(): Promise<QuestionRecord[]> {
  const sql = getSql();

  const rows = await sql`
    select id, category, question, options, status, winner, explanation, model_results
    from questions
    where status = 'ready'
    order by sort_order asc, id asc
  `;

  return rows.map((row) => normalizeQuestion(row));
}

export async function getQuestionById(id: string): Promise<QuestionRecord | null> {
  const sql = getSql();

  const rows = await sql`
    select id, category, question, options, status, winner, explanation, model_results
    from questions
    where id = ${id} and status = 'ready'
    limit 1
  `;

  return rows[0] ? normalizeQuestion(rows[0]) : null;
}

export function publicQuestion(question: QuestionRecord): PublicQuestion {
  return {
    id: question.id,
    prompt: question.question,
    category: question.category,
    options: question.options.map((option) => ({
      id: option.id,
      name: option.label,
      mark: question.category.toUpperCase(),
    })),
  };
}

export function revealQuestion(question: QuestionRecord, pickedOptionId: string): RevealResult {
  const optionIds = question.options.map((option) => option.id);
  const percentages = Object.fromEntries(
    question.options.map((option) => [option.id, Number(option.percentage ?? 0)]),
  );

  let dissentModel: ModelResult | null = null;
  let dissentOptionId = "";
  let dissentProb = -1;

  for (const result of question.modelResults) {
    let topId = optionIds[0];
    let topProbability = -1;
    for (const optionId of optionIds) {
      const probability = result.probabilities[optionId] ?? 0;
      if (probability > topProbability) {
        topProbability = probability;
        topId = optionId;
      }
    }
    if (topId !== question.winner && topProbability > dissentProb) {
      dissentProb = topProbability;
      dissentModel = result;
      dissentOptionId = topId;
    }
  }

  const dissentOptionLabel =
    question.options.find((option) => option.id === dissentOptionId)?.label ?? "";

  return {
    questionId: question.id,
    pickedOptionId,
    winnerId: question.winner,
    correct: pickedOptionId === question.winner,
    percentages,
    explanation: question.explanation,
    disagreement: dissentModel
      ? `${providerName(dissentModel.provider)} broke from the pack, ranking ${dissentOptionLabel} first.`
      : "The models reached rare unanimity on this one.",
  };
}

export async function getModelNames() {
  const questions = await getReadyQuestions();
  const firstQuestion = questions[0];
  if (!firstQuestion) return [];
  return firstQuestion.modelResults.map((result) =>
    providerName(result.provider).toUpperCase(),
  );
}

function tokenSecret() {
  const secret = process.env.RUN_TOKEN_SECRET || databaseUrl();
  if (!secret) throw new Error("Missing RUN_TOKEN_SECRET or database URL.");
  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

function createRunToken(runId: string) {
  return `${runId}.${signPayload(runId)}`;
}

export function readRunToken(token: string): string | null {
  const [runId, signature] = token.split(".");
  if (!runId || !signature) return null;

  const expected = signPayload(runId);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  return runId;
}

function shuffleRecords<T>(items: T[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function createQuestionRun(limit = 10): Promise<QuestionRun> {
  await ensureRunTable();
  const readyQuestions = shuffleRecords(await getReadyQuestions()).slice(0, limit);
  const deck = readyQuestions.map((question) => question.id);
  if (!readyQuestions.length) {
    return { token: "", questions: [], total: 0 };
  }

  const runId = randomUUID();
  const sql = getSql();
  await sql`delete from question_runs where expires_at < now()`;
  await sql`
    insert into question_runs (id, deck)
    values (${runId}, ${JSON.stringify(deck)})
  `;

  return {
    token: createRunToken(runId),
    questions: [publicQuestion(readyQuestions[0])],
    total: readyQuestions.length,
  };
}

export async function getQuestionRun(runId: string): Promise<ActiveQuestionRun | null> {
  await ensureRunTable();
  const sql = getSql();
  const rows = await sql`
    select id, deck, current_index
    from question_runs
    where id = ${runId}
      and completed = false
      and expires_at > now()
    limit 1
  `;

  if (!rows[0]) return null;
  const deck = rows[0].deck as string[];
  const currentIndex = Number(rows[0].current_index);
  if (!Array.isArray(deck) || !Number.isInteger(currentIndex) || currentIndex < 0) {
    return null;
  }

  return { id: String(rows[0].id), deck, currentIndex };
}

export async function consumeQuestionRunAnswer(
  run: ActiveQuestionRun,
  correct: boolean,
): Promise<boolean> {
  const hasNextQuestion = correct && run.currentIndex + 1 < run.deck.length;
  const sql = getSql();
  const rows = await sql`
    update question_runs
    set
      current_index = ${hasNextQuestion ? run.currentIndex + 1 : run.currentIndex},
      completed = ${!hasNextQuestion},
      updated_at = now()
    where id = ${run.id}
      and current_index = ${run.currentIndex}
      and completed = false
      and expires_at > now()
    returning id
  `;

  return rows.length > 0;
}
