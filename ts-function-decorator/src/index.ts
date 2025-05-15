/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { PluginConfig, ProgramTransformerExtras } from "ts-patch";
import type * as ts from "typescript";

import { TransformationContext } from "typescript";

export default function (
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  _options: PluginConfig,
  { ts: tsInstance }: ProgramTransformerExtras,
) {
  const compilerOptions = program.getCompilerOptions();
  const compilerHost = getPatchedHost(host, tsInstance, compilerOptions);
  const rootFileNames = program.getRootFileNames();

  /* Transform AST */
  const transformedSource = tsInstance.transform(
    /* sourceFiles */ program
      .getSourceFiles()
      .filter((sourceFile) => rootFileNames.includes(sourceFile.fileName)),
    /* transformers */ [transformAst.bind(tsInstance)],
    compilerOptions,
  ).transformed;

  /* Render modified files and create new SourceFiles for them to use in host's cache */
  const printer = tsInstance.createPrinter();
  for (const sourceFile of transformedSource) {
    const { fileName, languageVersion } = sourceFile;
    const updatedSourceFile = tsInstance.createSourceFile(
      fileName,
      printer.printFile(sourceFile),
      languageVersion,
    );
    compilerHost.fileCache.set(fileName, updatedSourceFile);
  }

  /* Re-create Program instance */
  return tsInstance.createProgram(rootFileNames, compilerOptions, compilerHost);
}

function getPatchedHost(
  maybeHost: ts.CompilerHost | undefined,
  tsInstance: typeof ts,
  compilerOptions: ts.CompilerOptions,
): ts.CompilerHost & { fileCache: Map<string, ts.SourceFile> } {
  const fileCache = new Map<string, ts.SourceFile>();
  const compilerHost =
    maybeHost ?? tsInstance.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

  return Object.assign(compilerHost, {
    getSourceFile(fileName: string, _languageVersion: ts.ScriptTarget) {
      if (fileCache.has(fileName)) return fileCache.get(fileName);

      const sourceFile = originalGetSourceFile.apply(
        void 0,
        Array.from(arguments) as any,
      );
      if (!sourceFile) return null;
      fileCache.set(fileName, sourceFile);

      return sourceFile;
    },
    fileCache,
  });
}

function transformAst(this: typeof ts, context: TransformationContext) {
  const tsInstance = this;

  return (sourceFile: ts.SourceFile) => {
    return tsInstance.visitEachChild(sourceFile, visit, context);

    function visit(node: ts.Node): ts.Node | undefined {
      if (tsInstance.isFunctionDeclaration(node)) {
        const decorators = node.modifiers?.filter(
          (m) => m.kind === tsInstance.SyntaxKind.Decorator,
        );

        if (decorators?.length) {
          const originalFunction = node;
          const preservedModifiers = node.modifiers?.filter(
            (m) => m.kind !== tsInstance.SyntaxKind.Decorator,
          );

          // Create the inner function expression
          const innerFunction = context.factory.createFunctionExpression(
            preservedModifiers?.some(
              (m) => m.kind === tsInstance.SyntaxKind.AsyncKeyword,
            )
              ? [
                  context.factory.createToken(
                    tsInstance.SyntaxKind.AsyncKeyword,
                  ),
                ]
              : undefined,
            undefined,
            originalFunction.name
              ? context.factory.createIdentifier(originalFunction.name.text)
              : undefined,
            originalFunction.typeParameters,
            originalFunction.parameters,
            originalFunction.type,
            originalFunction.body ?? context.factory.createBlock([]),
          );

          // Start with the inner function
          let transformedFunction: ts.Expression = innerFunction;

          // Apply decorators from bottom to top
          for (const decorator of decorators.reverse()) {
            if (tsInstance.isDecorator(decorator)) {
              const decoratorExpr = decorator.expression;

              // Get the decorator function and its arguments
              const decoratorFn = tsInstance.isCallExpression(decoratorExpr)
                ? context.factory.createCallExpression(
                    decoratorExpr.expression,
                    undefined,
                    decoratorExpr.arguments,
                  )
                : decoratorExpr;

              // Apply the decorator as a higher-order function
              transformedFunction = context.factory.createCallExpression(
                decoratorFn,
                undefined,
                [transformedFunction],
              );
            }
          }

          // Create a parameter for the args with the same type as the original function's first parameter
          const argsParam = context.factory.createParameterDeclaration(
            undefined,
            undefined,
            "args",
            undefined,
            originalFunction.parameters[0].type,
            undefined,
          );

          // Create the final function declaration that calls the decorated function
          return context.factory.createFunctionDeclaration(
            preservedModifiers,
            undefined,
            originalFunction.name
              ? context.factory.createIdentifier(originalFunction.name.text)
              : undefined,
            originalFunction.typeParameters,
            [argsParam],
            originalFunction.type,
            context.factory.createBlock([
              context.factory.createReturnStatement(
                context.factory.createCallExpression(
                  transformedFunction,
                  undefined,
                  [context.factory.createIdentifier("args")],
                ),
              ),
            ]),
          );
        }
      }

      return tsInstance.visitEachChild(node, visit, context);
    }
  };
}
