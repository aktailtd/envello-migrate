# @envello/migrate

Codemod that rewrites [Resend](https://resend.com) SDK usage to the [Envello](https://envello.dev) SDK in your own project. Envello's Node SDK deliberately mirrors Resend's method shapes (`.emails.send(...)`, `.emails.batch(...)`, etc.), so migrating is almost entirely a rename of the import and the client construction — call sites underneath don't need to change.

## Usage

```bash
npx @envello/migrate "src/**/*.{ts,tsx,js,jsx}"
```

Preview the changes first without writing anything:

```bash
npx @envello/migrate --dry-run "src/**/*.{ts,tsx,js,jsx}"
```

Takes one or more glob patterns identifying your own project files and rewrites them in place (unless `--dry-run` is passed).

## What it rewrites

```ts
import { Resend } from "resend";        // -> import { Envello } from "envello";
const resend = new Resend(apiKey);      // -> const resend = new Envello(apiKey);
const { Resend } = require("resend");   // -> const { Envello } = require("envello");
```

## What it deliberately leaves alone

- Aliased imports (`import { Resend as Client } from "resend"`): only the module specifier changes to `"envello"`. The alias binding and every call site using it are untouched.
- Every `.emails.send(...)`, `.emails.batch(...)`, `.emails.get(...)`, etc. call site — those method shapes are Resend-compatible by design, so nothing needs to change there.

Review the diff like any other automated refactor before committing it.

## Development

```bash
pnpm install
pnpm build       # -> dist/
pnpm typecheck
pnpm test
pnpm codemod -- "src/**/*.ts"   # run against tsx without building first
```
