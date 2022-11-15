import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { SceanarioUtils } from './utils';

const rootDirName = 'scenarios';
const command = new Command();
command.allowUnknownOption().option('--scenarios <string>', 'Enter Scenario Names', 'all').parse();

const opts = command.opts();
let scenarios = opts.scenarios.split(/[, ]/);

if (scenarios[0] === 'all') {
  scenarios = readdirSync(join(__dirname, rootDirName));
}

describe('Scenarios tests', () => {
  scenarios.forEach((scenario) => {
    describe(`${scenario}`, () => {
      const scenarioDir = join(__dirname, rootDirName, scenario);
      const sceanarios = SceanarioUtils.extractScenarios(scenarioDir);
      sceanarios.forEach((scenario, index) => {
        it(`Scenario ${index}`, () => {
          try {
            const templateEngine = SceanarioUtils.createTemplateEngine(scenarioDir, scenario);
            const result = SceanarioUtils.evaluateScenario(templateEngine, scenario);
            expect(result).toEqual(scenario.output);
          } catch (error: any) {
            expect(error.message).toContain(scenario.error);
          }
        });
      });
    });
  });
});

