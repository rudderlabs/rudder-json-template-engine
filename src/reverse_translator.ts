import {
  ArrayExpression,
  ArrayFilterExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockExpression,
  ConditionalExpression,
  DefinitionExpression,
  EngineOptions,
  Expression,
  FunctionCallExpression,
  FunctionExpression,
  IncrementExpression,
  IndexFilterExpression,
  LambdaArgExpression,
  LiteralExpression,
  LoopControlExpression,
  LoopExpression,
  ObjectExpression,
  ObjectFilterExpression,
  ObjectPropExpression,
  PathExpression,
  PathOptions,
  PathType,
  RangeFilterExpression,
  ReturnExpression,
  SelectorExpression,
  SpreadExpression,
  StatementsExpression,
  SyntaxType,
  ThrowExpression,
  TokenType,
  UnaryExpression,
} from './types';
import { translateLiteral } from './utils/transalator';
import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY, EMPTY_EXPR } from './constants';
import { escapeStr } from './utils';

export class JsonTemplateReverseTranslator {
  private options?: EngineOptions;

  constructor(options?: EngineOptions) {
    this.options = options;
  }

  translate(expr: Expression): string {
    switch (expr.type) {
      case SyntaxType.LITERAL:
        return this.translateLiteralExpression(expr as LiteralExpression);
      case SyntaxType.STATEMENTS_EXPR:
        return this.translateStatementsExpression(expr as StatementsExpression);
      case SyntaxType.MATH_EXPR:
      case SyntaxType.COMPARISON_EXPR:
      case SyntaxType.IN_EXPR:
      case SyntaxType.LOGICAL_AND_EXPR:
      case SyntaxType.LOGICAL_OR_EXPR:
      case SyntaxType.LOGICAL_COALESCE_EXPR:
        return this.translateBinaryExpression(expr as BinaryExpression);
      case SyntaxType.ARRAY_EXPR:
        return this.translateArrayExpression(expr as ArrayExpression);
      case SyntaxType.OBJECT_EXPR:
        return this.translateObjectExpression(expr as ObjectExpression);
      case SyntaxType.SPREAD_EXPR:
        return this.translateSpreadExpression(expr as SpreadExpression);
      case SyntaxType.BLOCK_EXPR:
        return this.translateBlockExpression(expr as BlockExpression);
      case SyntaxType.UNARY_EXPR:
        return this.translateUnaryExpression(expr as UnaryExpression);
      case SyntaxType.INCREMENT:
        return this.translateIncrementExpression(expr as IncrementExpression);
      case SyntaxType.PATH:
        return this.translatePathExpression(expr as PathExpression);
      case SyntaxType.CONDITIONAL_EXPR:
        return this.translateConditionalExpression(expr as ConditionalExpression);
      case SyntaxType.DEFINITION_EXPR:
        return this.translateDefinitionExpression(expr as DefinitionExpression);
      case SyntaxType.ASSIGNMENT_EXPR:
        return this.translateAssignmentExpression(expr as AssignmentExpression);
      case SyntaxType.FUNCTION_CALL_EXPR:
        return this.translateFunctionCallExpression(expr as FunctionCallExpression);
      case SyntaxType.FUNCTION_EXPR:
        return this.translateFunctionExpression(expr as FunctionExpression);
      case SyntaxType.THROW_EXPR:
        return this.translateThrowExpression(expr as ThrowExpression);
      case SyntaxType.RETURN_EXPR:
        return this.translateReturnExpression(expr as ReturnExpression);
      case SyntaxType.LOOP_EXPR:
        return this.translateLoopExpression(expr as LoopExpression);
      case SyntaxType.LOOP_CONTROL_EXPR:
        return this.translateLoopControlExpression(expr as LoopControlExpression);
      case SyntaxType.LAMBDA_ARG:
        return this.translateLambdaArgExpression(expr as LambdaArgExpression);
      case SyntaxType.OBJECT_FILTER_EXPR:
        return this.translateObjectFilterExpression(expr as ObjectFilterExpression);
      case SyntaxType.SELECTOR:
        return this.translateSelectorExpression(expr as SelectorExpression);
      case SyntaxType.OBJECT_PROP_EXPR:
        return this.translateObjectPropExpression(expr as ObjectPropExpression);
      case SyntaxType.OBJECT_INDEX_FILTER_EXPR:
        return this.translateObjectIndexFilterExpression(expr as IndexFilterExpression);
      case SyntaxType.ARRAY_FILTER_EXPR:
        return this.translateArrayFilterExpression(expr as ArrayFilterExpression);
      case SyntaxType.ARRAY_INDEX_FILTER_EXPR:
        return this.translateArrayIndexFilterExpression(expr as IndexFilterExpression);
      case SyntaxType.RANGE_FILTER_EXPR:
        return this.translateRangeFilterExpression(expr as RangeFilterExpression);
      default:
        return '';
    }
  }

  translateArrayFilterExpression(expr: ArrayFilterExpression): string {
    return this.translate(expr.filter);
  }

