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
  code.push(`(typeof ${val1} === 'string' && `);
  code.push(`typeof ${val2} === 'string' && `);
  code.push(`${val1}.toLowerCase().includes(${val2}.toLowerCase()))`);
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

  '!=': (val1, val2): string => `${val1}!=${val2}`,

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

  contains: containsStrict,

  '==*': (val1, val2): string => containsStrict(val2, val1),

  '=*': (val1, val2): string => contains(val2, val1),

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
