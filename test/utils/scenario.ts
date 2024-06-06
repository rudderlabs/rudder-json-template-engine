import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlatMappingPaths, JsonTemplateEngine, PathType } from '../../src';
import { Scenario } from '../types';

function initializeScenario(scenarioDir: string, scenario: Scenario) {
  scenario.options = scenario.options || {};
  scenario.options.defaultPathType = scenario.options.defaultPathType || PathType.SIMPLE;
  const templatePath = join(scenarioDir, Scenario.getTemplatePath(scenario));
  let template: string = readFileSync(templatePath, 'utf-8');
  if (scenario.containsMappings) {
    template = JsonTemplateEngine.convertMappingsToTemplate(
      JSON.parse(template) as FlatMappingPaths[],
    );
  }
  scenario.template = JsonTemplateEngine.reverseTranslate(
    JsonTemplateEngine.parse(template, scenario.options),
    scenario.options,
  );
}

export function createTemplateEngine(scenarioDir: string, scenario: Scenario): JsonTemplateEngine {
  initializeScenario(scenarioDir, scenario);
  return JsonTemplateEngine.create(scenario.template as string, scenario.options);
}

export function evaluateScenario(templateEngine: JsonTemplateEngine, scenario: Scenario): any {
  return templateEngine.evaluate(scenario.input, scenario.bindings);
}

export function extractScenarios(scenarioDir: string): Scenario[] {
  const { data } = require(join(scenarioDir, 'data.ts'));
  return data as Scenario[];
}
