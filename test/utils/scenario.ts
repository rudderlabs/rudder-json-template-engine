import { readFileSync } from 'fs';
import { join } from 'path';
import { JsonTemplateEngine } from '../../src';
import { Scenario } from '../types';

export class ScenarioUtils {
  static createTemplateEngine(scenarioDir: string, scenario: Scenario): JsonTemplateEngine {
    const templatePath = join(scenarioDir, Scenario.getTemplatePath(scenario));
    const template = readFileSync(templatePath, 'utf-8');
    return JsonTemplateEngine.create(template, scenario.options);
  }

  static evaluateScenario(templateEngine: JsonTemplateEngine, scenario: Scenario): any {
    return templateEngine.evaluate(scenario.input, scenario.bindings);
  }

  static extractScenarios(scenarioDir: string): Scenario[] {
    const { data } = require(join(scenarioDir, 'data.ts'));
    return data as Scenario[];
  }
}
