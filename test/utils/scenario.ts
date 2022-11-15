import { readFileSync } from 'fs';
import { join } from 'path';
import { JsonTemplateEngine } from '../../src';
import { Sceanario } from '../types';

export class SceanarioUtils {
  static createTemplateEngine(scenarioDir: string, sceanario: Sceanario): JsonTemplateEngine {
    const templatePath = join(scenarioDir, sceanario.templatePath || 'template.jt');
    const template = readFileSync(templatePath, 'utf-8');
    return new JsonTemplateEngine(template);
  }

  static evaluateScenario(templateEngine: JsonTemplateEngine, sceanario: Sceanario): any {
    return templateEngine.evaluate(sceanario.input, sceanario.bindings);
  }

  static extractScenarios(scenarioDir: string): Sceanario[] {
    const { data } = require(join(scenarioDir, 'data.ts'));
    return data as Sceanario[];
  }
}
