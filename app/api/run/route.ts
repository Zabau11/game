import { NextResponse } from "next/server";
import { createQuestionRun } from "@/lib/questions";

export const runtime = "nodejs";

export async function POST() {
  const run = await createQuestionRun();

  if (!run.token || run.questions.length === 0) {
    return NextResponse.json(
      { error: "No questions are available for a new run." },
      { status: 503 },
    );
  }

  return NextResponse.json(run);
}
