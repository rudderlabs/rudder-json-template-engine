import type { EngineOptions } from '../src';

export type Scenario = {
  description?: string;
  input?: unknown;
  templatePath?: string;
  containsMappings?: true;
  options?: EngineOptions;
  bindings?: Record<string, unknown> | undefined;
  output?: unknown;
  error?: string;
};

export namespace Scenario {
  export function getTemplatePath(scenario: Scenario): string {
    if (scenario.templatePath) {
      return scenario.templatePath;
    }
    if (scenario.containsMappings) {
      return 'mappings.json';
    }
    return 'template.jt';
  }
}
