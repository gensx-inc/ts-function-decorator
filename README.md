# TypeScript Function Decorator

A TypeScript ecosystem for enabling and supporting function decorators at compile time and in your IDE. This monorepo contains two packages that work together to provide a complete solution for function decorators in TypeScript:

## Packages

### 1. `ts-function-decorator`

A TypeScript transformer that enables function decorators to transform function calls at compile time. This package provides the core functionality for adding support for function decorators to the Typescript toolchain.

Key features:
- Function transformation at compile time
- Full TypeScript type safety
- Zero runtime overhead
- Customizable decorator creation

### 2. `ts-function-decorator-ls`

A TypeScript language service plugin that provides real-time transformation and IntelliSense support for function decorators in your IDE. This package ensures a seamless development experience when working with function decorators.

Key features:
- Real-time transformation in your editor
- IntelliSense support
- Type checking
- Zero configuration setup

## Installation

Install both packages as dev dependencies:

```bash
npm install -D ts-function-decorator ts-function-decorator-ls ts-patch
```

## Usage

1. Configure your IDE to use the workspace version of TypeScript:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

2. Create two TypeScript configuration files:

### `tsconfig.json` (for IDE support)
```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "ts-function-decorator-ls"
      }
    ]
  }
}
```

### `tsconfig.build.json` (for compilation)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "plugins": [
      {
        "transform": "ts-function-decorator",
        "transformProgram": true
      }
    ]
  }
}
```

3. Use function decorators in your code:

```typescript
// Create a decorator
const log = function (fn: Function) {
  return function (...args: any[]) {
    console.log('Function called with args:', args);
    return fn.apply(this, args);
  };
};

// Use the decorator
@log
function example(arg: string): string {
  return arg;
}
```

4. Build your project using the build configuration:

```bash
tsc -p tsconfig.build.json
```

## How It Works

The two packages work together to provide a complete solution:

1. `ts-function-decorator-ls` enables support for function decorators in your IDE, showing you how your decorators will transform your functions as you type.
2. `ts-function-decorator` performs the actual transformation during compilation, ensuring your decorators work correctly in the final output.

## License

Apache-2.0
