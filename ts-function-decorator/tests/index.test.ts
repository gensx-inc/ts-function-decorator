/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from "path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import transformer from "../src/index";

describe("Decorator Transformer", () => {
  function createTestHost(fileName: string, sourceCode: string) {
    const defaultHost = ts.createCompilerHost({
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
    });
    const sourceFile = ts.createSourceFile(
      fileName,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
    );
    return {
      ...defaultHost,
      getSourceFile: (requestedFileName: string, ...args: any[]) => {
        if (path.resolve(requestedFileName) === path.resolve(fileName)) {
          return sourceFile;
        }
        return defaultHost.getSourceFile(requestedFileName, args[0], args[1]);
      },
      readFile: (requestedFileName: string) => {
        if (path.resolve(requestedFileName) === path.resolve(fileName)) {
          return sourceCode;
        }
        return defaultHost.readFile(requestedFileName);
      },
      fileExists: (requestedFileName: string) => {
        if (path.resolve(requestedFileName) === path.resolve(fileName)) {
          return true;
        }
        return defaultHost.fileExists(requestedFileName);
      },
      writeFile: () => {},
      getCurrentDirectory: () => process.cwd(),
      getDirectories: () => [],
      getCanonicalFileName: (fileName: string) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
    };
  }

  it("should transform a function with a decorator", () => {
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

    const fileName = path.resolve(process.cwd(), "test.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });

    const transformedProgram = transformer(program, undefined, {}, { ts });

    // Get the transformed source file
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    // Verify the transformation
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Check for the wrapper function
    expect(transformedCode).toContain("function add(args");
    // Check for the decorator application wrapping the original function
    expect(transformedCode).toContain("return log(function add(");
  });

  it("should handle async functions with decorators", () => {
    const sourceCode = `
      function log(target: any) {
        return async function(...args: any[]) {
          console.log('Calling async function with args:', args);
          return await target.apply(this, args);
        };
      }

      @log
      async function fetchData(id: number): Promise<string> {
        return 'data-' + id;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });

    const transformedProgram = transformer(program, undefined, {}, { ts });

    // Get the transformed source file
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    // Verify the transformation
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Check for the wrapper async function
    expect(transformedCode).toContain("async function fetchData(args");
    // Check for the decorator application wrapping the original async function
    expect(transformedCode).toContain("return log(async function fetchData(");
  });

  it("should handle multiple decorators", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Logging:', args);
          return target.apply(this, args);
        };
      }

      function validate(target: any) {
        return function(...args: any[]) {
          if (args[0] < 0) throw new Error('Invalid input');
          return target.apply(this, args);
        };
      }

      @log
      @validate
      function processNumber(n: number): number {
        return n * 2;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });

    const transformedProgram = transformer(program, undefined, {}, { ts });

    // Get the transformed source file
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    // Verify the transformation
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Check for the wrapper function
    expect(transformedCode).toContain("function processNumber(args");
    // Check for the decorator application wrapping the original function with both decorators
    expect(transformedCode).toContain(
      "return log(validate(function processNumber(",
    );
  });

  it("should handle a decorator factory", () => {
    const sourceCode = `
      function logWith(prefix: string) {
        return function(target: any) {
          return function(...args: any[]) {
            console.log(prefix, args);
            return target.apply(this, args);
          };
        };
      }

      @logWith("ADD:")
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const fileName = path.resolve(process.cwd(), "test-factory.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });
    const transformedProgram = transformer(program, undefined, {}, { ts });
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);
    expect(transformedCode).toContain("function add(args");
    expect(transformedCode).toContain('return logWith("ADD:")(function add(');
  });

  it("should handle multiple decorator factories", () => {
    const sourceCode = `
      function logWith(prefix: string) {
        return function(target: any) {
          return function(...args: any[]) {
            console.log(prefix, args);
            return target.apply(this, args);
          };
        };
      }
      function validateWith(min: number) {
        return function(target: any) {
          return function(...args: any[]) {
            if (args[0] < min) throw new Error('Invalid input');
            return target.apply(this, args);
          };
        };
      }

      @logWith("PROC:")
      @validateWith(10)
      function processNumber(n: number): number {
        return n * 2;
      }
    `;
    const fileName = path.resolve(process.cwd(), "test-multifactory.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });
    const transformedProgram = transformer(program, undefined, {}, { ts });
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);
    expect(transformedCode).toContain("function processNumber(args");
    expect(transformedCode).toContain(
      'return logWith("PROC:")(validateWith(10)(function processNumber(',
    );
  });

  it("should handle a mix of decorator factories and plain decorators", () => {
    const sourceCode = `
      function logWith(prefix: string) {
        return function(target: any) {
          return function(...args: any[]) {
            console.log(prefix, args);
            return target.apply(this, args);
          };
        };
      }
      function plain(target: any) {
        return function(...args: any[]) {
          return target.apply(this, args);
        };
      }

      @logWith("MIX:")
      @plain
      function mixed(n: number): number {
        return n * 2;
      }
    `;
    const fileName = path.resolve(process.cwd(), "test-mixfactory.ts");
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      host: createTestHost(fileName, sourceCode),
    });
    const transformedProgram = transformer(program, undefined, {}, { ts });
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();
    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);
    expect(transformedCode).toContain("function mixed(args");
    expect(transformedCode).toContain(
      'return logWith("MIX:")(plain(function mixed(',
    );
  });
});
