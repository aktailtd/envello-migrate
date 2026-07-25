import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { transformSourceFile } from "./transform.js";

function run(source: string, fileName = "input.ts"): { output: string; changed: boolean } {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true },
  });
  const sourceFile = project.createSourceFile(fileName, source);
  const changed = transformSourceFile(sourceFile);
  return { output: sourceFile.getFullText(), changed };
}

describe("transformSourceFile", () => {
  it("rewrites a plain named import and its constructor call", () => {
    const { output, changed } = run(
      `import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({ from: "a@a.com", to: "b@b.com", subject: "hi", html: "<p>hi</p>" });
`,
    );

    expect(changed).toBe(true);
    expect(output).toContain('import { Envello } from "envello";');
    expect(output).toContain("const resend = new Envello(process.env.RESEND_API_KEY);");
    // Method call sites are Resend-compatible by design - untouched.
    expect(output).toContain("resend.emails.send({");
  });

  it("renames every reference to the imported class, not just the constructor call", () => {
    const { output } = run(
      `import { Resend } from "resend";

function makeClient(): Resend {
  return new Resend("key");
}
`,
    );

    expect(output).toContain('import { Envello } from "envello";');
    expect(output).toContain("function makeClient(): Envello {");
    expect(output).toContain('return new Envello("key");');
  });

  it("leaves an aliased import's local name untouched, only swaps the module specifier", () => {
    const { output, changed } = run(
      `import { Resend as ResendClient } from "resend";

const client = new ResendClient("key");
`,
    );

    expect(changed).toBe(true);
    expect(output).toContain('import { Resend as ResendClient } from "envello";');
    expect(output).toContain('const client = new ResendClient("key");');
  });

  it("does not touch unrelated imports from other packages", () => {
    const { output, changed } = run(
      `import { Resend } from "some-other-package";
import { z } from "zod";

const x = new Resend();
`,
    );

    expect(changed).toBe(false);
    expect(output).toContain('from "some-other-package"');
    expect(output).toContain("new Resend()");
  });

  it("rewrites the CommonJS require form", () => {
    const { output, changed } = run(
      `const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
`,
      "input.js",
    );

    expect(changed).toBe(true);
    expect(output).toContain('const { Envello } = require("envello");');
    expect(output).toContain("const resend = new Envello(process.env.RESEND_API_KEY);");
  });

  it("leaves an aliased CommonJS destructure's local binding untouched", () => {
    const { output, changed } = run(
      `const { Resend: ResendClient } = require("resend");

const client = new ResendClient("key");
`,
      "input.js",
    );

    expect(changed).toBe(true);
    expect(output).toContain('const { Envello: ResendClient } = require("envello");');
    expect(output).toContain('const client = new ResendClient("key");');
  });

  it("is a no-op on a file with no Resend usage", () => {
    const { output, changed } = run(
      `import { Envello } from "envello";

const envello = new Envello("key");
`,
    );

    expect(changed).toBe(false);
    expect(output).toContain('import { Envello } from "envello";');
  });
});
