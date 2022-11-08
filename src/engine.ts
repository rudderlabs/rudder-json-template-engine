import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';

export class JsonTemplateEngine {
  private readonly fn: Function;
  constructor(template: string) {
    this.fn = JsonTemplateEngine.compile(template);
  }
  private static compile(template: string) {
    const parser = new JsonTemplateParser(template);
    const translator = new JsonTemplateTranslator(parser.parse());
    return new Function('data', 'bindings', translator.translate());
  }

  evaluate(data: any, bindings: any = {}) {
    return this.fn(data, bindings);
  }
}
