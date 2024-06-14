import type { EngineOptions } from '../src';

export type Scenario = {
  description?: string;
  input?: unknown;
  templatePath?: string;
  mappingsPath?: string;
  template?: string;
  options?: EngineOptions;
  bindings?: Record<string, unknown> | undefined;
  output?: unknown;
  error?: string;
};

export namespace Scenario {
  export function getTemplatePath(scenario: Scenario): string {
    return scenario.templatePath || scenario.mappingsPath || scenario.template || 'template.jt';
  }
}
