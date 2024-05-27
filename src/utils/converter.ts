import {
  SyntaxType,
  PathExpression,
  ArrayFilterExpression,
  ObjectPropExpression,
  ArrayExpression,
  ObjectExpression,
  FlatMappingAST,
} from '../types';

type OutputObject = {
  [key: string]: {
    [key: string]: OutputObject | ObjectPropExpression[];
  };
};
/**
 * Convert Flat to Object Mappings
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function convertToObjectMapping(flatMappingAST: FlatMappingAST[]): ObjectExpression {
  const outputAST: ObjectExpression = {
    type: SyntaxType.OBJECT_EXPR,
    props: [] as ObjectPropExpression[],
  };

  const outputObject: OutputObject = {};

  for (const flatMapping of flatMappingAST) {
    let currentOutputObject = outputObject;
    let currentOutputAST = outputAST.props;
    let currentInputAST = flatMapping.input;

    const numOutputParts = flatMapping.output.parts.length;
    for (let i = 0; i < numOutputParts; i++) {
      const outputPart = flatMapping.output.parts[i];

      if (outputPart.type === SyntaxType.SELECTOR && outputPart.prop?.value) {
        const key = outputPart.prop.value;

        if (i === numOutputParts - 1) {
          currentOutputAST.push({
            type: SyntaxType.OBJECT_PROP_EXPR,
            key,
            value: currentInputAST,
          } as ObjectPropExpression);
          break;
        }

        const nextOutputPart = flatMapping.output.parts[i + 1] as ArrayFilterExpression;
        const items = [] as ObjectPropExpression[];
        const objectExpr: ObjectExpression = {
          type: SyntaxType.OBJECT_EXPR,
          props: items,
        };

        if (!currentOutputObject[key]) {
          const outputPropAST: ObjectPropExpression = {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key,
            value: objectExpr,
          };

          if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
            const arrayExpr: ArrayExpression = {
              type: SyntaxType.ARRAY_EXPR,
              elements: [],
            };
            arrayExpr.elements[nextOutputPart.filter.indexes.elements[0].value] = objectExpr;
            outputPropAST.value = arrayExpr;
          }

          currentOutputObject[key] = {
            $___items: items,
            $___ast: outputPropAST,
          };
          currentOutputAST.push(outputPropAST);
        }

        if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
          const filterIndex = currentInputAST.parts.findIndex(
            (part) => part.type === SyntaxType.ARRAY_FILTER_EXPR,
          );

          if (filterIndex !== -1) {
            const inputRemainingParts = currentInputAST.parts.splice(filterIndex + 1);
            currentInputAST.returnAsArray = true;
            const outputPropAST = currentOutputObject[key].$___ast as ObjectPropExpression;

            if (outputPropAST.value.type !== SyntaxType.PATH) {
              currentInputAST.parts.push(outputPropAST.value);
              outputPropAST.value = currentInputAST;
            }

            currentInputAST = {
              type: SyntaxType.PATH,
              pathType: currentInputAST.pathType,
              parts: inputRemainingParts,
            } as PathExpression;
          }
        }

        currentOutputAST = currentOutputObject[key].$___items as ObjectPropExpression[];
        currentOutputObject = currentOutputObject[key] as OutputObject;
      }
    }
  }

  return outputAST;
}
