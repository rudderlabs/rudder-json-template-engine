Template is a set of statements and result the last statement is the output of the template.

## Variables
```js
const a = 1
let b = a + 2
a + b
```

## Input and Bindings
Input refers to the JSON document we would like to process using a template. Bindings refer to additional data or functions we would provide to process the data efficiently.

Example:
* Template: `"Hello " + (.name ?? $.defaultName)`
* Evaluation: `engine.evaluate({name: 'World'}, {defaultName: 'World'});`
* `{name: 'World'}` is input.
  * `^.name` refers to "name" property of the input. We can also use `.name` to refer the same. `^` always refers to the root of the input and `.` refers to current context. Refer the [example](../test/scenarios/selectors/context_variables.jt) for more clarity.
* `{defaultName: 'World'}` is bindings.
  * `$.defaultName` refers to "defaultName" property of the bindings. Refer the [example](../test/scenarios/bindings/template.jt) for more clarity.

## Arrays
```js
let arr = [1, 2, 3, 4]
let a = arr[1, 2] // [2, 3]
let b = arr[0:2] // [1, 2]
let c = arr[-2:] // [3, 4]
```
Refer the [example](../test/scenarios/arrays/template.jt) for more clarity.

## Objects
```js
let key = "some key"
// { "a": 1, "b": 2, "c": 3, "some key": 4 }
let obj = {a: 1, b: 2, c: 3, [key]: 4 } 
let a = obj["a"] // 1
let b = obj.a // 1
let c = obj{["a", "b"]} // { "a": 1, "b": 2}
let d = obj{~["a", "b"]} // { "c": 3, "some key": 4}
```
Refer the [example](../test/scenarios/objects/template.jt) for more clarity.

## Functions
### Normal functions
```js
let fn = function(arg1, arg2){
  arg1 + arg2
}
```
The result of the last statement of function will be returned as result of the function. We can also use rest params (`...args`).
### Lambda/Short functions
```js
let fn = array.map(lambda 2 * ?0);
```
This function gets converted to:
```js
let fn = array.map(function(args) {
  2 * args[0]
})
```
Lambda functions are short to express the intention and it is convenient sometimes.
### Async functions
```js
let fn = async function(arg1, arg2){
  const result = await doSomethingAsync(arg1, arg2)
  doSomethingSync(result)
}
```
**Note:** When we want to use async functions then we need to create template engine using `JsonTemplateEngine.create`. If you create a template this way then it will be created as an async function so we can `await` anywhere in the template.
```js
let result = await doSomething(.a, .b)
```
## Paths
Paths are used to access properties in `input`, `bindings` and `variables`.
### Simple Paths
Simple paths support limited path features and get translated as direct property access statements in the generate javascript code.
`a.b.c` gets translated to `a?.b?.c` so they are very fast compared to [Rich paths](#rich-paths). Simple paths are ideal when we know the object structure.

**Supported features:**
* [Simple Selectors](#simple-selectors)
* [Single Index Filters](#single-index-or-property-filters)
Refer the [example](../test/scenarios/paths/simple_path.jt) for more clarity.
### Rich Paths
Rich paths gets converted complex code to support different variations in the data.

If we use rich path for expression: `a.b.c` then it automatically following variations.
* `[{"a": { "b": [{"c": 2}]}}]`
* `{"a": { "b": [{"c": 2}]}}`
* `{"a": [{ "b": [{"c": 2}]}]}`
* Automatically handles selection from nested objects and arrays.

#### Simple selectors
```js
let x = a.b.c;
let y = a."some key".c
```
Refer the [example](../test/scenarios/selectors/template.jt) for more clarity.
#### Wildcard selectors
```js
a.*.c // selects c from any direct property of a
```
Refer the [example](../test/scenarios/selectors/wild_cards.jt) for more clarity.
#### Descendent selectors
```js
// selects c from any child property of a
// a.b.c, a.b1.b2.c or a.b1.b2.b3.c
let x = a..c; 
let y = a.."some key";
```
Refer the [example](../test/scenarios/selectors/template.jt) for more clarity.
#### Single Index or Property Filters
```js
let x = a[0].c; 
let y = a[-1].c;  // selects last element from array
let z = a["some key"].c
```
Refer the [example](../test/scenarios/filters/array_filters.jt) for more clarity.
#### Multi Indexes or Properties Filters
```js
let x = a[0, 2, 5].c; 
let y = a["some key1", "some key2"].c;
```
Refer the [example](../test/scenarios/filters/array_filters.jt) for more clarity.
#### Range filters
```js
let x = a[2:5].c; 
let y = a[:-2].c; 
let z = a[2:].c; 
```
#### Object Property Filters
```js
let x = obj{["a", "b"]};  // selects a and b
let y = obj{~["a", "b"]}; // selects all properties except a and b
```
Refer the [example](../test/scenarios/filters/object_indexes.jt) for more clarity.
#### Conditional or Object Filters
```js
let x = obj{.a > 1};
```
Refer the [example](../test/scenarios/filters/object_filters.jt) for more clarity.
#### Block expressions
```js
let x = obj.({
  a: .a + 1,
  b: .b + 2
});
let x = obj.([.a+1, .b+2]);
```
Refer the [example](../test/scenarios/paths/block.jt) for more clarity.

#### Context Variables
```js
.orders@order#idx.products.({
    name: .name,
    price: .price,
    orderNum: idx,
    orderId: order.id
})
```
Use context variables: `@order` and `#idx`, we can combine properties of orders and products together. Refer the [example](../test/scenarios/context_variables/template.jt) for more clarity.
### Path Options
We can mention defaultPathType while creating engine instance.
```js
// For using simple path as default path type
// a.b.c will be treated as simple path
JsonTemplateEngine.create(`a.b.c`, {defaultPathType: PathType.SIMPLE});
// For using rich path as default path type
// a.b.c will be treated as rich path
JsonTemplateEngine.create(`a.b.c`, {defaultPathType: PathType.RICH});
```
We can override the default path option using tags.
```js
// Use ~s to treat a.b.c as simple path
~s a.b.c 
// Use ~r to treat a.b.c as rich path
~r a.b.c
```
**Note:** Rich paths are slower compare to the simple paths.

## Compile time expressions
Compile time expressions are evaluated during compilation phase using compileTimeBindings option.
```js
// {{$.a.b.c}} gets translated to 1 and
// final translated code will be "let a = 1;"
JsonTemplateEngine.create(`let a = {{$.a.b.c}};`, {
  compileTimeBindings: {
    a: {
      b: {
        c: 1
      }
    }
  }
});
```
We can use compile time expressions to generate a template and then recompile it as expression. Refer the [example](../test/scenarios/compile_time_expressions/two_level_path_processing.jt).
