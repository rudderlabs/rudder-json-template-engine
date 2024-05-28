import {
  SyntaxType,
  PathExpression,
  ArrayFilterExpression,
  ObjectPropExpression,
  ArrayExpression,
  ObjectExpression,
  FlatMappingAST,
} from '../types';
import { getLastElement } from './common';

function CreateObjectExpression(): ObjectExpression {
  return {
    type: SyntaxType.OBJECT_EXPR,
    props: [] as ObjectPropExpression[],
  };
}
/**
 * Convert Flat to Object Mappings
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function convertToObjectMapping(flatMappingAST: FlatMappingAST[]): ObjectExpression {
  const outputAST: ObjectExpression = CreateObjectExpression();

  for (const flatMapping of flatMappingAST) {
    let currentOutputPropsAST = outputAST.props;
    let currentInputAST = flatMapping.input;

    const numOutputParts = flatMapping.output.parts.length;
    for (let i = 0; i < numOutputParts; i++) {
      const outputPart = flatMapping.output.parts[i];

      if (outputPart.type === SyntaxType.SELECTOR && outputPart.prop?.value) {
        const key = outputPart.prop.value;

        if (i === numOutputParts - 1) {
          currentOutputPropsAST.push({
            type: SyntaxType.OBJECT_PROP_EXPR,
            key,
            value: currentInputAST,
          } as ObjectPropExpression);
          break;
        }

        let currentOutputPropAST = currentOutputPropsAST.find((prop) => prop.key === key);
        let objectExpr: ObjectExpression = CreateObjectExpression();

        if (!currentOutputPropAST) {
          currentOutputPropAST = {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key,
            value: objectExpr,
          };
          currentOutputPropsAST.push(currentOutputPropAST);
        }
        objectExpr = currentOutputPropAST.value as ObjectExpression;

        const nextOutputPart = flatMapping.output.parts[i + 1] as ArrayFilterExpression;
        if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
          const filterIndex = currentInputAST.parts.findIndex(
            (part) => part.type === SyntaxType.OBJECT_FILTER_EXPR,
          );

          if (filterIndex !== -1) {
            const inputRemainingParts = currentInputAST.parts.splice(filterIndex + 1);
            currentInputAST.returnAsArray = true;

            if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
              currentInputAST.parts.push(currentOutputPropAST.value);
              currentOutputPropAST.value = currentInputAST;
            }
            objectExpr = getLastElement(currentOutputPropAST.value.parts) as ObjectExpression;

            currentInputAST = {
              type: SyntaxType.PATH,
              pathType: currentInputAST.pathType,
              parts: inputRemainingParts,
            } as PathExpression;
          }
        }

        if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
          const arrayExpr: ArrayExpression = {
            type: SyntaxType.ARRAY_EXPR,
            elements: [],
          };
          const filterIndex = nextOutputPart.filter.indexes.elements[0].value;
          if (currentOutputPropAST.value.type !== SyntaxType.ARRAY_EXPR) {
            arrayExpr.elements[filterIndex] = objectExpr;
            currentOutputPropAST.value = arrayExpr;
          } else if (!currentOutputPropAST.value.elements[filterIndex]) {
            (currentOutputPropAST.value as ArrayExpression).elements[filterIndex] =
              CreateObjectExpression();
          }
          objectExpr = currentOutputPropAST.value.elements[filterIndex];
        }
        currentOutputPropsAST = objectExpr.props;
      }
    }
  }

  return outputAST;
}
