import { readFileSync } from 'fs';
import { join } from 'path';
import { JsonTemplateEngine } from '../../src';
import { Scenario } from '../types';

export class ScenarioUtils {
  static createTemplateEngine(scenarioDir: string, sceanario: Scenario): JsonTemplateEngine {
    const templatePath = join(scenarioDir, sceanario.templatePath || 'template.jt');
    const template = readFileSync(templatePath, 'utf-8');
    return JsonTemplateEngine.create(template, sceanario.options);
  }

  static evaluateScenario(templateEngine: JsonTemplateEngine, sceanario: Scenario): any {
    return templateEngine.evaluate(sceanario.input, sceanario.bindings);
  }

  static extractScenarios(scenarioDir: string): Scenario[] {
    const { data } = require(join(scenarioDir, 'data.ts'));
    return data as Scenario[];
  }
}