  translateRangeFilterExpression(expr: RangeFilterExpression): string {
    const code: string[] = [];
    code.push('[');
    if (expr.fromIdx) {
      code.push(this.translate(expr.fromIdx));
    }
    code.push(':');
    if (expr.toIdx) {
      code.push(this.translate(expr.toIdx));
    }
    code.push(']');
    return code.join('');
  }

  translateArrayIndexFilterExpression(expr: IndexFilterExpression): string {
    return this.translate(expr.indexes);
  }

  translateObjectIndexFilterExpression(expr: IndexFilterExpression): string {
    const code: string[] = [];
    code.push('{');
    if (expr.exclude) {
      code.push('!');
    }
    code.push(this.translate(expr.indexes));
    code.push('}');
    return code.join('');
  }

  translateSelectorExpression(expr: SelectorExpression): string {
    const code: string[] = [];
    code.push(expr.selector);
    if (expr.prop) {
      if (expr.prop.type === TokenType.STR) {
        code.push(escapeStr(expr.prop.value));
      } else {
        code.push(expr.prop.value);
      }
    }
    return code.join('');
  }

  translateWithWrapper(expr: Expression, prefix: string, suffix: string): string {
    return `${prefix}${this.translate(expr)}${suffix}`;
  }

  translateObjectFilterExpression(expr: ObjectFilterExpression): string {
    if (expr.filter.type === SyntaxType.ALL_FILTER_EXPR) {
      return '[*]';
    }
    if (this.options?.defaultPathType === PathType.JSON) {
      return this.translateWithWrapper(expr.filter, '[?(', ')]');
    }
    return this.translateWithWrapper(expr.filter, '{', '}');
  }

  translateLambdaArgExpression(expr: LambdaArgExpression): string {
    return `?${expr.index}`;
  }

  translateLoopControlExpression(expr: LoopControlExpression): string {
    return expr.control;
  }

  translateLoopExpression(expr: LoopExpression): string {
    const code: string[] = [];
    code.push('for');
    code.push('(');
    if (expr.init) {
      code.push(this.translate(expr.init));
    }
    code.push(';');
    if (expr.test) {
      code.push(this.translate(expr.test));
    }
    code.push(';');
    if (expr.update) {
      code.push(this.translate(expr.update));
    }
    code.push(')');
    code.push('{');
    code.push(this.translate(expr.body));
    code.push('}');
    return code.join(' ');
  }

  translateReturnExpression(expr: ReturnExpression): string {
    return `return ${this.translate(expr.value || EMPTY_EXPR)};`;
  }

  translateThrowExpression(expr: ThrowExpression): string {
    return `throw ${this.translate(expr.value)}`;
  }

  translateExpressions(exprs: Expression[], sep: string): string {
    return exprs.map((expr) => this.translate(expr)).join(sep);
  }

  translateLambdaFunctionExpression(expr: FunctionExpression): string {
    return `lambda ${this.translate(expr.body)}`;
  }

  translateRegularFunctionExpression(expr: FunctionExpression): string {
    const code: string[] = [];
    code.push('function');
    code.push('(');
    if (expr.params && expr.params.length > 0) {
      code.push(expr.params.join(', '));
    }
    code.push(')');
    code.push('{');
    code.push(this.translate(expr.body));
    code.push('}');
    return code.join(' ');
  }

  translateFunctionExpression(expr: FunctionExpression): string {
    if (expr.block) {
      return this.translate(expr.body.statements[0]);
    }
    const code: string[] = [];
    if (expr.async) {
      code.push('async');
    }
    if (expr.lambda) {
      code.push(this.translateLambdaFunctionExpression(expr));
    } else {
      code.push(this.translateRegularFunctionExpression(expr));
    }
    return code.join(' ');
  }

  translateFunctionCallExpression(expr: FunctionCallExpression): string {
    const code: string[] = [];
    if (expr.object) {
      code.push(this.translate(expr.object));
      if (expr.id) {
        code.push(` .${expr.id}`);
      }
    } else if (expr.parent) {
      code.push(this.translatePathRootString(expr.parent, PathType.SIMPLE));
      if (expr.id) {
        code.push(` .${expr.id}`);
      }
    } else if (expr.id) {
      code.push(expr.id);
    }
    code.push('(');
    if (expr.args) {
      code.push(this.translateExpressions(expr.args, ', '));
    }
    code.push(')');
    return code.join('');
  }

  translateAssignmentExpression(expr: AssignmentExpression): string {
    const code: string[] = [];
    code.push(this.translatePathExpression(expr.path));
    code.push(expr.op);
    code.push(this.translate(expr.value));
    return code.join(' ');
  }

  translateDefinitionExpression(expr: DefinitionExpression): string {
    const code: string[] = [];
    code.push(expr.definition);
    if (expr.fromObject) {
      code.push('{ ');
    }
    code.push(expr.vars.join(', '));
    if (expr.fromObject) {
      code.push(' }');
    }
    code.push(' = ');
    code.push(this.translate(expr.value));
    return code.join(' ');
  }

