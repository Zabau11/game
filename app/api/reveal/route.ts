import { NextRequest, NextResponse } from "next/server";
import {
  consumeQuestionRunAnswer,
  getQuestionById,
  getQuestionRun,
  publicQuestion,
  readRunToken,
  revealQuestion,
} from "@/lib/questions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const questionId =
    body && typeof body === "object" && "questionId" in body
      ? String(body.questionId)
      : "";
  const pickedOptionId =
    body && typeof body === "object" && "pickedOptionId" in body
      ? String(body.pickedOptionId)
      : "";
  const runToken =
    body && typeof body === "object" && "runToken" in body
      ? String(body.runToken)
      : "";

  if (!questionId || !pickedOptionId || !runToken) {
    return NextResponse.json(
      { error: "questionId, pickedOptionId, and runToken are required." },
      { status: 400 },
    );
  }

  const runId = readRunToken(runToken);
  if (!runId) {
    return NextResponse.json(
      { error: "This run is no longer valid. Start a new run." },
      { status: 403 },
    );
  }

  const run = await getQuestionRun(runId);
  if (!run) {
    return NextResponse.json(
      { error: "This run has already ended. Start a new run." },
      { status: 403 },
    );
  }

  if (run.deck[run.currentIndex] !== questionId) {
    return NextResponse.json(
      { error: "This question is not active for the current run." },
      { status: 403 },
    );
  }

  const question = await getQuestionById(questionId);
  if (!question) {
    return NextResponse.json(
      { error: "Question not found." },
      { status: 404 },
    );
  }

  const validOption = question.options.some((option) => option.id === pickedOptionId);
  if (!validOption) {
    return NextResponse.json(
      { error: "Picked option does not belong to this question." },
      { status: 400 },
    );
  }

  const reveal = revealQuestion(question, pickedOptionId);
  const consumed = await consumeQuestionRunAnswer(run, reveal.correct);
  if (!consumed) {
    return NextResponse.json(
      { error: "This round was already answered. Start a new run." },
      { status: 409 },
    );
  }

  const nextQuestionId = reveal.correct ? run.deck[run.currentIndex + 1] : "";
  const nextQuestion = nextQuestionId ? await getQuestionById(nextQuestionId) : null;

  return NextResponse.json({
    ...reveal,
    nextRunToken: nextQuestion ? runToken : "",
    nextQuestion: nextQuestion ? publicQuestion(nextQuestion) : null,
  });
}
