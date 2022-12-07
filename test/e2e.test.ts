import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { ScenarioUtils } from './utils';
import { Scenario } from './types';

const rootDirName = 'scenarios';
const command = new Command();
command.allowUnknownOption().option('--scenarios <string>', 'Enter Scenario Names', 'all').parse();

const opts = command.opts();
let scenarios = opts.scenarios.split(/[, ]/);

if (scenarios[0] === 'all') {
  scenarios = readdirSync(join(__dirname, rootDirName));
}

describe('Scenarios tests', () => {
  scenarios.forEach((scenarioName) => {
    describe(`${scenarioName}`, () => {
      const scenarioDir = join(__dirname, rootDirName, scenarioName);
      const scenarios = ScenarioUtils.extractScenarios(scenarioDir);
      scenarios.forEach((scenario, index) => {
        it(`Scenario ${index}: ${Scenario.getTemplatePath(scenario)}`, async () => {
          try {
            const templateEngine = ScenarioUtils.createTemplateEngine(scenarioDir, scenario);
            const result = await ScenarioUtils.evaluateScenario(templateEngine, scenario);
            expect(result).toEqual(scenario.output);
          } catch (error: any) {
            expect(error.message).toContain(scenario.error);
          }
        });
      });
    });
  });
});
