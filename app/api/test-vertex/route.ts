import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ModelName = "gemini" | "claude" | "gpt" | "mistral";

type ProviderError = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function env() {
  return {
    apiKey: process.env.API_KEY ?? process.env.GOOGLE_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.4-nano",
    mistralApiKey: process.env.MISTRAL_API_KEY,
  };
}

function errorResponse(
  model: string,
  status: number,
  message: string,
  hint: string,
  startedAt: number,
) {
  return NextResponse.json(
    {
      ok: false,
      message,
      hint,
      model,
      latencyMs: Math.round(performance.now() - startedAt),
    },
    { status },
  );
}

async function testGemini(apiKey: string, startedAt: number) {
  const model = "gemini-2.5-flash";
  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Reply only with: Gemini connection successful" }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 40 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );

  const data = (await response.json()) as ProviderError & {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  if (!response.ok) {
    return errorResponse(
      model,
      response.status,
      data.error?.message || `Vertex AI returned HTTP ${response.status}.`,
      "Confirm that the key allows the Vertex AI API and that express mode is enabled.",
      startedAt,
    );
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("")
    .trim();

  return NextResponse.json({
    ok: true,
    message: "Gemini responded through Vertex AI express mode.",
    response: text || "Successful empty response.",
    model,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

async function testClaude(
  anthropicApiKey: string,
  startedAt: number,
) {
  const model = "claude-haiku-4-5";
  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        max_tokens: 40,
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: "Reply only with: Claude connection successful",
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );

  const data = (await response.json()) as ProviderError & {
    content?: Array<{ type?: string; text?: string }>;
  };

  if (!response.ok) {
    return errorResponse(
      model,
      response.status,
      data.error?.message || `Anthropic returned HTTP ${response.status}.`,
      response.status === 401
        ? "Check that ANTHROPIC_API_KEY contains a valid Anthropic API key."
        : "Check your Anthropic account balance, usage limits, and API access.",
      startedAt,
    );
  }

  const text = data.content
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .filter(Boolean)
    .join("")
    .trim();

  return NextResponse.json({
    ok: true,
    message: "Claude Haiku responded through the Anthropic API.",
    response: text || "Successful empty response.",
    model,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

async function testGpt(
  openaiApiKey: string,
  model: string,
  startedAt: number,
) {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: "Reply only with: GPT connection successful",
          },
        ],
        max_completion_tokens: 40,
        temperature: 0,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );

  const data = (await response.json()) as ProviderError & {
    choices?: Array<{
      message?: { content?: string | null };
    }>;
  };

  if (!response.ok) {
    return errorResponse(
      model,
      response.status,
      data.error?.message || `OpenAI returned HTTP ${response.status}.`,
      response.status === 401
        ? "Check that OPENAI_API_KEY contains a valid OpenAI API key."
        : "Check your OpenAI account balance, project limits, and model access.",
      startedAt,
    );
  }

  return NextResponse.json({
    ok: true,
    message: "GPT responded through the OpenAI API.",
    response:
      data.choices?.[0]?.message?.content?.trim() ||
      "Successful empty response.",
    model,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

async function testMistral(mistralApiKey: string, startedAt: number) {
  const model = "mistral-small-latest";
  const response = await fetch(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: "Reply only with: Mistral connection successful",
          },
        ],
        max_tokens: 30,
        temperature: 0,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );

  const data = (await response.json()) as ProviderError & {
    choices?: Array<{
      message?: { content?: string | null };
    }>;
  };

  if (!response.ok) {
    return errorResponse(
      model,
      response.status,
      data.error?.message || `Mistral returned HTTP ${response.status}.`,
      response.status === 401
        ? "Check that MISTRAL_API_KEY contains a valid Mistral API key."
        : "Check your Mistral account balance, workspace limits, and API access.",
      startedAt,
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Mistral Small responded through the Mistral API.",
    response:
      data.choices?.[0]?.message?.content?.trim() ||
      "Successful empty response.",
    model,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const model = (request.nextUrl.searchParams.get("model") ||
    "gemini") as ModelName;
  const { apiKey, anthropicApiKey, openaiApiKey, openaiModel, mistralApiKey } =
    env();

  if (model === "claude" && !anthropicApiKey) {
    return errorResponse(
      model,
      500,
      "No Anthropic API key was found.",
      "Add ANTHROPIC_API_KEY=your_key to .env and restart the server.",
      startedAt,
    );
  }

  if (model === "mistral" && !mistralApiKey) {
    return errorResponse(
      model,
      500,
      "No Mistral API key was found.",
      "Add MISTRAL_API_KEY=your_key to .env and restart the server.",
      startedAt,
    );
  }

  if (model === "gpt" && !openaiApiKey) {
    return errorResponse(
      model,
      500,
      "No OpenAI API key was found.",
      "Add OPENAI_API_KEY=your_key to .env and restart the server.",
      startedAt,
    );
  }

  if (model !== "claude" && model !== "gpt" && model !== "mistral" && !apiKey) {
    return errorResponse(
      model,
      500,
      "No API key was found.",
      "Add API_KEY=your_key to .env and restart the development server.",
      startedAt,
    );
  }

  try {
    if (model === "claude") {
      return await testClaude(anthropicApiKey!, startedAt);
    }

    if (model === "gpt") {
      return await testGpt(openaiApiKey!, openaiModel, startedAt);
    }

    if (model === "mistral") {
      return await testMistral(mistralApiKey!, startedAt);
    }

    return await testGemini(apiKey!, startedAt);
  } catch (error) {
    return errorResponse(
      model,
      502,
      "Could not connect to the model provider.",
      error instanceof Error ? error.message : "Unknown connection error.",
      startedAt,
    );
  }
}
