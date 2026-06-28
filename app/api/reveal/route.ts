import { NextRequest, NextResponse } from "next/server";
import { getQuestionById, revealQuestion } from "@/lib/questions";

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

  if (!questionId || !pickedOptionId) {
    return NextResponse.json(
      { error: "questionId and pickedOptionId are required." },
      { status: 400 },
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

  return NextResponse.json(revealQuestion(question, pickedOptionId));
}
