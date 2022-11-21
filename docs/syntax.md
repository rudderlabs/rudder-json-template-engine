Template is a set of statements and result the last statement is the output of the template.

### Variables
```
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
```
let a = [1, 2, 3, 4]
let b = a[1, 2] // [2, 3]
let c = a[0:2] // [1, 2]
let d = a[-2:] // [3, 4]
[b, c, d]
```


