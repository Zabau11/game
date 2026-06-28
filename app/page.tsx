import { Outguess, type MCQuestion } from "./machine-consensus";
import { getModelNames, getReadyQuestions, publicQuestion } from "@/lib/questions";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  // Edition labels for the current survival run.
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 0);
  const doy = Math.floor((today.getTime() - yearStart.getTime()) / 86400000);
  const dateLabel = `${MON[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const dateShort = `${MON3[today.getMonth()]} ${today.getDate()}`;
  const editionLabel = `No. ${doy}`;

  const readyQuestions = await getReadyQuestions();
  const questions: MCQuestion[] = readyQuestions.map(publicQuestion);
  const models = await getModelNames();

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
