import { EngineOptions, FlatMappingPaths, PathType } from '../src';

export type Scenario = {
  description?: string;
  input?: any;
  templatePath?: string;
  containsMappings?: true;
  options?: EngineOptions;
  bindings?: any;
  output?: any;
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
