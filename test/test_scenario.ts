import { join } from 'path';
import { Command } from 'commander';
import { Sceanario } from './types';
import { SceanarioUtils } from './utils';

const command = new Command();
command
  .allowUnknownOption()
  .option('-s, --scenario <string>', 'Enter Scenario Name')
  .option('-i, --index <number>', 'Enter Test case index')
  .parse();

const opts = command.opts();
const scenarioName = opts.scenario || process.argv[2] || 'assignments';
const index = +(opts.index || process.argv[3] || 0);

console.log(`Executing scenario: ${scenarioName} and test: ${index}`);

function createAndEvaluateTemplate() {
  try {
    const scenarioDir = join(__dirname, 'scenarios', scenarioName);
    const scenarios: Sceanario[] = SceanarioUtils.extractScenarios(scenarioDir);
    const scenario: Sceanario = scenarios[index] || scenarios[0];
    const templateEngine = SceanarioUtils.createTemplateEngine(scenarioDir, scenario);
    const result = SceanarioUtils.evaluateScenario(templateEngine, scenario);
    console.log('Actual result', JSON.stringify(result, null, 2));
    console.log('Expected result', JSON.stringify(scenario.output, null, 2));
  } catch (error) {
    console.error(error);
  }
}

createAndEvaluateTemplate();
