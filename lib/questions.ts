import "server-only";

import { neon } from "@neondatabase/serverless";
import questionsDatabase from "@/data/questions.json";

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
  if (!url) return null;
  return neon(url);
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

function localQuestions(): QuestionRecord[] {
  return questionsDatabase.questions as QuestionRecord[];
}

export async function getReadyQuestions(): Promise<QuestionRecord[]> {
  const sql = getSql();
  if (!sql) return localQuestions().filter((question) => question.status === "ready");

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
  if (!sql) {
    return localQuestions().find((question) => question.id === id && question.status === "ready") ?? null;
  }

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
