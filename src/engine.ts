/* eslint-disable import/no-cycle */
import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY, EMPTY_EXPR } from './constants';
import { JsonTemplateMappingError } from './errors/mapping';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateReverseTranslator } from './reverse_translator';
import { JsonTemplateTranslator } from './translator';
import {
  EngineOptions,
  Expression,
  FlatMappingAST,
  FlatMappingPaths,
  PathType,
  SyntaxType,
  TemplateInput,
} from './types';
import { CreateAsyncFunction, convertToObjectMapping, isExpression } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;

  private constructor(fn: Function) {
    this.fn = fn;
  }

  private static compileAsSync(template: TemplateInput, options?: EngineOptions): Function {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Function(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      JsonTemplateEngine.translate(template, options),
    );
  }

  private static compileAsAsync(templateOrExpr: TemplateInput, options?: EngineOptions): Function {
    return CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      JsonTemplateEngine.translate(templateOrExpr, options),
    );
  }

  private static translateExpression(expr: Expression): string {
    const translator = new JsonTemplateTranslator(expr);
    return translator.translate();
  }

  static isValidJSONPath(path: string = ''): boolean {
    try {
      const expression = JsonTemplateEngine.parse(path, { defaultPathType: PathType.JSON });
      const statement = expression.statements?.[0];
      return (
        statement &&
        statement.type === SyntaxType.PATH &&
        (!statement.root || statement.root === DATA_PARAM_KEY)
      );
    } catch (e) {
      return false;
    }
  }

  private static toJsonPath(input): string {
    if (input.startsWith('$')) {
      return input;
    }

    // Check if it's wrapped in quotes
    // or is a simple identifier
    // or contains dots
    if (
      /^'.*'$/.test(input) ||
      /^".*"$/.test(input) ||
      /^[a-zA-Z0-9_]*$/.test(input) ||
      input.includes('.')
    ) {
      return `$.${input}`;
    }

    // If input contains special characters
    return `$.'${input}'`;
  }

  private static convertToJSONPath(path: string, options?: EngineOptions): string {
    if (options?.defaultPathType === PathType.JSON) {
      return JsonTemplateEngine.toJsonPath(path);
    }
    return path;
  }

  private static prepareMapping(mapping: FlatMappingPaths, options?: EngineOptions) {
    return {
      ...mapping,
      input: mapping.input ?? mapping.from,
      output: JsonTemplateEngine.convertToJSONPath(
        (mapping.output ?? mapping.to) as string,
        options,
      ),
    };
  }

  private static prepareMappings(
    mappings: FlatMappingPaths[],
    options?: EngineOptions,
  ): FlatMappingPaths[] {
    return mappings.map((mapping) => JsonTemplateEngine.prepareMapping(mapping, options));
  }

  static validateMappings(mappings: FlatMappingPaths[], options?: EngineOptions) {
    JsonTemplateEngine.prepareMappings(mappings, options).forEach((mapping) => {
      if (!JsonTemplateEngine.isValidJSONPath(mapping.output)) {
        throw new JsonTemplateMappingError(
          'Invalid mapping: invalid JSON path',
          mapping.input as string,
          mapping.output as string,
        );
      }
    });
    JsonTemplateEngine.parseMappingPaths(mappings, options);
  }

  static isValidMapping(mapping: FlatMappingPaths, options?: EngineOptions) {
    try {
      JsonTemplateEngine.validateMappings([mapping], options);
      return true;
    } catch (e) {
      return false;
    }
  }

  private static createFlatMappingsAST(
    mappings: FlatMappingPaths[],
    options?: EngineOptions,
  ): FlatMappingAST[] {
    const newOptions = { ...options, mappings: true };
    return JsonTemplateEngine.prepareMappings(mappings, options)
      .filter((mapping) => mapping.input && mapping.output)
      .map((mapping) => ({
        ...mapping,
        inputExpr: JsonTemplateEngine.parse(mapping.input, newOptions).statements[0],
        outputExpr: JsonTemplateEngine.parse(mapping.output, newOptions).statements[0],
      }));
  }

  static parseMappingPaths(mappings: FlatMappingPaths[], options?: EngineOptions): Expression {
    return convertToObjectMapping(JsonTemplateEngine.createFlatMappingsAST(mappings, options));
  }

  static create(templateOrExpr: TemplateInput, options?: EngineOptions): JsonTemplateEngine {
    return new JsonTemplateEngine(JsonTemplateEngine.compileAsAsync(templateOrExpr, options));
  }

  static createAsSync(template: TemplateInput, options?: EngineOptions): JsonTemplateEngine {
    return new JsonTemplateEngine(JsonTemplateEngine.compileAsSync(template, options));
  }

  static parse(template: TemplateInput, options?: EngineOptions): Expression {
    if (!template) {
      return EMPTY_EXPR;
    }
    if (isExpression(template)) {
      return template as Expression;
    }
    if (typeof template === 'string') {
      const lexer = new JsonTemplateLexer(template);
      const parser = new JsonTemplateParser(lexer, options);
      return parser.parse();
    }
    return JsonTemplateEngine.parseMappingPaths(template as FlatMappingPaths[], options);
  }

  static translate(template: TemplateInput, options?: EngineOptions): string {
    return JsonTemplateEngine.translateExpression(JsonTemplateEngine.parse(template, options));
  }

  static reverseTranslate(expr: Expression | FlatMappingPaths[], options?: EngineOptions): string {
    const translator = new JsonTemplateReverseTranslator(options);
    let newExpr = expr;
    if (Array.isArray(expr)) {
      newExpr = JsonTemplateEngine.parseMappingPaths(expr, options);
    }
    return translator.translate(newExpr as Expression);
  }

  static convertMappingsToTemplate(mappings: FlatMappingPaths[], options?: EngineOptions): string {
    return JsonTemplateEngine.reverseTranslate(
      JsonTemplateEngine.parse(mappings, options),
      options,
    );
  }

  static evaluateAsSync(
    template: TemplateInput,
    options: EngineOptions = {},
    data: unknown = {},
    bindings: Record<string, unknown> = {},
  ): unknown {
    return JsonTemplateEngine.createAsSync(template, options).evaluate(data, bindings);
  }

  static evaluate(
    template: TemplateInput,
    options: EngineOptions = {},
    data: unknown = {},
    bindings: Record<string, unknown> = {},
  ): unknown {
    return JsonTemplateEngine.create(template, options).evaluate(data, bindings);
  }

  evaluate(data: unknown = {}, bindings: Record<string, unknown> = {}): unknown {
    return this.fn(data, bindings);
  }
}
