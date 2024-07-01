import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FlatMappingPaths, JsonTemplateEngine, PathType } from '../../src';
import { Scenario } from '../types';

function getTemplate(scenarioDir: string, scenario: Scenario): string {
  const templatePath = join(scenarioDir, Scenario.getTemplatePath(scenario));
  return readFileSync(templatePath, 'utf-8');
}

function getDefaultPathType(scenario: Scenario): PathType {
  return scenario.mappingsPath || scenario.mappings ? PathType.JSON : PathType.SIMPLE;
}

function initializeScenario(scenarioDir: string, scenario: Scenario) {
  scenario.options = scenario.options || {};
  scenario.options.defaultPathType =
    scenario.options.defaultPathType || getDefaultPathType(scenario);

  if (scenario.mappingsPath) {
    scenario.mappings = JSON.parse(getTemplate(scenarioDir, scenario)) as FlatMappingPaths[];
  }
  if (scenario.mappings) {
    scenario.template = JsonTemplateEngine.convertMappingsToTemplate(
      scenario.mappings as FlatMappingPaths[],
      scenario.options,
    );
  }
  if (scenario.template === undefined) {
    scenario.template = getTemplate(scenarioDir, scenario);
  }
  scenario.template = JsonTemplateEngine.reverseTranslate(
    JsonTemplateEngine.parse(scenario.template, scenario.options),
    scenario.options,
  );
}

export function evaluateScenario(scenarioDir: string, scenario: Scenario): any {
  initializeScenario(scenarioDir, scenario);
  if (scenario.mappingsPath) {
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
