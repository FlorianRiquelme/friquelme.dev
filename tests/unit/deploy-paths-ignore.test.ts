import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import picomatch from "picomatch";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = parse(readFileSync(`${root}.github/workflows/deploy.yml`, "utf8"));
const patterns: string[] = workflow.on.push["paths-ignore"];
const ignored = picomatch(patterns, { dot: true });
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);

describe("deploy paths-ignore", () => {
  it("never matches a build input", () => {
    const astroConfig = ["astro.config.mjs", "astro.config.ts"].filter((f) => existsSync(`${root}${f}`));
    expect(astroConfig).toHaveLength(1);
    const exact = ["package.json", "pnpm-lock.yaml", ".nvmrc", "tsconfig.json", ...astroConfig];
    const inputs = tracked.filter((f) => /^(src|public|scripts)\//.test(f) || exact.includes(f));
    expect(inputs).toEqual(expect.arrayContaining(exact));
    expect(inputs.filter((f) => ignored(f))).toEqual([]);
  });

  it("matches tests, root docs, trials and automation config", () => {
    for (const f of [
      "tests/unit/deploy-workflow.test.ts",
      "README.md",
      "trials/testerarmy/README.md",
      ".github/automation/dependabot-review.md",
    ]) {
      expect(ignored(f), f).toBe(true);
    }
  });

  it("does not match blog posts or nested Markdown", () => {
    const posts = tracked.filter((f) => /^src\/blog\/.+\.mdx$/.test(f));
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.filter((f) => ignored(f))).toEqual([]);
    expect(ignored("src/notes/readme.md")).toBe(false);
  });
});
