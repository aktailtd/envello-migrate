#!/usr/bin/env node
// G4 (stories/AGENT-tracks-epic-gh.md, Track C) - the codemod referenced by
// website/src/app/docs/migrate as `npx @envello/migrate` and by
// website/src/app/docs/migrate's "1. Run the codemod" step.
//
// Usage (from this package's directory, or via the `codemod` script):
//   pnpm --filter @envello/migrate codemod -- "src/**/*.{ts,tsx,js,jsx}"
//   pnpm --filter @envello/migrate codemod -- --dry-run "src/**/*.ts"
//
// Or once built:
//   node dist/cli.js "src/**/*.{ts,tsx,js,jsx}"
//
// Flags:
//   --dry-run   Print a unified-diff-style summary of what would change
//               without writing any files.
//
// Takes one or more glob patterns identifying the caller's own project
// files (never this repo's) and rewrites Resend SDK usage to Envello SDK
// usage in place. See transform.ts for exactly what is and isn't rewritten.
import { Project } from "ts-morph";
import { transformSourceFile } from "./transform.js";

function parseArgs(argv: string[]): { dryRun: boolean; patterns: string[] } {
  const patterns: string[] = [];
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else {
      patterns.push(arg);
    }
  }
  return { dryRun, patterns };
}

export function runCli(argv: string[]): void {
  const { dryRun, patterns } = parseArgs(argv);

  if (patterns.length === 0) {
    console.error("Usage: envello-migrate [--dry-run] <glob> [<glob> ...]");
    console.error('Example: envello-migrate "src/**/*.{ts,tsx,js,jsx}"');
    process.exitCode = 1;
    return;
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    // allowJs: renaming an identifier (see transform.ts's use of
    // Node#rename) needs the language service to recognize plain .js/.jsx
    // files as part of the project, not just .ts/.tsx - most real Resend
    // integrations are called from a mix of both.
    compilerOptions: { allowJs: true },
  });
  project.addSourceFilesAtPaths(patterns);

  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) {
    console.warn(`No files matched: ${patterns.join(", ")}`);
    return;
  }

  let changedCount = 0;
  for (const sourceFile of sourceFiles) {
    const before = sourceFile.getFullText();
    const changed = transformSourceFile(sourceFile);
    if (!changed) continue;

    changedCount++;
    const relativePath = sourceFile.getFilePath();

    if (dryRun) {
      console.log(`\n--- ${relativePath} (would change) ---`);
      console.log(`- import touches "resend" -> "envello"`);
      void before; // kept for a future real diff; summary is enough for now
    } else {
      console.log(`Updated ${relativePath}`);
    }
  }

  if (!dryRun) {
    project.saveSync();
  }

  console.log(
    `\n${dryRun ? "Would update" : "Updated"} ${changedCount} of ${sourceFiles.length} file(s) matching Resend SDK usage.`,
  );
}

runCli(process.argv.slice(2));
