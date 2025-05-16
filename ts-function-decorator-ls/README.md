# TypeScript Function Decorator Language Service Support

A TypeScript language service plugin that provides real-time transformation and IntelliSense support for function decorators in your IDE. This plugin works alongside the TypeScript compiler to provide a seamless development experience when working with function decorators.

## Features

- 🔄 **Real-time Transformation**: See decorator transformations as you type
- 🎯 **IntelliSense Support**: Get accurate type information and autocompletion
- 🔍 **Type Checking**: Real-time type checking for decorated functions
- 🚀 **Zero Configuration**: Works out of the box with minimal setup

## Installation

```bash
npm install -D ts-function-decorator-ls
```

## Usage

1. Configure your IDE to use the workspace version of TypeScript:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

2. Add the language service plugin to your `tsconfig.json`:

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

3. The language service plugin will automatically provide support for function decorators:

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

The plugin will provide:

- Editor support for function decorators
- Type checking for decorated functions
- IntelliSense support for decorator options
- Error reporting for invalid decorator usage

## License

Apache-2.0
