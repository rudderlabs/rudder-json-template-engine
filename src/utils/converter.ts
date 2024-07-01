/* eslint-disable no-param-reassign */
import { JsonTemplateMappingError } from '../errors/mapping';
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
  BinaryExpression,
  PathType,
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
  flatMapping: FlatMappingAST,
  currrentOutputPropAST: ObjectPropExpression,
  filter: IndexFilterExpression,
  isLastPart: boolean,
): ObjectExpression {
  const filterIndex = filter.indexes.elements[0].value;
  if (currrentOutputPropAST.value.type !== SyntaxType.ARRAY_EXPR) {
    const elements: Expression[] = [];
    elements[filterIndex] = isLastPart ? flatMapping.inputExpr : currrentOutputPropAST.value;
    currrentOutputPropAST.value = {
      type: SyntaxType.ARRAY_EXPR,
      elements,
    };
  } else if (!currrentOutputPropAST.value.elements[filterIndex]) {
    (currrentOutputPropAST.value as ArrayExpression).elements[filterIndex] = isLastPart
      ? flatMapping.inputExpr
      : createObjectExpression();
  }
  return currrentOutputPropAST.value.elements[filterIndex];
}

function isPathWithEmptyPartsAndObjectRoot(expr: Expression) {
  return (
    expr.type === SyntaxType.PATH &&
    expr.parts.length === 0 &&
    expr.root?.type === SyntaxType.OBJECT_EXPR
  );
}

function getPathExpressionForAllFilter(
  currentInputAST: Expression,
  root: any,
  parts: Expression[] = [],
): PathExpression {
  return {
    type: SyntaxType.PATH,
    root,
    pathType: currentInputAST.pathType || PathType.UNKNOWN,
    inferredPathType: currentInputAST.inferredPathType || PathType.UNKNOWN,
    parts,
    returnAsArray: true,
  } as PathExpression;
}

