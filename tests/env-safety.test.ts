import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test(".env.example contains placeholders, not production credentials", () => {
  const example = fs.readFileSync(".env.example", "utf8");

  assert.doesNotMatch(example, /AKIA[0-9A-Z]{16}/);
  assert.match(
    example,
    /^DATABASE_URL=postgres:\/\/hogyoku:hogyoku@localhost:5432\/hogyoku$/m,
  );
  assert.doesNotMatch(example, /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@(?!localhost)[^/\s]+/);
  assert.doesNotMatch(example, /rediss:\/\/[^:\s]+:[^@\s]+@/);
  assert.match(example, /^GEMINI_API_KEY=$/m);
});

test("local environment files are excluded from Git", () => {
  const gitignore = fs.readFileSync(".gitignore", "utf8");
  assert.match(gitignore, /^\.env$/m);
});
