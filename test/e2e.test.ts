import { glob } from 'glob';
import path, { join } from 'path';
import { Command } from 'commander';
import { ScenarioUtils } from './utils';
import { Scenario } from './types';

const rootDirName = 'scenarios';
const command = new Command();
command.allowUnknownOption().option('--scenarios <string>', 'Enter Scenario Names', 'all').parse();

const opts = command.opts();
let scenarios = opts.scenarios.split(/[, ]/);

if (scenarios[0] === 'all') {
  scenarios = glob.sync(join(__dirname, rootDirName, '**/data.ts'));
}

describe('Scenarios tests', () => {
  scenarios.forEach((scenarioFileName) => {
    const scenarioDir = path.dirname(scenarioFileName);
    const scenarioName = path.basename(scenarioDir);
    describe(`${scenarioName}`, () => {
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
