# TypeScript Function Decorator Support

A TypeScript transformer that enables function decorators to transform function calls at compile time. This package provides a powerful way to modify function behavior through decorators while maintaining type safety.

## Features

- 🔄 **Function Transformation**: Transform function calls at compile time
- 🔒 **Type Safety**: Full TypeScript support with proper type inference
- 🚀 **Zero Runtime Overhead**: Transformations happen at compile time
- 🛠️ **Customizable**: Create your own decorators with custom transformation logic

## Installation

```bash
npm install -D ts-function-decorator ts-patch
```

## Usage

1. Configure [`ts-patch`](https://github.com/nonara/ts-patch) to enable the transformer.

2. Add the transformer to your `tsconfig.json`:

```json
{
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

2. Use Decorators

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

The decorator will transform the function at compile time to:

```typescript
function example(arg: string): string {
  return log((arg: string) => {
    return arg;
  })(arg);
}
```

## Caveats

This transformer modifies the AST of the program before it is consumed by the compiler/language service. Therefore, if you include this transformer in your `tsconfig.json`, it may cause issues with syntax highlighting in your editor. To fix this, it is best to use one `tsconfig.json` for the project (that is used by your editor), and a `tsconfig.build.json` for the build process.

### `tsconfig.json`

```json
{
  ...
  "compilerOptions": {
    ...
    "plugins": [
      {
        "name": "ts-function-decorator-ls"
      }
    ]
  }
}
```

This will be used automatically by your editor and enable decorators in your editor.

### `tsconfig.build.json`

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

Use this via `tsc -p tsconfig.build.json` to build your project.

## License

Apache-2.0
