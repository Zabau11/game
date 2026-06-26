import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const databasePath = path.join(process.cwd(), "data", "questions.json");

const blockedLabels = new Set([
  "Benoit Blanc",
  "Leslie Knope",
  "Miranda Priestly",
  "Ms. Frizzle",
  "Puss in Boots",
  "Rumpelstiltskin",
  "Ted Lasso",
  "Theremin",
  "Uncle Iroh",
]);

const softWarnings = [
  /\bfirst-gen\b/i,
  /\bAirPods\b/i,
  /\bStanley cup\b/i,
  /\bsmart ring\b/i,
  /\bmandoline\b/i,
  /\bmacaron\b/i,
  /\btiramisu\b/i,
];

function optionLabel(option) {
  return typeof option?.label === "string" ? option.label.trim() : "";
}

const database = JSON.parse(await fs.readFile(databasePath, "utf8"));
const failures = [];
const warnings = [];

for (const question of database.questions ?? []) {
  const labels = (question.options ?? []).map(optionLabel);
  const uniqueLabels = new Set(labels.map((label) => label.toLowerCase()));

  if (labels.length !== 4) {
    failures.push(`${question.id}: expected 4 answer options`);
  }

  if (uniqueLabels.size !== labels.length) {
    failures.push(`${question.id}: duplicate answer labels`);
  }

  for (const label of labels) {
    if (blockedLabels.has(label)) {
      failures.push(`${question.id}: "${label}" is too niche for the main bank`);
    }

    for (const pattern of softWarnings) {
      if (pattern.test(label)) {
        warnings.push(`${question.id}: "${label}" may need a recognition check`);
      }
    }
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`error: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Question bank audit passed with ${warnings.length} warning(s).`);
}
