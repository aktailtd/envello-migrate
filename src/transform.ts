// G4 (stories/AGENT-tracks-epic-gh.md, Track C): the codemod behind
// website/src/app/docs/migrate's "npx @envello/migrate" step. Envello's
// Node SDK deliberately mirrors the Resend SDK's method shapes
// (`.emails.send(...)`, `.emails.batch(...)`, etc. - see
// stories/AGENT-tracks-epic-gh.md, Track A), so a migration is almost
// entirely a rename of the import and the client construction - the
// call sites underneath don't need to change at all.
//
// What this rewrites, per file:
//   import { Resend } from "resend"        -> import { Envello } from "envello"
//   const resend = new Resend(apiKey)      -> const resend = new Envello(apiKey)
//   const { Resend } = require("resend")   -> const { Envello } = require("envello")
//
// What it deliberately leaves alone:
//   - Aliased imports (`import { Resend as Client } from "resend"`): only
//     the module specifier changes to "envello". The alias binding and
//     every call site using it are untouched, since they never referenced
//     the name "Resend" to begin with.
//   - Every `.emails.send(...)`, `.emails.batch(...)`, `.emails.get(...)`
//     etc. call site: those method shapes are Resend-compatible by design,
//     so there is nothing to transform there.
import { Project, SyntaxKind, type SourceFile } from "ts-morph";

export interface FileTransformResult {
  filePath: string;
  changed: boolean;
}

const RESEND_PACKAGE_NAME = "resend";
const ENVELLO_PACKAGE_NAME = "envello";
const RESEND_CLASS_NAME = "Resend";
const ENVELLO_CLASS_NAME = "Envello";

/**
 * Rewrites `import { Resend } from "resend"` (and its aliased form) in a
 * single source file. Returns true if the file was modified.
 */
function transformEsmImports(sourceFile: SourceFile): boolean {
  let changed = false;

  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (importDecl.getModuleSpecifierValue() !== RESEND_PACKAGE_NAME) continue;

    let touchesResend = false;
    for (const namedImport of importDecl.getNamedImports()) {
      if (namedImport.getName() !== RESEND_CLASS_NAME) continue;
      touchesResend = true;

      if (!namedImport.getAliasNode()) {
        // No alias: rename the binding (and every reference to it in this
        // file) from Resend to Envello via ts-morph's language-service-backed
        // rename, so `new Resend(...)` call sites update automatically.
        // getNameNode() is typed as Identifier | StringLiteral (the latter
        // only applies to string-named imports, e.g. `{ "foo" as bar }`,
        // which can't match RESEND_CLASS_NAME above) - narrow defensively.
        const nameNode = namedImport.getNameNode();
        if (nameNode.asKind(SyntaxKind.Identifier)) {
          nameNode.asKindOrThrow(SyntaxKind.Identifier).rename(ENVELLO_CLASS_NAME);
        }
      }
      // Aliased imports (`Resend as Client`) keep their alias untouched -
      // only the module specifier below needs to change.
    }

    if (touchesResend) {
      importDecl.setModuleSpecifier(ENVELLO_PACKAGE_NAME);
      changed = true;
    }
  }

  return changed;
}

/**
 * Best-effort rewrite of the equivalent CommonJS form:
 *   const { Resend } = require("resend")
 * Plain `require(...)` calls aren't import declarations, so ts-morph's
 * import-specifier APIs don't apply - this walks variable declarations
 * with a destructured `require("resend")` initializer instead.
 */
function transformCjsRequire(sourceFile: SourceFile): boolean {
  let changed = false;

  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const initializer = varDecl.getInitializer();
    const callExpr = initializer?.asKind(SyntaxKind.CallExpression);
    if (!callExpr) continue;
    if (callExpr.getExpression().getText() !== "require") continue;

    const [arg] = callExpr.getArguments();
    const stringArg = arg?.asKind(SyntaxKind.StringLiteral);
    if (!stringArg || stringArg.getLiteralValue() !== RESEND_PACKAGE_NAME) continue;

    const objectPattern = varDecl.getNameNode().asKind(SyntaxKind.ObjectBindingPattern);
    if (!objectPattern) continue;

    let touchesResend = false;
    for (const element of objectPattern.getElements()) {
      const propertyNameNode = element.getPropertyNameNode();
      const bindingNameNode = element.getNameNode();
      const bindsResend = (propertyNameNode ?? bindingNameNode).getText() === RESEND_CLASS_NAME;
      if (!bindsResend) continue;
      touchesResend = true;

      if (!propertyNameNode) {
        // `const { Resend } = require(...)` - shorthand, rename the binding
        // (and its usages) directly.
        bindingNameNode.asKind(SyntaxKind.Identifier)?.rename(ENVELLO_CLASS_NAME);
      } else {
        // `const { Resend: Client } = require(...)` - only rewrite the
        // property name being destructured, leave the local alias alone.
        propertyNameNode.replaceWithText(ENVELLO_CLASS_NAME);
      }
    }

    if (touchesResend) {
      stringArg.replaceWithText(JSON.stringify(ENVELLO_PACKAGE_NAME));
      changed = true;
    }
  }

  return changed;
}

/** Applies both the ESM and CJS transforms to one file. */
export function transformSourceFile(sourceFile: SourceFile): boolean {
  const esmChanged = transformEsmImports(sourceFile);
  const cjsChanged = transformCjsRequire(sourceFile);
  return esmChanged || cjsChanged;
}

/**
 * Applies the transform to every source file already loaded into `project`
 * and returns a per-file change report. Caller is responsible for calling
 * `project.save()` (or inspecting `sourceFile.getFullText()` for a dry run)
 * afterwards - this function only mutates the in-memory AST.
 */
export function transformProject(project: Project): FileTransformResult[] {
  return project.getSourceFiles().map((sourceFile) => ({
    filePath: sourceFile.getFilePath(),
    changed: transformSourceFile(sourceFile),
  }));
}
