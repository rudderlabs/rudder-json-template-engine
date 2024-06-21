/* eslint-disable no-param-reassign */
import { JsonTemplateMappingError } from '../errors/mapping';
import { EMPTY_EXPR } from '../constants';
import {
  SyntaxType,
  PathExpression,
  ObjectPropExpression,
  ArrayExpression,
  ObjectExpression,
  FlatMappingAST,
  Expression,
  IndexFilterExpression,
  BlockExpression,
  TokenType,
} from '../types';
import { createBlockExpression, getLastElement } from './common';

function createObjectExpression(): ObjectExpression {
  return {
    type: SyntaxType.OBJECT_EXPR,
    props: [] as ObjectPropExpression[],
  };
}

function findOrCreateObjectPropExpression(
  props: ObjectPropExpression[],
  key: string,
): ObjectPropExpression {
  let match = props.find((prop) => prop.key === key);
  if (!match) {
    match = {
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value: createObjectExpression(),
    };
    props.push(match);
  }
  return match;
}

function processArrayIndexFilter(
  currrentOutputPropAST: ObjectPropExpression,
  filter: IndexFilterExpression,
): ObjectExpression {
  const filterIndex = filter.indexes.elements[0].value;
  if (currrentOutputPropAST.value.type !== SyntaxType.ARRAY_EXPR) {
    const elements: Expression[] = [];
    elements[filterIndex] = currrentOutputPropAST.value;
    currrentOutputPropAST.value = {
      type: SyntaxType.ARRAY_EXPR,
      elements,
    };
  } else if (!currrentOutputPropAST.value.elements[filterIndex]) {
    (currrentOutputPropAST.value as ArrayExpression).elements[filterIndex] =
      createObjectExpression();
  }
  return currrentOutputPropAST.value.elements[filterIndex];
}

function processAllFilter(
  flatMapping: FlatMappingAST,
  currentOutputPropAST: ObjectPropExpression,
): ObjectExpression {
  const currentInputAST = flatMapping.inputExpr;
  const filterIndex = currentInputAST.parts.findIndex(
    (part) => part.type === SyntaxType.OBJECT_FILTER_EXPR,
  );

  if (filterIndex === -1) {
    if (currentOutputPropAST.value.type === SyntaxType.OBJECT_EXPR) {
      const currObjectExpr = currentOutputPropAST.value as ObjectExpression;
      currentOutputPropAST.value = {
        type: SyntaxType.PATH,
        root: currObjectExpr,
        pathType: currentInputAST.pathType,
        inferredPathType: currentInputAST.inferredPathType,
        parts: [],
        returnAsArray: true,
      } as PathExpression;
      return currObjectExpr;
    }

    if (
      currentOutputPropAST.value.type === SyntaxType.PATH &&
      currentOutputPropAST.value.parts.length === 0 &&
      currentOutputPropAST.value.root?.type === SyntaxType.OBJECT_EXPR
    ) {
      return currentOutputPropAST.value.root as ObjectExpression;
    }
  } else {
    const matchedInputParts = currentInputAST.parts.splice(0, filterIndex + 1);
    if (
      currentOutputPropAST.value.type === SyntaxType.PATH &&
      currentOutputPropAST.value.parts.length === 0 &&
      currentOutputPropAST.value.root?.type === SyntaxType.OBJECT_EXPR
    ) {
      currentOutputPropAST.value = currentOutputPropAST.value.root;
    }

    if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
      matchedInputParts.push(createBlockExpression(currentOutputPropAST.value));
      currentOutputPropAST.value = {
        type: SyntaxType.PATH,
        root: currentInputAST.root,
        pathType: currentInputAST.pathType,
        inferredPathType: currentInputAST.inferredPathType,
        parts: matchedInputParts,
        returnAsArray: true,
      } as PathExpression;
    }
    currentInputAST.root = undefined;
  }

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as Expression;
  const objectExpr = blockExpr?.statements?.[0] || EMPTY_EXPR;
  if (
    objectExpr.type !== SyntaxType.OBJECT_EXPR ||
    !objectExpr.props ||
    !Array.isArray(objectExpr.props)
  ) {
    throw new JsonTemplateMappingError(
      'Invalid mapping',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
  return objectExpr;
}

function isWildcardSelector(expr: Expression): boolean {
  return expr.type === SyntaxType.SELECTOR && expr.prop?.value === '*';
}

function processWildCardSelector(
  flatMapping: FlatMappingAST,
  currentOutputPropAST: ObjectPropExpression,
  isLastPart: boolean = false,
): ObjectExpression {
  const currentInputAST = flatMapping.inputExpr;
  const filterIndex = currentInputAST.parts.findIndex(isWildcardSelector);

  if (filterIndex === -1) {
    throw new JsonTemplateMappingError(
      'Invalid mapping',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
  const matchedInputParts = currentInputAST.parts.splice(0, filterIndex);
  currentInputAST.parts = currentInputAST.parts.slice(1);
  if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
    matchedInputParts.push(createBlockExpression(currentOutputPropAST.value));
    currentOutputPropAST.value = {
      type: SyntaxType.PATH,
      root: currentInputAST.root,
      pathType: currentInputAST.pathType,
      inferredPathType: currentInputAST.inferredPathType,
      parts: matchedInputParts,
    } as PathExpression;
  }
  currentInputAST.root = 'e.value';

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as BlockExpression;
  const blockObjectExpr = blockExpr.statements[0] as ObjectExpression;
  const objectExpr = createObjectExpression();
  blockObjectExpr.props.push({
    type: SyntaxType.OBJECT_PROP_EXPR,
    key: {
      type: SyntaxType.PATH,
      root: 'e',
      parts: [
        {
          type: SyntaxType.SELECTOR,
          selector: '.',
          prop: {
            type: TokenType.ID,
            value: 'key',
          },
        },
      ],
    },
    value: isLastPart ? currentInputAST : objectExpr,
    contextVar: 'e',
  });
  return objectExpr;
}

function handleNextPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropAST: ObjectPropExpression,
): ObjectExpression | undefined {
  const nextOutputPart = flatMapping.outputExpr.parts[partNum];
  if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
    return processAllFilter(flatMapping, currentOutputPropAST);
  }
  if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
    return processArrayIndexFilter(
      currentOutputPropAST,
      nextOutputPart.filter as IndexFilterExpression,
    );
  }
  if (isWildcardSelector(nextOutputPart)) {
    return processWildCardSelector(
      flatMapping,
      currentOutputPropAST,
      partNum === flatMapping.outputExpr.parts.length - 1,
    );
  }
}

