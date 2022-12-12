import { EngineOptions, PathType } from '../src';

export type Scenario = {
  description?: string;
  input?: any;
  templatePath?: string;
  options?: EngineOptions;
  bindings?: any;
  output?: any;
  error?: string;
};

export namespace Scenario {
  export function getTemplatePath(scenario: Scenario): string {
    return scenario.templatePath || 'template.jt';
  }
}