function validateResultOfAllFilter(
  objectExpr: Expression | undefined,
  flatMapping: FlatMappingAST,
) {
  if (
    !objectExpr?.props ||
    objectExpr.type !== SyntaxType.OBJECT_EXPR ||
    !Array.isArray(objectExpr.props)
  ) {
    throw new JsonTemplateMappingError(
      'Invalid mapping: invalid array mapping',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
}

function addToArrayToExpression(expr: Expression) {
  return {
    type: SyntaxType.PATH,
    root: expr,
    returnAsArray: true,
    parts: [],
  };
}

function handleAllFilterIndexFound(
  currentInputAST: Expression,
  currentOutputPropAST: ObjectPropExpression,
  filterIndex: number,
  isLastPart: boolean,
) {
  const matchedInputParts = currentInputAST.parts.splice(0, filterIndex + 1);
  if (isPathWithEmptyPartsAndObjectRoot(currentOutputPropAST.value)) {
    currentOutputPropAST.value = currentOutputPropAST.value.root;
  }

  if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
    matchedInputParts.push(
      createBlockExpression(isLastPart ? currentInputAST : currentOutputPropAST.value),
    );
    currentOutputPropAST.value = getPathExpressionForAllFilter(
      currentInputAST,
      currentInputAST.root,
      matchedInputParts,
    );
  }
  currentInputAST.root = undefined;
}

function findAllFilterIndex(expr: Expression): number {
  let filterIndex = -1;
  if (expr.type === SyntaxType.PATH) {
    filterIndex = expr.parts.findIndex((part) => part.type === SyntaxType.OBJECT_FILTER_EXPR);
  }
  return filterIndex;
}

function handleAllFilterIndexNotFound(
  currentInputAST: Expression,
  currentOutputPropAST: ObjectPropExpression,
  isLastPart: boolean,
): ObjectExpression | undefined {
  if (currentOutputPropAST.value.type === SyntaxType.OBJECT_EXPR) {
    const currObjectExpr = currentOutputPropAST.value as ObjectExpression;
    currentOutputPropAST.value = isLastPart
      ? addToArrayToExpression(currentInputAST)
      : getPathExpressionForAllFilter(currentInputAST, currObjectExpr);
    return currObjectExpr;
  }
  if (isPathWithEmptyPartsAndObjectRoot(currentOutputPropAST.value)) {
    return currentOutputPropAST.value.root as ObjectExpression;
  }
}

function getNextObjectExpressionForAllFilter(
  flatMapping: FlatMappingAST,
  currentOutputPropAST: ObjectPropExpression,
  isLastPart: boolean,
) {
  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as Expression;
  const objectExpr = isLastPart ? createObjectExpression() : blockExpr?.statements?.[0];
  validateResultOfAllFilter(objectExpr, flatMapping);
  return objectExpr;
}

function processAllFilter(
  flatMapping: FlatMappingAST,
  currentOutputPropAST: ObjectPropExpression,
  isLastPart: boolean,
): ObjectExpression {
  const { inputExpr: currentInputAST } = flatMapping;
  const filterIndex = findAllFilterIndex(currentInputAST);
  if (filterIndex === -1) {
    const objectExpr = handleAllFilterIndexNotFound(
      currentInputAST,
      currentOutputPropAST,
      isLastPart,
    );
    if (objectExpr) {
      return objectExpr;
    }
  } else {
    handleAllFilterIndexFound(currentInputAST, currentOutputPropAST, filterIndex, isLastPart);
  }
  return getNextObjectExpressionForAllFilter(flatMapping, currentOutputPropAST, isLastPart);
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
      'Invalid mapping: input should have wildcard selector',
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
    const objectExpr = processAllFilter(
      flatMapping,
      currentOutputPropAST,
      partNum === flatMapping.outputExpr.parts.length - 1 && !nextOutputPart.options?.index,
    );
    if (nextOutputPart.options?.index) {
      objectExpr.props.push({
        type: SyntaxType.OBJECT_PROP_EXPR,
        key: nextOutputPart.options?.index,
        value: {
          type: SyntaxType.PATH,
          root: nextOutputPart.options?.index,
          parts: [],
        },
      });
    }
    return objectExpr;
  }
  if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
    return processArrayIndexFilter(
      flatMapping,
      currentOutputPropAST,
      nextOutputPart.filter as IndexFilterExpression,
      partNum === flatMapping.outputExpr.parts.length - 1,
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

function handleLastOutputPart(
  flatMapping: FlatMappingAST,
  currentOutputPropsAST: ObjectPropExpression[],
  key: string,
) {
  const outputPropAST = currentOutputPropsAST.find((prop) => prop.key === key);
  if (!outputPropAST) {
    currentOutputPropsAST.push({
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value: refineLeafOutputPropAST(flatMapping.inputExpr),
    } as ObjectPropExpression);
  } else {
    outputPropAST.value = {
      type: SyntaxType.LOGICAL_OR_EXPR,
      op: '||',
      args: [outputPropAST.value, refineLeafOutputPropAST(flatMapping.inputExpr)],
    } as BinaryExpression;
  }
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
    handleLastOutputPart(flatMapping, currentOutputPropsAST, key);
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

function validateMappingsForIndexVar(flatMapping: FlatMappingAST, indexVar: string) {
  if (flatMapping.inputExpr.type !== SyntaxType.PATH) {
    throw new JsonTemplateMappingError(
      'Invalid mapping: input should be path expression',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
  const foundIndexVar = flatMapping.inputExpr.parts.some(
    (item) =>
      item?.type === SyntaxType.OBJECT_FILTER_EXPR &&
      item.filter.type === SyntaxType.ALL_FILTER_EXPR &&
      item.options?.index === indexVar,
  );
  if (!foundIndexVar) {
    throw new JsonTemplateMappingError(
      `Invalid mapping: index variable:${indexVar} not found in input path`,
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
}

function validateMapping(flatMapping: FlatMappingAST) {
  if (flatMapping.outputExpr.type !== SyntaxType.PATH) {
    throw new JsonTemplateMappingError(
      'Invalid mapping: output should be a path expression',
      flatMapping.input as string,
      flatMapping.output as string,
    );
  }
  const lastPart = getLastElement(flatMapping.outputExpr.parts);
  if (lastPart?.options?.index) {
    validateMappingsForIndexVar(flatMapping, lastPart.options.index);
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
          value: pathAST || objectExpr,
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
