# TypeScript Decorator Language Service Plugin

This package provides a TypeScript language service plugin that enables real-time transformation of decorated functions in VSCode. It works alongside the `@gensx/tsc-decorator-transformer` package to provide a seamless development experience.

## Installation

```bash
npm install @gensx/tsc-decorator-language-service
```

## Usage

1. Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@gensx/tsc-decorator-language-service"
      }
    ]
  }
}
```

2. Configure VSCode to use the workspace version of TypeScript:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Features

- Real-time transformation of decorated functions in VSCode
- Type checking and IntelliSense support for transformed code
- Seamless integration with the TypeScript compiler

## Example

```typescript
@decorator
function example(arg: string): string {
  return arg;
}
```

The plugin will transform this code in real-time to:

```typescript
function example(args: string): string {
  return decorator((arg: string) => {
    return arg;
  })(args);
}
```

## License

MIT
