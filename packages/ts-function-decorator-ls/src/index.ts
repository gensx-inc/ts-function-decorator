/**
 * @fileoverview
 * This plugin is used to enable support for function decorators in your IDE.
 * It is a TypeScript language service plugin that allows you to see how your decorators will transform your functions as you type.
 *
 * @author [@gensx](https://github.com/gensx)
 * @license Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as ts from "typescript/lib/tsserverlibrary";

// TODO: Error if the decorated thing is not a function
function init(_mod: { typescript: typeof ts }) {
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService } = info;
    const proxy: ts.LanguageService = Object.create(null);

    // Proxy all methods from the original language service
    for (const k of Object.keys(
      languageService,
    ) as (keyof ts.LanguageService)[]) {
      const x = languageService[k];
      if (typeof x === "function") {
        (proxy as any)[k] = function (this: any, ...args: any[]) {
          return (x as any).apply(languageService, args);
        };
      }
    }

    proxy.getSemanticDiagnostics = function (fileName: string) {
      const program = languageService.getProgram();
      if (!program) return [];

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return [];

      // Find all decorator symbols in the file and their parent kinds
      const decoratorSymbols = new Set<string>();
      const decoratorFunctionParents = new Set<ts.Node>();
      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isDecorator(node)) {
          const decoratorText = node.expression.getText(sourceFile);
          // Handle both function calls and simple decorators
          const decoratorName = decoratorText.includes("(")
            ? decoratorText.split("(")[0]
            : decoratorText;
          decoratorSymbols.add(decoratorName);
          // Track if the parent is a function declaration
          if (
            ts.isFunctionDeclaration(node.parent) ||
            ts.isMethodDeclaration(node.parent) ||
            ts.isFunctionExpression(node.parent) ||
            ts.isArrowFunction(node.parent)
          ) {
            decoratorFunctionParents.add(node.parent);
          }
        }
        ts.forEachChild(node, visit);
      });

      // Get the original diagnostics
      const originalDiagnostics =
        languageService.getSemanticDiagnostics(fileName);

      // Filter out decorator-related errors ONLY for function declarations
      const filteredDiagnostics = originalDiagnostics.filter((diagnostic) => {
        const message =
          typeof diagnostic.messageText === "string"
            ? diagnostic.messageText
            : diagnostic.messageText.messageText;

        // Only filter out decorator errors if the error is on a function declaration
        if (
          message.toLowerCase().includes("decorator") &&
          diagnostic.start !== undefined &&
          decoratorFunctionParents.size > 0 &&
          Array.from(decoratorFunctionParents).some(
            (fnNode) =>
              diagnostic.start! >= fnNode.getStart() &&
              diagnostic.start! < fnNode.getEnd(),
          )
        ) {
          return false;
        }

        // Filter out unused decorator imports
        if (
          diagnostic.code === 6133 && // TS6133 is the "declared but never read" error code
          message.includes("is declared but its value is never read")
        ) {
          // Extract the symbol name from the message
          const match = /'([^']+)' is declared/.exec(message);
          if (match) {
            const symbolName = match[1];
            // Only filter out if the symbol is a decorator used on a function
            if (decoratorSymbols.has(symbolName)) {
              return false;
            }
          }
        }

        // Filter out import errors for decorator symbols
        if (
          message.includes("Cannot find module") ||
          message.includes("Module not found")
        ) {
          // Check if any of the imported symbols are used as decorators
          const importMatch = /import\s+.*?{([^}]+)}.*?from/.exec(
            sourceFile.text,
          );
          if (importMatch) {
            const importedSymbols = importMatch[1]
              .split(",")
              .map((s) => s.trim());
            if (
              importedSymbols.some((symbol) => decoratorSymbols.has(symbol))
            ) {
              return false;
            }
          }
        }

        return true;
      });

      return filteredDiagnostics;
    };

    return proxy;
  }

  return { create };
}

export = init;
