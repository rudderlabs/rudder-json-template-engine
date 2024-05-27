import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlatMappingPaths, JsonTemplateEngine, PathType } from '../../src';
import { Scenario } from '../types';

export class ScenarioUtils {
  static createTemplateEngine(scenarioDir: string, scenario: Scenario): JsonTemplateEngine {
    const templatePath = join(scenarioDir, Scenario.getTemplatePath(scenario));
    let template: string | FlatMappingPaths[] = readFileSync(templatePath, 'utf-8');
    if (scenario.containsMappings) {
      template = JSON.parse(template) as FlatMappingPaths[];
    }
    scenario.options = scenario.options || {};
    scenario.options.defaultPathType = scenario.options.defaultPathType || PathType.SIMPLE;
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