function handleNextParts(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropAST: ObjectPropExpression,
): ObjectExpression {
  let objectExpr = currentOutputPropAST.value as ObjectExpression;
  let newPartNum = partNum;
  while (newPartNum < flatMapping.outputExpr.parts.length) {
    const nextObjectExpr = handleNextPart(flatMapping, newPartNum, currentOutputPropAST);
    if (!nextObjectExpr) {
      break;
    }
    newPartNum++;
    objectExpr = nextObjectExpr;
  }
  return objectExpr;
}

function isOutputPartRegularSelector(outputPart: Expression) {
  return (
    outputPart.type === SyntaxType.SELECTOR &&
    outputPart.prop?.value &&
    outputPart.prop.value !== '*'
  );
}

function refineLeafOutputPropAST(inputExpr: Expression): Expression {
  if (
    inputExpr.type === SyntaxType.PATH &&
    inputExpr.root === undefined &&
    inputExpr.parts.length === 1 &&
    inputExpr.parts[0].type === SyntaxType.BLOCK_EXPR
  ) {
    return inputExpr.parts[0].statements[0];
  }
  return inputExpr;
}

function processFlatMappingPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropsAST: ObjectPropExpression[],
): ObjectPropExpression[] {
  const outputPart = flatMapping.outputExpr.parts[partNum];
  if (!isOutputPartRegularSelector(outputPart)) {
    return currentOutputPropsAST;
  }
  const key = outputPart.prop.value;

  if (partNum === flatMapping.outputExpr.parts.length - 1) {
    currentOutputPropsAST.push({
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value: refineLeafOutputPropAST(flatMapping.inputExpr),
    } as ObjectPropExpression);
    return currentOutputPropsAST;
  }

  const currentOutputPropAST = findOrCreateObjectPropExpression(currentOutputPropsAST, key);
  const objectExpr = handleNextParts(flatMapping, partNum + 1, currentOutputPropAST);
  return objectExpr.props;
}

function handleRootOnlyOutputMapping(flatMapping: FlatMappingAST, outputAST: ObjectExpression) {
  outputAST.props.push({
    type: SyntaxType.OBJECT_PROP_EXPR,
    value: {
      type: SyntaxType.SPREAD_EXPR,
      value: flatMapping.inputExpr,
    },
  } as ObjectPropExpression);
}

function validateMapping(flatMapping: FlatMappingAST) {
  if (flatMapping.outputExpr.type !== SyntaxType.PATH) {
    throw new JsonTemplateMappingError(
      'Invalid mapping: should be a path expression',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
}

function processFlatMappingParts(flatMapping: FlatMappingAST, objectExpr: ObjectExpression) {
  let currentOutputPropsAST = objectExpr.props;
  for (let i = 0; i < flatMapping.outputExpr.parts.length; i++) {
    currentOutputPropsAST = processFlatMappingPart(flatMapping, i, currentOutputPropsAST);
  }
}

/**
 * Convert Flat to Object Mappings
 */
export function convertToObjectMapping(
  flatMappingASTs: FlatMappingAST[],
): ObjectExpression | PathExpression {
  const outputAST: ObjectExpression = createObjectExpression();
  let pathAST: PathExpression | undefined;
  for (const flatMapping of flatMappingASTs) {
    validateMapping(flatMapping);
    let objectExpr = outputAST;
    if (flatMapping.outputExpr.parts.length > 0) {
      if (!isOutputPartRegularSelector(flatMapping.outputExpr.parts[0])) {
        const objectPropExpr = {
          type: SyntaxType.OBJECT_PROP_EXPR,
          key: '',
          value: objectExpr as Expression,
        };
        objectExpr = handleNextParts(flatMapping, 0, objectPropExpr);
        pathAST = objectPropExpr.value as PathExpression;
      }
      processFlatMappingParts(flatMapping, objectExpr);
    } else {
      handleRootOnlyOutputMapping(flatMapping, outputAST);
    }
  }
  return pathAST ?? outputAST;
}
