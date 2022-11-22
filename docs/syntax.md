Template is a set of statements and result the last statement is the output of the template.

### Variables
```js
const a = 1
let b = a + 2
a + b
```

### Input and Bindings
Input refers to the JSON document we would like to process using a template. Bindings refer to additional data or functions we would provide to process the data efficiently.

Example:
* Template: `"Hello " + (.name ?? $.defaultName)`
* Evaluation: `engine.evaluate({name: 'World'}, {defaultName: 'World'});`
* `{name: 'World'}` is input.
  * `^.name` refers to "name" property of the input. We can also use `.name` to refer the same. `^` always refers to the root of the input and `.` refers to current context. Refer the [example](../test/scenarios/selectors/context_variables.jt) for more clarity.
* `{defaultName: 'World'}` is bindings.
  * `$.defaultName` refers to "defaultName" property of the bindings. Refer the [example](../test/scenarios/bindings/template.jt) for more clarity.

### Arrays
```js
let arr = [1, 2, 3, 4]
let a = arr[1, 2] // [2, 3]
let b = arr[0:2] // [1, 2]
let c = arr[-2:] // [3, 4]
```
Refer the [example](../test/scenarios/arrays/template.jt) for more clarity.

### Objects
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
