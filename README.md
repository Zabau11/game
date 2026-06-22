# AI Consensus Game

A Next.js prototype for the AI Consensus Game concept. The first screen safely
tests a Vertex AI express-mode API key from a server-side route.

## Run locally

Create a `.env` file:

```bash
API_KEY=your_vertex_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
MISTRAL_API_KEY=your_mistral_api_key
PROJECT_ID=your_google_cloud_project_id
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
- Kimi K2 Thinking through Vertex AI's managed open-model endpoint
- Mistral Small through Mistral's direct Chat Completions API

Vertex AI currently lists Kimi K2 Thinking, not Kimi K2.5.
