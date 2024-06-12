import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlatMappingPaths, JsonTemplateEngine, PathType } from '../../src';
import { Scenario } from '../types';

function getTemplate(scenarioDir: string, scenario: Scenario): string {
  const templatePath = join(scenarioDir, Scenario.getTemplatePath(scenario));
  return readFileSync(templatePath, 'utf-8');
}
function initializeScenario(scenarioDir: string, scenario: Scenario) {
  scenario.options = scenario.options || {};
  scenario.options.defaultPathType = scenario.options.defaultPathType || PathType.SIMPLE;
  let template = scenario.template ?? getTemplate(scenarioDir, scenario);
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

export function evaluateScenario(scenarioDir: string, scenario: Scenario): any {
  initializeScenario(scenarioDir, scenario);
  if (scenario.containsMappings) {
    return JsonTemplateEngine.evaluateAsSync(
      scenario.template,
      scenario.options,
      scenario.input,
      scenario.bindings,
    );
  }
  return JsonTemplateEngine.evaluate(
    scenario.template,
    scenario.options,
    scenario.input,
    scenario.bindings,
  );
}

export function extractScenarios(scenarioDir: string): Scenario[] {
  const { data } = require(join(scenarioDir, 'data.ts'));
  return data as Scenario[];
}
