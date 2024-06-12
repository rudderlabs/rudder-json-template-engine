import { JsonTemplateEngine } from '../src/index';

const app = document.querySelector<HTMLDivElement>('#app');

app!.innerHTML = `
    <h1>Rudder Json Template Engine</h1>
    <div>
    <h2>Template:</h2>
    <textarea id="template" placeholder="Enter JSON Template" rows="10" cols="50">.a + .b + .c</textarea>
    </div>
    <div>
    <h2>Data:</h2>
    <textarea id="data" placeholder="Enter JSON data" rows="10" cols="50">{"a": 1, "b": 2, "c": 3}</textarea>
    </div>
    <div>
    <h2>Output:</h2>
    <pre id="output"></pre>
    </div>
`;

function addEventListeners() {
  const template = document.getElementById('template') as HTMLTextAreaElement;
  const data = document.getElementById('data') as HTMLTextAreaElement;
  const output = document.getElementById('output') as HTMLPreElement;
  let timeout: NodeJS.Timeout;

  function evaluate() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      try {
        const result = JsonTemplateEngine.evaluateAsSync(
          template.value,
          {},
          JSON.parse(data.value),
        );
        output!.innerText = JSON.stringify(result, null, 2);
      } catch (e: any) {
        output!.innerText = e.message;
      }
    }, 1000);
  }

  template.addEventListener('input', evaluate);
  data.addEventListener('input', evaluate);
  evaluate();
}

addEventListeners();
