/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as ts from "typescript/lib/tsserverlibrary";

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

      // Find all decorator symbols in the file
      const decoratorSymbols = new Set<string>();
      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isDecorator(node)) {
          const decoratorText = node.expression.getText(sourceFile);
          // Handle both function calls and simple decorators
          const decoratorName = decoratorText.includes("(")
            ? decoratorText.split("(")[0]
            : decoratorText;
          decoratorSymbols.add(decoratorName);
          console.error(
            `[tsc-decorator-language-service] Found decorator: ${decoratorName}`,
          );
        }
        ts.forEachChild(node, visit);
      });

      // Get the original diagnostics
      const originalDiagnostics =
        languageService.getSemanticDiagnostics(fileName);

      console.error(
        `[tsc-decorator-language-service] Original diagnostics count: ${originalDiagnostics.length}`,
      );
      originalDiagnostics.forEach((d) => {
        const message =
          typeof d.messageText === "string"
            ? d.messageText
            : d.messageText.messageText;
        console.error(
          `[tsc-decorator-language-service] Diagnostic: ${message} (code: ${d.code})`,
        );
      });

      // Filter out decorator-related errors and unused decorator imports
      const filteredDiagnostics = originalDiagnostics.filter((diagnostic) => {
        const message =
          typeof diagnostic.messageText === "string"
            ? diagnostic.messageText
            : diagnostic.messageText.messageText;

        // Filter out decorator errors
        if (message.toLowerCase().includes("decorator")) {
          console.error(
            `[tsc-decorator-language-service] Filtering out decorator error: ${message}`,
          );
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
            console.error(
              `[tsc-decorator-language-service] Checking unused symbol: ${symbolName}, is decorator: ${decoratorSymbols.has(symbolName)}`,
            );
            // Only filter out if the symbol is a decorator
            if (decoratorSymbols.has(symbolName)) {
              console.error(
                `[tsc-decorator-language-service] Filtering out unused decorator: ${symbolName}`,
              );
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

      console.error(
        `[tsc-decorator-language-service] Filtered diagnostics count: ${filteredDiagnostics.length}`,
      );

      return filteredDiagnostics;
    };

    return proxy;
  }

  return { create };
}

export = init;
