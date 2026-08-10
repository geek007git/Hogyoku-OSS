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

test("every env preset pins an object-store encryption mode", () => {
  const presets = [
    ".env.example",
    ".env.free.example",
    ".env.standard.example",
    ".env.pro.example",
  ];

  for (const preset of presets) {
    const contents = fs.readFileSync(preset, "utf8");
    assert.match(
      contents,
      /^S3_SERVER_SIDE_ENCRYPTION=(AES256|aws:kms|none)$/m,
      `${preset} must declare a valid S3_SERVER_SIDE_ENCRYPTION`,
    );
  }
});

test("local environment files are excluded from Git", () => {
  const gitignore = fs.readFileSync(".gitignore", "utf8");
  assert.match(gitignore, /^\.env$/m);
});
