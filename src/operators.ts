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
  return `(typeof ${val1} === 'string' && ${val1}.includes(${val2}))`;
}

function contains(val1, val2): string {
  const code: string[] = [];
  code.push(`(typeof ${val1} === 'string' && `);
  code.push(`typeof ${val2} === 'string' && `);
  code.push(`${val1}.toLowerCase().includes(${val2}.toLowerCase()))`);
  return code.join('');
}

export const binaryOperators = {
  '===': function (val1, val2): string {
    return `${val1}===${val2}`;
  },

  '==': function (val1, val2): string {
    const code: string[] = [];
    code.push(`((typeof ${val1} == 'string' && `);
    code.push(`typeof ${val2} == 'string' && `);
    code.push(`${val1}.toLowerCase() == ${val2}.toLowerCase()) || `);
    code.push(`${val1} == ${val2})`);
    return code.join('');
  },

  '>=': function (val1, val2): string {
    return `${val1}>=${val2}`;
  },

  '>': function (val1, val2): string {
    return `${val1}>${val2}`;
  },

  'i==': {},
  '<=': function (val1, val2): string {
    return `${val1}<=${val2}`;
  },

  '<': function (val1, val2): string {
    return `${val1}<${val2}`;
  },

  '!==': function (val1, val2): string {
    return `${val1}!==${val2}`;
  },

  '!=': function (val1, val2): string {
    return `${val1}!=${val2}`;
  },

  '^==': startsWithStrict,

  '==^': function (val1, val2): string {
    return startsWithStrict(val2, val1);
  },

  '^=': startsWith,

  '=^': function (val1, val2): string {
    return startsWith(val2, val1);
  },

  '$==': endsWithStrict,

  '==$': function (val1, val2): string {
    return endsWithStrict(val2, val1);
  },

  '$=': endsWith,

  '=$': function (val1, val2): string {
    return endsWith(val2, val1);
  },

  '==*': function (val1, val2): string {
    return containsStrict(val2, val1);
  },

  '=*': function (val1, val2): string {
    return contains(val2, val1);
  },

  '+': function (val1, val2): string {
    return `${val1}+${val2}`;
  },

  '-': function (val1, val2): string {
    return `${val1}-${val2}`;
  },

  '*': function (val1, val2): string {
    return `${val1}*${val2}`;
  },

  '/': function (val1, val2): string {
    return `${val1}/${val2}`;
  },

  '%': function (val1, val2): string {
    return `${val1}%${val2}`;
  },

  '>>': function (val1, val2): string {
    return `${val1}>>${val2}`;
  },

  '<<': function (val1, val2): string {
    return `${val1}<<${val2}`;
  },

  '**': function (val1, val2): string {
    return `${val1}**${val2}`;
  },
};
