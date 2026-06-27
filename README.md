# AI Consensus Game

A Next.js prototype for the AI Consensus Game concept. The first screen safely
tests a Vertex AI express-mode API key from a server-side route.

## Run locally

Create a `.env` file:

```bash
API_KEY=your_vertex_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
# Optional; defaults to a cheap GPT nano model.
OPENAI_MODEL=gpt-5.4-nano
MISTRAL_API_KEY=your_mistral_api_key
PROJECT_LOCATION=us-central1
```

Then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Test Vertex AI
connection**.

The API key is only read by the server route and is never sent to the browser.

The diagnostic panel tests:

- Gemini 2.5 Flash through Vertex AI express mode
- Claude Haiku 4.5 through Anthropic's direct Messages API
- GPT through OpenAI's direct Chat Completions API
- Mistral Small through Mistral's direct Chat Completions API
