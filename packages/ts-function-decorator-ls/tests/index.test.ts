/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-assignment */

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import init from "../src/index";

const TEST_FILE = "test.ts";
const DECORATORS_FILE = "decorators.ts";

function getDiagnosticMessageText(diagnostic: ts.Diagnostic): string {
  if (typeof diagnostic.messageText === "string") return diagnostic.messageText;
  if (
    diagnostic.messageText &&
    typeof diagnostic.messageText === "object" &&
    "messageText" in diagnostic.messageText
  ) {
    return String((diagnostic.messageText as any).messageText);
  }
  return String(diagnostic.messageText);
}

function createRealLanguageService(
  sourceCode: string,
  fileName = TEST_FILE,
  additionalFiles?: Map<string, string>,
) {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    experimentalDecorators: true,
    strict: true,
  };

  // Create a map to store file contents in memory
  const fileContents = new Map<string, string>();
  fileContents.set(fileName, sourceCode);
  if (additionalFiles) {
    additionalFiles.forEach((content, file) => fileContents.set(file, content));
  }

  const languageServiceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => Array.from(fileContents.keys()),
    getScriptVersion: () => "1",
    getScriptSnapshot: (requestedFileName) => {
      const content = fileContents.get(requestedFileName);
      if (!content) return undefined;
      return ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (requestedFileName) => {
      // eslint-disable-next-line no-console
      console.log(
        "fileExists called with:",
        requestedFileName,
        fileContents.has(requestedFileName),
      );
      return fileContents.has(requestedFileName);
    },
    readFile: (requestedFileName) => {
      // eslint-disable-next-line no-console
      console.log(
        "readFile called with:",
        requestedFileName,
        fileContents.get(requestedFileName),
      );
      return fileContents.get(requestedFileName);
    },
    readDirectory: () => {
      // eslint-disable-next-line no-console
      console.log("readDirectory called", Array.from(fileContents.keys()));
      return Array.from(fileContents.keys());
    },
  };

  const languageService = ts.createLanguageService(
    languageServiceHost,
    ts.createDocumentRegistry(),
  );

  // Pass the real language service to your plugin
  const plugin = init({ typescript: ts });
  const pluginService = plugin.create({
    languageService,
    languageServiceHost,
    config: {},
    project: {} as any,
    serverHost: ts.sys as any,
  });

  return { pluginService, fileName };
}

describe("Decorator Language Service (integration)", () => {
  it("should filter out decorator-related errors", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const { pluginService, fileName } = createRealLanguageService(sourceCode);
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should not include decorator-related errors
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).toLowerCase().includes("decorator"),
      ),
    ).toBe(false);
  });

  it("should filter out unused decorator imports", () => {
    const sourceCode = `
      import { log } from './decorators';

      @log
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const { pluginService, fileName } = createRealLanguageService(sourceCode);
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should not include unused decorator import errors
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).includes(
          "is declared but its value is never read",
        ),
      ),
    ).toBe(false);
  });

  it("should not filter out regular errors", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Logging:', args);
          return target.apply(this, args);
        };
      }

      @log
      function add(a: number, b: number): number {
        return a + b;
      }

      // This will cause a real error
      const x: number = "not a number";
    `;

    const { pluginService, fileName } = createRealLanguageService(sourceCode);
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should include the type error
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).toLowerCase().includes("not assignable"),
      ),
    ).toBe(true);
  });

  it("should handle decorator factories", () => {
    const sourceCode = `
      function log(prefix: string) {
        return function(target: any) {
          return function(...args: any[]) {
            console.log(prefix, 'Calling function with args:', args);
            return target.apply(this, args);
          };
        };
      }

      @log('DEBUG')
      function multiply(a: number, b: number): number {
        return a * b;
      }
    `;

    const { pluginService, fileName } = createRealLanguageService(sourceCode);
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should not include decorator-related errors
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).toLowerCase().includes("decorator"),
      ),
    ).toBe(false);
  });

  it("should ignore import errors for decorator symbols", () => {
    const decoratorsFile = `
      export function log(target: any) {
        return function(...args: any[]) {
          console.log('Logging:', args);
          return target.apply(this, args);
        };
      }

      export function validate(target: any) {
        return function(...args: any[]) {
          if (args[0] < 0) throw new Error('Invalid input');
          return target.apply(this, args);
        };
      }
    `;

    const sourceCode = `
      import { log, validate } from './decorators';

      @log
      @validate
      function processNumber(n: number): number {
        return n * 2;
      }

      // This will cause a real error
      const x: number = "not a number";
    `;

    const additionalFiles = new Map<string, string>();
    additionalFiles.set(DECORATORS_FILE, decoratorsFile);

    const { pluginService, fileName } = createRealLanguageService(
      sourceCode,
      TEST_FILE,
      additionalFiles,
    );
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should not include unused import errors for decorator symbols
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).includes(
          "is declared but its value is never read",
        ),
      ),
    ).toBe(false);

    // Should still include the type error
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).toLowerCase().includes("not assignable"),
      ),
    ).toBe(true);
  });

  it("should not filter out unused import errors for non-decorator symbols", () => {
    const decoratorsFile = `
      export function log(target: any) {
        return function(...args: any[]) {
          console.log('Logging:', args);
          return target.apply(this, args);
        };
      }

      export function validate(target: any) {
        return function(...args: any[]) {
          if (args[0] < 0) throw new Error('Invalid input');
          return target.apply(this, args);
        };
      }
    `;

    const sourceCode = `
      import { log, validate } from './decorators';

      @validate
      function processNumber(n: number): number {
        return n * 2;
      }

      // This will cause a real error
      const x: number = "not a number";
    `;

    const additionalFiles = new Map<string, string>();
    additionalFiles.set(DECORATORS_FILE, decoratorsFile);

    const { pluginService, fileName } = createRealLanguageService(
      sourceCode,
      TEST_FILE,
      additionalFiles,
    );
    const diagnostics = pluginService.getSemanticDiagnostics(fileName);

    // Should not include unused import errors for decorator symbols
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).includes(
          "is declared but its value is never read",
        ),
      ),
    ).toBe(false);

    // Should still include the type error
    expect(
      diagnostics.some((d) =>
        getDiagnosticMessageText(d).toLowerCase().includes("not assignable"),
      ),
    ).toBe(true);
  });
});
