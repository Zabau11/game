import questionsDatabase from "@/data/questions.json";
import { ConsensusGame } from "./consensus-game";

export default function Home() {
  const questions = questionsDatabase.questions.map((question) => ({
    id: question.id,
    question: question.question,
    winner: question.winner as string,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
    })),
  }));

  return (
    <main>
      <ConsensusGame questions={questions} />
    </main>
  );
}
