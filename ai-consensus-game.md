# AI Consensus Game

## One-line concept

Players read a playful question, choose which answer they think AI models ranked highest, and then discover the full AI consensus percentages and a concise explanation.

> **Can you predict what AI believes?**

## Example round

### Question

**Which brand would survive longest in a zombie apocalypse?**

- Costco
- IKEA
- Tesla
- Disney

The player selects **Costco**.

### Reveal

| Answer | AI consensus |
|---|---:|
| Costco | 62% |
| IKEA | 21% |
| Tesla | 11% |
| Disney | 6% |

**Correct.**

Costco leads because its warehouses combine food, medicine, shelter, logistics, and bulk supplies. IKEA offers useful shelter materials, while Tesla and Disney have fewer immediately practical survival resources.

## Core game loop

1. Show one question with four familiar choices.
2. The player predicts which choice has the highest AI percentage.
3. Lock the answer.
4. Animate the full percentage reveal.
5. Show whether the player was correct.
6. Give a short explanation of the result.
7. Continue to the next round.

A session should contain approximately 5–10 rounds and require no account.

## What makes a good question

Questions should use recognizable brands, products, fictional characters, cities, celebrities, or cultural objects. Players must be able to reason from familiar associations.

For the main bank, every answer should pass a quick recognition test: a casual player should know what the answer represents without having to read the book, watch the show, follow a niche fandom, or recognize a minor celebrity. Use names like Tony Stark, Google, BMW, McDonald's, Batman, Paris, pizza, smartphone, or LEGO before using cult characters, specialist objects, or deep-cut media references.

Good:

- Which brand would survive longest in a zombie apocalypse?
- Which company would be most likely to build a city on Mars?
- Which fictional character would make the best startup founder?
- Which city feels most like the future?
- Which product would be hardest to explain to someone from 1800?

Weak:

- Which of these unrelated brands would AI choose?
- Questions with one objectively factual answer
- Questions requiring obscure knowledge
- Choices where the hard part is knowing what an answer means
- Niche actors, minor fictional characters, cult books, specialist tools, or fandom-only references
- Questions whose choices are not reasonably comparable

The ideal result makes players react with either:

> “That makes complete sense.”

or:

> “No way—AI robbed IKEA.”

## AI consensus methodology

The percentages should be generated before gameplay and stored in the database. No model call is required while a player is answering.

### Model panel

The first version can use models available through Google Cloud Vertex AI Model Garden:

- Gemini Flash
- Claude Haiku
- Grok Fast
- Mistral Small
- Llama

Start with fewer models if partner-model credits are unavailable.

### Model task

Each model receives the same question and options:

```text
Estimate the probability that you would select each answer.

Rules:
- Assign a probability to every option.
- All probabilities must total exactly 100.
- Judge only the question provided.
- Return structured JSON.
- Include one concise explanation for the distribution.
```

Example response:

```json
{
  "probabilities": {
    "Costco": 60,
    "IKEA": 23,
    "Tesla": 11,
    "Disney": 6
  },
  "explanation": "Costco combines supplies, medicine, shelter, and logistics."
}
```

### Aggregation

1. Run each question through several distinct model families.
2. Randomize the order of choices to reduce position bias.
3. Validate that each result totals 100.
4. Average the distributions.
5. Normalize and round the final values to total 100.
6. Mark the highest percentage as the winning answer.
7. Generate one concise consensus explanation from the collected rationales.

The result should be labeled **AI consensus estimate**, not objective truth.

### Stored round

```json
{
  "id": "zombie-brands-001",
  "question": "Which brand would survive longest in a zombie apocalypse?",
  "options": [
    { "id": "costco", "label": "Costco", "percentage": 62 },
    { "id": "ikea", "label": "IKEA", "percentage": 21 },
    { "id": "tesla", "label": "Tesla", "percentage": 11 },
    { "id": "disney", "label": "Disney", "percentage": 6 }
  ],
  "winner": "costco",
  "explanation": "Costco leads because its warehouses combine food, medicine, shelter, logistics, and bulk supplies.",
  "models": [
    "gemini",
    "claude",
    "grok",
    "mistral",
    "llama"
  ],
  "generatedAt": "2026-06-22"
}
```

## Explanation design

Explanations are essential because otherwise the percentages feel random.

Do not describe them as the model’s private “thought process.” Instead use:

- AI consensus explanation
- Why AI voted this way
- What influenced the result

