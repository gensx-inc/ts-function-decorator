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
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper function with original parameters
    expect(transformedCode).toContain(
      "function add(a: number, b: number): number",
    );
    // Check for the decorator application wrapping the original function
    expect(transformedCode).toContain("return log(function add(");
    // Check that parameters are passed through
    expect(transformedCode).toContain(")(a, b)");
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
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper async function with original parameters
    expect(transformedCode).toContain(
      "async function fetchData(id: number): Promise<string>",
    );
    // Check for the decorator application wrapping the original async function
    expect(transformedCode).toContain("return log(async function fetchData(");
    // Check that parameters are passed through
    expect(transformedCode).toContain(")(id)");
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
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper function with original parameters
    expect(transformedCode).toContain(
      "function processNumber(n: number): number",
    );
    // Check for the decorator application wrapping the original function with both decorators
    expect(transformedCode).toContain(
      "return log(validate(function processNumber(",
    );
    // Check that parameters are passed through
    expect(transformedCode).toContain("))(n)");
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
    expect(transformedCode).toContain(
      "function add(a: number, b: number): number",
    );
    expect(transformedCode).toContain('return logWith("ADD:")(function add(');
    expect(transformedCode).toContain(")(a, b)");
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
    expect(transformedCode).toContain(
      "function processNumber(n: number): number",
    );
    expect(transformedCode).toContain(
      'return logWith("PROC:")(validateWith(10)(function processNumber(',
    );
    expect(transformedCode).toContain("))(n)");
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
    expect(transformedCode).toContain("function mixed(n: number): number");
    expect(transformedCode).toContain(
      'return logWith("MIX:")(plain(function mixed(',
    );
    expect(transformedCode).toContain("))(n)");
  });

  it("should handle functions with multiple parameters", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function complexOperation(x: number, y: string, z: boolean): string {
        return \`\${x} - \${y} - \${z}\`;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-multi-params.ts");
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

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper function with parameters
    expect(transformedCode).toContain(
      "function complexOperation(x: number, y: string, z: boolean)",
    );
    // Check for the decorator application wrapping the original function
    expect(transformedCode).toContain("return log(function complexOperation(");
    // Check that all parameters are passed through
    expect(transformedCode).toContain(")(x, y, z)");
  });

  it("should handle functions with no parameters", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function noParams(): string {
        return "hello";
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-no-params.ts");
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

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper function without parameters
    expect(transformedCode).toContain("function noParams()");
    // Check for the decorator application wrapping the original function
    expect(transformedCode).toContain("return log(function noParams(");
  });

  it("should handle functions with type parameters", () => {
    const sourceCode = `
      function log<T>(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function genericFunction<T>(value: T): T {
        return value;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-generic.ts");
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

    // Debug log to see the actual transformed code
    console.info("Transformed code:", transformedCode);

    // Check for the wrapper function with type parameter
    expect(transformedCode).toContain("function genericFunction<T>");
    // Check for the decorator application wrapping the original function
    expect(transformedCode).toContain("return log(function genericFunction<T>");
    // Check that the parameter is passed through
    expect(transformedCode).toContain(")(value)");
  });

  it("should handle functions with complex return types", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      interface ComplexType {
        id: number;
        name: string;
      }

      @log
      function complexReturn(): ComplexType {
        return { id: 1, name: "test" };
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-complex-return.ts");
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

    expect(transformedCode).toContain("function complexReturn(): ComplexType");
    expect(transformedCode).toContain("function complexReturn()");
  });

  it("should handle functions with rest parameters", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function withRestParams(...numbers: number[]): number {
        return numbers.reduce((sum, n) => sum + n, 0);
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-rest-params.ts");
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

    expect(transformedCode).toContain(
      "function withRestParams(...numbers: number[]): number",
    );
    expect(transformedCode).toContain("return log(function withRestParams(");
    expect(transformedCode).toContain(")(numbers)");
  });

  it("should handle functions with optional parameters", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function withOptionalParams(required: string, optional?: number): string {
        return optional ? \`\${required}-\${optional}\` : required;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-optional-params.ts");
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

    expect(transformedCode).toContain(
      "function withOptionalParams(required: string, optional?: number): string",
    );
    expect(transformedCode).toContain(
      "return log(function withOptionalParams(",
    );
    expect(transformedCode).toContain(")(required, optional)");
  });

  it("should handle decorator factory with no arguments", () => {
    const sourceCode = `
      function logWith() {
        return function(target: any) {
          return function(...args: any[]) {
            console.log('Calling function with args:', args);
            return target.apply(this, args);
          };
        };
      }

      @logWith()
      function noArgs(): string {
        return "hello";
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-factory-no-args.ts");
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

    expect(transformedCode).toContain("function noArgs()");
    expect(transformedCode).toContain("return logWith()(function noArgs(");
  });

  it("should handle decorator factory with multiple arguments", () => {
    const sourceCode = `
      function logWith(prefix: string, suffix: string, options: { debug: boolean }) {
        return function(target: any) {
          return function(...args: any[]) {
            if (options.debug) {
              console.log(prefix, args, suffix);
            }
            return target.apply(this, args);
          };
        };
      }

      @logWith("START:", "END", { debug: true })
      function multiArgs(x: number, y: string): string {
        return \`\${x}-\${y}\`;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-factory-multi-args.ts");
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

    expect(transformedCode).toContain(
      "function multiArgs(x: number, y: string): string",
    );
    expect(transformedCode).toContain(
      'return logWith("START:", "END", { debug: true })(function multiArgs(',
    );
    expect(transformedCode).toContain(")(x, y)");
  });

  it("should handle decorator factory with type parameters", () => {
    const sourceCode = `
      function logWith<T>(type: new () => T) {
        return function(target: any) {
          return function(...args: any[]) {
            console.log('Type:', type.name);
            return target.apply(this, args);
          };
        };
      }

      class TestClass {}

      @logWith(TestClass)
      function withTypeParam(): TestClass {
        return new TestClass();
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-factory-type-param.ts");
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

    expect(transformedCode).toContain("function withTypeParam()");
    expect(transformedCode).toContain(
      "return logWith(TestClass)(function withTypeParam(",
    );
  });

  it("should handle decorator factory with complex argument types", () => {
    const sourceCode = `
      interface Config {
        enabled: boolean;
        options: {
          timeout: number;
          retries: number;
        };
      }

      function logWith(config: Config) {
        return function(target: any) {
          return function(...args: any[]) {
            if (config.enabled) {
              console.log('Config:', config.options);
            }
            return target.apply(this, args);
          };
        };
      }

      @logWith({
        enabled: true,
        options: {
          timeout: 1000,
          retries: 3
        }
      })
      function withComplexConfig(): void {
        console.log('Executing');
      }
    `;

    const fileName = path.resolve(
      process.cwd(),
      "test-factory-complex-args.ts",
    );
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

    expect(transformedCode).toContain("function withComplexConfig()");
    expect(transformedCode).toContain("return logWith({");
    expect(transformedCode).toContain("enabled: true");
    expect(transformedCode).toContain("timeout: 1000");
    expect(transformedCode).toContain("retries: 3");
  });

  it("should not interfere with class decorators when experimentalDecorators is true", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      class TestClass {
        @log
        method() {
          return 'test';
        }

        @log
        async asyncMethod() {
          return 'async test';
        }

        @log
        static staticMethod() {
          return 'static test';
        }
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
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Verify decorators are present in the correct order
    const classDecoratorIndex = transformedCode.indexOf("@log");
    const classIndex = transformedCode.indexOf("class TestClass");
    expect(classDecoratorIndex).toBeLessThan(classIndex);

    const methodDecoratorIndex = transformedCode.indexOf("@log", classIndex);
    const methodIndex = transformedCode.indexOf("method()");
    expect(methodDecoratorIndex).toBeLessThan(methodIndex);

    const asyncMethodDecoratorIndex = transformedCode.indexOf(
      "@log",
      methodIndex,
    );
    const asyncMethodIndex = transformedCode.indexOf("async asyncMethod()");
    expect(asyncMethodDecoratorIndex).toBeLessThan(asyncMethodIndex);

    const staticMethodDecoratorIndex = transformedCode.indexOf(
      "@log",
      asyncMethodIndex,
    );
    const staticMethodIndex = transformedCode.indexOf("static staticMethod()");
    expect(staticMethodDecoratorIndex).toBeLessThan(staticMethodIndex);
  });

  it("should not interfere with class property decorators when experimentalDecorators is true", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]) {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      class TestClass {
        @log
        property: string = 'test';

        @log
        static staticProperty: number = 42;
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
    const transformedSourceFile = transformedProgram.getSourceFile(fileName);
    expect(transformedSourceFile).toBeDefined();

    const printer = ts.createPrinter();
    const transformedCode = printer.printFile(transformedSourceFile!);

    // Verify decorators are present in the correct order
    const classIndex = transformedCode.indexOf("class TestClass");
    const propertyDecoratorIndex = transformedCode.indexOf("@log", classIndex);
    const propertyIndex = transformedCode.indexOf("property: string");
    expect(propertyDecoratorIndex).toBeLessThan(propertyIndex);

    const staticPropertyDecoratorIndex = transformedCode.indexOf(
      "@log",
      propertyIndex,
    );
    const staticPropertyIndex = transformedCode.indexOf(
      "static staticProperty",
    );
    expect(staticPropertyDecoratorIndex).toBeLessThan(staticPropertyIndex);
  });

  it("should handle generator functions with decorators", () => {
    const sourceCode = `
      function log(target: any) {
        return function*(...args: any[]) {
          console.log('Calling generator function with args:', args);
          yield* target.apply(this, args);
        };
      }

      @log
      function* countTo(n: number): Generator<number> {
        for (let i = 1; i <= n; i++) {
          yield i;
        }
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-generator.ts");
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

    // Check for the wrapper generator function with original parameters
    expect(transformedCode).toContain(
      "function* countTo(n: number): Generator<number>",
    );
    // Check for the decorator application wrapping the original generator function
    expect(transformedCode).toContain("return log(function* countTo(");
    // Check that parameters are passed through
    expect(transformedCode).toContain(")(n)");
    // Verify the transformed function maintains generator syntax
    const transformedMatch = /function\* countTo\(n: number\)/.exec(
      transformedCode,
    );
    expect(transformedMatch).toBeTruthy();
    expect(transformedMatch![0]).toBe("function* countTo(n: number)");
  });

  it("should handle generic functions with decorators and preserve type parameters", () => {
    const sourceCode = `
      function log(target: any) {
        return function(...args: any[]): any {
          console.log('Calling function with args:', args);
          return target.apply(this, args);
        };
      }

      @log
      function genericAdd<T>(a: T, b: T): T {
        return a;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-generic-type.ts");
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

    // Check for the wrapper function with type parameter
    expect(transformedCode).toContain("function genericAdd<T>(a: T, b: T): T");
    // Check for the decorator application wrapping the original function with type parameter
    expect(transformedCode).toContain(
      "return log(function genericAdd<T>(a: T, b: T): T",
    );
    // Check that parameters are passed through
    expect(transformedCode).toContain(")(a, b)");
  });

  it("should handle generic decorators applied to generic functions and preserve type parameters", () => {
    const sourceCode = `
      function logWithType<T>(target: any) {
        return function(...args: any[]): any {
          console.log('Type:', typeof args[0]);
          return target.apply(this, args);
        };
      }

      @logWithType<number>
      function identity<T>(value: T): T {
        return value;
      }
    `;

    const fileName = path.resolve(process.cwd(), "test-generic-decorator.ts");
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

    // Check for the wrapper function with type parameter
    expect(transformedCode).toContain("function identity<T>(value: T): T");
    // Check for the decorator application wrapping the original function with type parameter
    expect(transformedCode).toContain(
      "return logWithType<number>(function identity<T>(value: T): T",
    );
    // Check that parameters are passed through
    expect(transformedCode).toContain(")(value)");
  });
});