  translateConditionalExpressionBody(expr: Expression): string {
    if (expr.type === SyntaxType.STATEMENTS_EXPR) {
      return this.translateWithWrapper(expr, '{', '}');
    }
    return this.translate(expr);
  }

  translateConditionalExpression(expr: ConditionalExpression): string {
    const code: string[] = [];
    code.push(this.translate(expr.if));
    code.push(' ? ');
    code.push(this.translateConditionalExpressionBody(expr.then));
    if (expr.else) {
      code.push(' : ');
      code.push(this.translateConditionalExpressionBody(expr.else));
    }
    return code.join('');
  }

  translatePathType(pathType: PathType): string {
    switch (pathType) {
      case PathType.JSON:
        return '~j ';
      case PathType.RICH:
        return '~r ';
      case PathType.SIMPLE:
        return '~s ';
      default:
        return '';
    }
  }

  translatePathRootString(root: string, pathType: PathType): string {
    if (root === BINDINGS_PARAM_KEY) {
      return '$';
    }
    if (root === DATA_PARAM_KEY) {
      return pathType === PathType.JSON ? '$' : '^';
    }
    return root;
  }

  translatePathRoot(expr: PathExpression, pathType: PathType): string {
    if (typeof expr.root === 'string') {
      return this.translatePathRootString(expr.root, pathType);
    }
    if (expr.root) {
      const code: string[] = [];
      code.push(this.translate(expr.root));
      if (expr.root.type === SyntaxType.PATH) {
        code.push('.(). ');
      }
      return code.join('');
    }
    return '. ';
  }

  translatePathOptions(options?: PathOptions): string {
    if (!options) {
      return '';
    }
    const code: string[] = [];
    if (options.item) {
      code.push('@');
      code.push(options.item);
    }
    if (options.index) {
      code.push('#');
      code.push(options.index);
    }
    if (options.toArray) {
      code.push('[]');
    }
    return code.join('');
  }

  translatePathParts(parts: Expression[]): string {
    const code: string[] = [];
    if (
      parts.length > 0 &&
      parts[0].type !== SyntaxType.SELECTOR &&
      parts[0].type !== SyntaxType.BLOCK_EXPR
    ) {
      code.push('.');
    }
    for (const part of parts) {
      if (part.type === SyntaxType.BLOCK_EXPR) {
        code.push('.');
      }
      code.push(this.translate(part));
      code.push(this.translatePathOptions(part.options));
    }
    return code.join('');
  }

  translatePathExpression(expr: PathExpression): string {
    const code: string[] = [];
    code.push(this.translatePathType(expr.pathType));
    code.push(this.translatePathRoot(expr, expr.inferredPathType));
    code.push(this.translatePathOptions(expr.options));
    code.push(this.translatePathParts(expr.parts));
    if (expr.returnAsArray) {
      code.push('[]');
    }
    return code.join('');
  }

  translateIncrementExpression(expr: IncrementExpression): string {
    if (expr.postfix) {
      return `${expr.id}${expr.op}`;
    }
    return `${expr.op}${expr.id}`;
  }

  translateUnaryExpression(expr: UnaryExpression): string {
    return `${expr.op} ${this.translate(expr.arg)}`;
  }

  translateBlockExpression(expr: BlockExpression): string {
    const code: string[] = [];
    code.push('(');
    code.push(this.translateExpressions(expr.statements, ';'));
    code.push(')');
    return code.join('');
  }

  translateSpreadExpression(expr: SpreadExpression): string {
    return `...${this.translate(expr.value)}`;
  }

  translateObjectExpression(expr: ObjectExpression): string {
    const code: string[] = [];
    code.push('{\n');
    code.push(this.translateExpressions(expr.props, ',\n'));
    code.push('\n}');
    return code.join('');
  }

  translateObjectPropExpression(expr: ObjectPropExpression): string {
    const code: string[] = [];
    if (expr.key) {
      if (typeof expr.key === 'string') {
        code.push(expr.key);
      } else if (expr.key.type === SyntaxType.LITERAL) {
        code.push(this.translate(expr.key));
      } else {
        code.push(this.translateWithWrapper(expr.key, '[', ']'));
      }
      code.push(': ');
    }
    code.push(this.translate(expr.value));
    return code.join('');
  }

  translateArrayExpression(expr: ArrayExpression): string {
    const code: string[] = [];
    code.push('[');
    code.push(this.translateExpressions(expr.elements, ', '));
    code.push(']');
    return code.join('');
  }

  translateLiteralExpression(expr: LiteralExpression): string {
    return translateLiteral(expr.tokenType, expr.value);
  }

  translateStatementsExpression(expr: StatementsExpression): string {
    return this.translateExpressions(expr.statements, ';\n');
  }

  translateBinaryExpression(expr: BinaryExpression): string {
    const left = this.translate(expr.args[0]);
    const right = this.translate(expr.args[1]);
    return `${left} ${expr.op} ${right}`;
  }
}