Keep the explanation to one or two sentences so it does not interrupt the game’s pace. Optionally show one interesting disagreement:

> Gemini strongly preferred Costco, while Claude gave IKEA a better chance because its stores contain beds, kitchens, and construction materials.

## Game modes

### Daily Consensus

The same five questions for everyone each day. Supports streaks, leaderboards, and spoiler-free sharing.

### Endless

Continue playing from the full question bank.

### Model Battle

Predict which answer a specific model chose, then compare Gemini, Claude, Grok, Mistral, and Llama.

### Human vs AI

After enough players participate, reveal both distributions:

```text
AI consensus:    Costco 62%
Human players:   IKEA 48%
```

### Friend Challenge

Send the same set of questions to a friend and compare scores.

## Scoring

The simplest scoring system:

- Correct winner: 1 point
- Five-question daily score: 0–5
- Consecutive correct answers create a streak

Possible bonuses:

- Upset bonus when the winning answer leads by fewer than five points
- Consensus bonus when the winning answer exceeds 70%
- Perfect-day badge

Avoid making the initial scoring system complicated. The reveal is the main reward.

## UI direction

The interface should feel like a live election or game-show reveal rather than a survey form.

### Question state

- Large editorial question
- Four bold answer cards
- Recognizable logos or imagery where legally and practically appropriate
- Clear progress indicator
- Fast keyboard and touch controls

### Reveal state

- Cards transform into animated horizontal bars
- Percentages count upward
- The winner takes visual emphasis
- The player’s choice remains visibly marked
- A short explanation slides into view
- Optional model-vote chips show disagreement

### Visual personality

- Strong typography
- Generous motion and tactile transitions
- One distinctive color per answer
- Dark or neutral stage-like background
- Avoid a conventional SaaS dashboard

## MVP

Build only:

1. A landing page explaining the game.
2. Five rounds per session.
3. Four choices per round.
4. Stored AI consensus percentages.
5. Animated reveal.
6. Brief explanation.
7. Final score.
8. Shareable result.

Create 50–100 reviewed questions manually or through a private generation script. Do not build accounts, multiplayer, live generation, or a complex administration system initially.

## Content workflow

```text
Generate candidate question
        ↓
Review question and options
        ↓
Query model panel
        ↓
Validate and average percentages
        ↓
Generate concise explanation
        ↓
Human quality review
        ↓
Publish to game database
```

Human review should reject rounds that are:

- Offensive or unnecessarily political
- Defamatory toward real people
- Too obvious
- Essentially random
- Dominated by one unfamiliar answer
- Dependent on rapidly changing facts
- Poorly explained by the model panel

## Technology outline

- Frontend: Next.js or another React framework
- Animation: Motion
- Database: Supabase/Postgres or static JSON for the first prototype
- Content generation: private Node.js script
- Models: Vertex AI Model Garden
- Authentication: Google Cloud Application Default Credentials for production-quality access
- Hosting: Vercel or Cloud Run

Model credentials must remain server-side. Never include API credentials in frontend code or commit `.env` files.

## Distribution

- Launch with a daily challenge
- Share results without revealing answers
- Publish funny model disagreements on social media
- Let communities suggest question packs
- Create themed editions around technology, films, food, cities, games, and internet culture
- Invite creators to publish their own packs later

Example share result:

```text
AI Consensus #12

🟩 Correct
🟥 Wrong
🟩 Correct
🟩 Correct
🟨 Upset

4/5 — I understand the machine.
```

## Key risks

### Arbitrary outcomes

Mitigation: use multiple model families, reveal percentages, and provide concise rationales.

### False precision

Mitigation: label results as estimates, preserve generation metadata, and avoid implying scientific certainty.

### Content exhaustion

Mitigation: create reusable themes, community submissions, and a controlled generation pipeline.

### One-time novelty

Mitigation: daily rounds, streaks, human-vs-AI comparisons, model disagreements, and friend challenges.

### Brand and personality issues

Mitigation: avoid suggesting endorsement, use trademarks descriptively, be cautious with logos, and prohibit defamatory or harmful prompts.

## Product positioning

Possible descriptions:

> Predict the machine.

> Can you guess the AI consensus?

> Family Feud, but the surveyed audience is artificial intelligence.

> How well do you understand what AI believes?

The clearest initial positioning is:

> **Choose the answer you think AI ranked highest—then reveal the machine consensus.**
