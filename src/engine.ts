import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { EngineOptions, Expression, FlatMappingPaths } from './types';
import { CreateAsyncFunction, convertToObjectMapping } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;

  private constructor(fn: Function) {
    this.fn = fn;
  }

  private static compileAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): Function {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Function(DATA_PARAM_KEY, BINDINGS_PARAM_KEY, this.translate(templateOrExpr, options));
  }

  private static compileAsAsync(
    templateOrExpr: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): Function {
    return CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, options),
    );
  }

  private static translateExpression(expr: Expression): string {
    const translator = new JsonTemplateTranslator(expr);
    return translator.translate();
  }

  static parseMappingPaths(mappings: FlatMappingPaths[], options?: EngineOptions): Expression {
    const flatMappingAST = mappings.map((mapping) => ({
      input: JsonTemplateEngine.parse(mapping.input, options).statements[0],
      output: JsonTemplateEngine.parse(mapping.output, options).statements[0],
    }));
    return convertToObjectMapping(flatMappingAST);
  }

  static create(
    templateOrExpr: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsAsync(templateOrExpr, options));
  }

  static createAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsSync(templateOrExpr, options));
  }

  static parse(template: string, options?: EngineOptions): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer, options);
    return parser.parse();
  }

  static translate(
    template: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): string {
    let templateExpr = template as Expression;
    if (typeof template === 'string') {
      templateExpr = this.parse(template, options);
    } else if (Array.isArray(template)) {
      templateExpr = this.parseMappingPaths(template, options);
    }
    return this.translateExpression(templateExpr);
  }

  evaluate(data: unknown, bindings: Record<string, unknown> = {}): unknown {
    return this.fn(data ?? {}, bindings);
  }
}
