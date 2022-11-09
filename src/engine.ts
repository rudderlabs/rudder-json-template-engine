import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './contants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';

export class JsonTemplateEngine {
  private readonly fn: Function;
  constructor(template: string) {
    this.fn = JsonTemplateEngine.compile(template);
  }
  private static compile(template: string) {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer);
    const translator = new JsonTemplateTranslator(parser.parse());
    return new Function(DATA_PARAM_KEY, BINDINGS_PARAM_KEY, translator.translate());
  }

  evaluate(data: any, bindings: any = {}) {
    return this.fn(data, bindings);
  }
}
