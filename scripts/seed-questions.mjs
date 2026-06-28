import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { neon } from "@neondatabase/serverless";

const root = process.cwd();
const envFiles = [".env.local", ".env"];
const schemaPath = path.join(root, "db", "schema.sql");
const questionsPath = path.join(root, "data", "questions.json");

async function loadEnv() {
  for (const file of envFiles) {
    try {
      const text = await fs.readFile(path.join(root, file), "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // Optional env file.
    }
  }
}

async function main() {
  await loadEnv();
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL or POSTGRES_URL. Pull/copy Vercel Neon env vars first.");
  }

  const sql = neon(databaseUrl);
  const schema = await fs.readFile(schemaPath, "utf8");
  for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
    await sql.query(statement);
  }

  const database = JSON.parse(await fs.readFile(questionsPath, "utf8"));
  let count = 0;

  for (const [index, question] of database.questions.entries()) {
    await sql`
      insert into questions (
        id,
        sort_order,
        category,
        question,
        options,
        status,
        winner,
        explanation,
        model_results,
        generated_at,
        updated_at
      )
      values (
        ${question.id},
        ${index},
        ${question.category},
        ${question.question},
        ${JSON.stringify(question.options)},
        ${question.status},
        ${question.winner},
        ${question.explanation},
        ${JSON.stringify(question.modelResults ?? [])},
        ${question.generatedAt ? new Date(question.generatedAt).toISOString() : null},
        now()
      )
      on conflict (id) do update set
        sort_order = excluded.sort_order,
        category = excluded.category,
        question = excluded.question,
        options = excluded.options,
        status = excluded.status,
        winner = excluded.winner,
        explanation = excluded.explanation,
        model_results = excluded.model_results,
        generated_at = excluded.generated_at,
        updated_at = now()
    `;
    count += 1;
  }

  console.log(`Seeded ${count} questions.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
