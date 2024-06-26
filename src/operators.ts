import { VARS_PREFIX } from './constants';

function startsWithStrict(val1, val2): string {
  return `(typeof ${val1} === 'string' && ${val1}.startsWith(${val2}))`;
}

function startsWith(val1, val2): string {
  const code: string[] = [];
  code.push(`(typeof ${val1} === 'string' && `);
  code.push(`typeof ${val2} === 'string' && `);
  code.push(`${val1}.toLowerCase().startsWith(${val2}.toLowerCase()))`);
  return code.join('');
}

function endsWithStrict(val1, val2): string {
  return `(typeof ${val1} === 'string' && ${val1}.endsWith(${val2}))`;
}

function endsWith(val1, val2): string {
  const code: string[] = [];
  code.push(`(typeof ${val1} === 'string' && `);
  code.push(`typeof ${val2} === 'string' && `);
  code.push(`${val1}.toLowerCase().endsWith(${val2}.toLowerCase()))`);
  return code.join('');
}

function containsStrict(val1, val2): string {
  return `((typeof ${val1} === 'string' || Array.isArray(${val1})) && ${val1}.includes(${val2}))`;
}

function contains(val1, val2): string {
  const code: string[] = [];
  code.push(`(typeof ${val1} === 'string' && typeof ${val2} === 'string') ?`);
  code.push(`(${val1}.toLowerCase().includes(${val2}.toLowerCase()))`);
  code.push(':');
  code.push(`(Array.isArray(${val1}) && (${val1}.includes(${val2})`);
  code.push(`|| (typeof ${val2} === 'string' && ${val1}.includes(${val2}.toLowerCase()))))`);
  return code.join('');
}

export const binaryOperators = {
  '===': (val1, val2): string => `${val1}===${val2}`,

  '==': (val1, val2): string => {
    const code: string[] = [];
    code.push(`((typeof ${val1} == 'string' && `);
    code.push(`typeof ${val2} == 'string' && `);
    code.push(`${val1}.toLowerCase() == ${val2}.toLowerCase()) || `);
    code.push(`${val1} == ${val2})`);
    return code.join('');
  },

  '>=': (val1, val2): string => `${val1}>=${val2}`,

  '>': (val1, val2): string => `${val1}>${val2}`,

  '<=': (val1, val2): string => `${val1}<=${val2}`,

  '<': (val1, val2): string => `${val1}<${val2}`,

  '!==': (val1, val2): string => `${val1}!==${val2}`,

  '!=': (val1, val2): string => {
    const code: string[] = [];
    code.push(`(typeof ${val1} == 'string' && typeof ${val2} == 'string') ?`);
    code.push(`(${val1}.toLowerCase() != ${val2}.toLowerCase())`);
    code.push(':');
    code.push(`(${val1} != ${val2})`);
    return code.join('');
  },

  '^==': startsWithStrict,

  '==^': (val1, val2): string => startsWithStrict(val2, val1),

  '^=': startsWith,

  '=^': (val1, val2): string => startsWith(val2, val1),

  '$==': endsWithStrict,

  '==$': (val1, val2): string => endsWithStrict(val2, val1),

  '$=': endsWith,

  '=$': (val1, val2): string => endsWith(val2, val1),

  '=~': (val1, val2): string =>
    `(${val2} instanceof RegExp) ? (${val2}.test(${val1})) : (${val1}==${val2})`,

  contains,

  '==*': (val1, val2): string => containsStrict(val1, val2),

  '=*': (val1, val2): string => contains(val1, val2),

  size: (val1, val2): string => `${val1}.length === ${val2}`,

  empty: (val1, val2): string => `(${val1}.length === 0) === ${val2}`,

  subsetof: (val1, val2): string => `${val1}.every((el) => {return ${val2}.includes(el);})`,

  anyof: (val1, val2): string => `${val1}.some((el) => {return ${val2}.includes(el);})`,

  '+': (val1, val2): string => `${val1}+${val2}`,

  '-': (val1, val2): string => `${val1}-${val2}`,

  '*': (val1, val2): string => `${val1}*${val2}`,

  '/': (val1, val2): string => `${val1}/${val2}`,

  '%': (val1, val2): string => `${val1}%${val2}`,

  '>>': (val1, val2): string => `${val1}>>${val2}`,

  '<<': (val1, val2): string => `${val1}<<${val2}`,

  '**': (val1, val2): string => `${val1}**${val2}`,
};

function getSumFn(prefix: string = ''): string {
  return `function ${prefix}sum(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    return arr.reduce((a, b) => a + b, 0); 
  }`;
}

function getAvgFn(prefix: string = ''): string {
  return `function ${prefix}avg(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    ${getSumFn()}
    return sum(arr) / arr.length; 
  }`;
}

export const standardFunctions = {
  sum: getSumFn(VARS_PREFIX),
  max: `function ${VARS_PREFIX}max(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    return Math.max(...arr); 
  }`,
  min: `function ${VARS_PREFIX}min(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    return Math.min(...arr); 
  }`,
  avg: getAvgFn(VARS_PREFIX),
  length: `function ${VARS_PREFIX}length(arr) {
    if(!Array.isArray(arr) && typeof arr !== 'string') {
      throw new Error('Expected an array or string');
    }
     return arr.length; 
    }`,
  stddev: `function ${VARS_PREFIX}stddev(arr) {
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    ${getAvgFn()}
    const mu = avg(arr);
    const diffSq = arr.map((el) => (el - mu) ** 2);
    return Math.sqrt(avg(diffSq));
  }`,
  first: `function ${VARS_PREFIX}first(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    return arr[0]; 
  }`,
  last: `function ${VARS_PREFIX}last(arr) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    return arr[arr.length - 1]; 
  }`,
  index: `function ${VARS_PREFIX}index(arr, i) { 
    if(!Array.isArray(arr)) {
      throw new Error('Expected an array');
    }
    if (i < 0) {
      return arr[arr.length + i];
    }
    return arr[i];
   }`,
  keys: `function ${VARS_PREFIX}keys(obj) { return Object.keys(obj); }`,
};

export function isStandardFunction(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(standardFunctions, name);
}
