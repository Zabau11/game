import questionsDatabase from "@/data/questions.json";
import { Outguess, type MCQuestion } from "./machine-consensus";

const MON = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const MON3 = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const PROVIDER_NAMES: Record<string, string> = {
  gemini: "Gemini",
  claude: "Claude",
  kimi: "Kimi",
  mistral: "Mistral",
  grok: "Grok",
  llama: "Llama",
};

function providerName(p: string) {
  return PROVIDER_NAMES[p] || p.charAt(0).toUpperCase() + p.slice(1);
}

export default function Home() {
  const all = questionsDatabase.questions;

  // Edition labels for the current survival run.
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 0);
  const doy = Math.floor((today.getTime() - yearStart.getTime()) / 86400000);
  const dateLabel = `${MON[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const dateShort = `${MON3[today.getMonth()]} ${today.getDate()}`;
  const editionLabel = `No. ${doy}`;

  const questions: MCQuestion[] = all.filter((q) =>
    q.status === "ready" && q.modelResults.length > 0
  ).map((q) => {
    const optionIds = q.options.map((o) => o.id);
    const winnerIndex = Math.max(0, optionIds.indexOf(q.winner));

    // Find the model that broke hardest from the consensus winner.
    let dissentModel: (typeof q.modelResults)[number] | null = null;
    let dissentOptionId = "";
    let dissentProb = -1;
    for (const mr of q.modelResults) {
      const probs = mr.probabilities as Record<string, number>;
      let topId = optionIds[0];
      let topP = -1;
      for (const oid of optionIds) {
        const p = probs[oid] ?? 0;
        if (p > topP) {
          topP = p;
          topId = oid;
        }
      }
      if (topId !== q.winner && topP > dissentProb) {
        dissentProb = topP;
        dissentModel = mr;
        dissentOptionId = topId;
      }
    }

    let disagreement: string;
    if (dissentModel) {
      const optLabel =
        q.options.find((o) => o.id === dissentOptionId)?.label ?? "";
      disagreement = `${providerName(dissentModel.provider)} broke from the pack, ranking ${optLabel} first.`;
    } else {
      disagreement = "The models reached rare unanimity on this one.";
    }

    return {
      prompt: q.question,
      options: q.options.map((o) => ({
        name: o.label,
        mark: q.category.toUpperCase(),
      })),
      pct: q.options.map((o) => o.percentage),
      winnerIndex,
      explanation: q.explanation,
      disagreement,
    };
  });

  const models = all[0].modelResults.map((mr) =>
    providerName(mr.provider).toUpperCase(),
  );

  return (
    <Outguess
      questions={questions}
      models={models}
      dateLabel={dateLabel}
      dateShort={dateShort}
      editionLabel={editionLabel}
    />
  );
}
