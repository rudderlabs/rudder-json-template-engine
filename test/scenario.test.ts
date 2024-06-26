import { join } from 'path';
import { Command } from 'commander';
import { Scenario } from './types';
import * as ScenarioUtils from './utils';

// Run: npm run test:scenario -- --scenario=arrays --index=1
const command = new Command();
command
  .allowUnknownOption()
  .option('-s, --scenario <string>', 'Enter Scenario Name')
  .option('-i, --index <number>', 'Enter Test case index')
  .parse();

const opts = command.opts();
const scenarioName = opts.scenario || 'arrays';
const index = +(opts.index || 0);

describe(`${scenarioName}:`, () => {
  const scenarioDir = join(__dirname, 'scenarios', scenarioName);
  const scenarios = ScenarioUtils.extractScenarios(scenarioDir);
  const scenario: Scenario = scenarios[index] || scenarios[0];
  const templatePath = Scenario.getTemplatePath(scenario);
  it(`Scenario ${index}: ${templatePath}`, async () => {
    let result;
    try {
      console.log(`Executing scenario: ${scenarioName}, test: ${index}, template: ${templatePath}`);
      result = await ScenarioUtils.evaluateScenario(scenarioDir, scenario);
      expect(result).toEqual(scenario.output);
    } catch (error: any) {
      console.error(error);
      console.log('Actual result', JSON.stringify(result, null, 2));
      console.log('Expected result', JSON.stringify(scenario.output, null, 2));
      expect(error.message).toContain(scenario.error);
    }
  });
});
