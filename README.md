# Satori

Satori is a minimalistic JavaScript reactive view library. It uses [ES6 Proxies](https://developers.google.com/web/updates/2016/02/es2015-proxies) for data binding, and because [they are not yet ubiquitous](http://caniuse.com/#feat=proxy), *for now* it is mainly useful for [nw.js](http://nwjs.io/) and [Electron](http://electron.atom.io/) applications.

Key features:

 * Unobtrusive — you can keep your model intact. In contrast to non-Proxy solutions, even property additions do not need any special treatment
 * Pure JavaScript [DSL](https://en.wikipedia.org/wiki/Domain-specific_language) makes code reuse more straightforward
 * Expressive — [TodoMVC is only 75 SLOC](https://github.com/yuryshulaev/satori-todomvc) (including most of the markup)
 * It doesn’t dictate you anything — it’s not a framework
 * Tiny — core library is ~700 SLOC, 5 KB gzipped
 * Server-side rendering
 * No dependencies
 * Undo/redo
 * [Fast](#performance)

These qualities also make it useful for quick prototyping — it won’t interfere with your model code, requires almost zero boilerplate and helps you create and reorganize ad hoc components very quickly.

## Getting started

[Download](https://raw.githubusercontent.com/yuryshulaev/satori/master/satori.js) and include the library:

```html
<script src="satori.js"></script>
```

Hello, World:

```javascript
let view = new Satori();
let HelloComponent = name => view.div(['Hello, ', name]);
view.qs('body').appendChild(HelloComponent('World'));
```

But this is just a static element. To make something reactive, first make sure that the root object of your model is wrapped in a proxy:

```javascript
let user = view.proxy({name: 'Mike'});
```

Then just wrap the reactive part in a function:

```javascript
let HelloComponent = user => view.div(['Hello, ', view.span(() => user.name)]);
// >>>                                                      ^^^^^^
view.qs('body').appendChild(HelloComponent(user));
// The content of the <span> will be updated automatically
setTimeout(() => {user.name = 'Joe'}, 1000);
```

## Documentation

### Element content

There are multiple ways to specify element content:

Text:

```javascript
view.div('Hello')
```

One child element:

```javascript
view.div(view.div())
```

Array of elements and/or strings:

```javascript
view.div([view.span(), ' ', view.span()])
```

This method is called under the hood and supports all of the above:

```javascript
view.setElementContent(element, content)
```

### Modifiers

Element modifiers are passed as a first argument to an element factory function:

```javascript
view.div({…}, content)
```

Modifiers are view object methods and can also be applied to any existing DOM elements:

```javascript
view.content(view.qs('.name'), () => user.name)
view.bind(view.qs('.title'), {model: post, key: 'title'})
```

You also can use `assign()` method to apply multiple modifiers at once to an existing element:

```javascript
view.assign(view.qs('.clear-completed'), {
    show: () => model.completed.length,
    on: {click: e => {model.clearCompleted()}},
});
```

All available modifiers are listed below.

#### Content: `content`

Content passed to an element factory is handled as `content` modifier internally.

```javascript
{content: string|Node|[string|Node] | () => string|Node|[string|Node]}
```

Examples:

```javascript
view.div({content: 'Text'})
view.div({content: view.h1('Title')})
view.div({content: [view.strong(10), ' items']})
view.div({content: () => page.text})
```

#### Visibility: `show`

Adds `display: none` style property when the value is false and removes it, when the value is true.

```javascript
{show: bool | () => bool}
```

```javascript
view.div({show: false}, 'Text')
view.div({show: () => items.length}, 'Text')
```

#### CSS classes: `class`

Presence of CSS classes is specified using booleans:

```javascript
{class: string | [string] | {string: bool | () => bool, …}}
```

Single static class:

```javascript
view.div({class: 'active'})
```

Static:

```javascript
view.div({class: ['active']})
view.div({class: {active: true}})
view.div({class: {active: user.active}})
```

Reactive:

```javascript
view.div({class: {active: () => user.active}})
```

#### Attributes: `attr`

```javascript
{attr: {string: string | () => string, …}}
```

```javascript
input({attr: {type: 'checkbox'}})
```

#### Element properties: `prop`

```javascript
{prop: {string: any | () => any, …}}
```

```javascript
{prop: {checked: true}}
{prop: {value: ''}}
```

#### Element data-attributes (dataset): `data`

```javascript
{data: {string: string | () => string, …}}
```

#### Element style properties: `css`

```javascript
{css: {string: string | () => string, …}}
```

```javascript
view.div({css: {'background-color': 'blue'}})
```

#### Event handlers: `on`

Simply calls `addEventHandler()` for each key.

```javascript
{on: {eventType(event) {…}, …}}
```

```javascript
view.div({on: {click() {alert('Click!')}}})
```

#### Keydown event handler: `keydown`

```javascript
{keydown: {[view.Key.*]: (event) => …, …}}
```

```javascript
input({keydown: {[view.Key.ENTER]: el => {alert(el.value)}}})
```

This is more convenient than `switch`, because it can fit in one line and supports inheritance — you can use something like this to create modifications of some base handler set:

```javascript
Object.assign({}, base, {[view.Key.*]: handler, [view.Key.*]: null /* exclude */})
```

#### Two-way data binding: `bind`

The value of the `to` element property gets assigned to the `model[key]` on every event specified in `on`. The opposite happens on every change of `model[key]`. Parameter `to` defaults to `checked` for checkboxes or `'value'` for anything else, and `on` defaults to `['change']`.

```javascript
{bind: {model: proxy, key: string, to: string, on: string|[string]}}
```

```javascript
view.div({bind: {model: proxy, key: 'title', to: 'value', on: ['keydown', 'keyup']}})
```

## Examples

* [TodoMVC](https://github.com/yuryshulaev/satori-todomvc)

## Performance

Satori is very fast. It was built with performance in mind and tries to do only what is essential, so there’s actually not much room left for further optimization of typical operations. It updates the UI asynchronously to make bulk updates faster and reflects array modifications with minimal DOM changes. It shows very good results on the TodoMVC benchmark, but I won’t provide you with them due to its [controversial nature](http://vuejs.org/perf/). In particular, libraries based on virtual DOM, despite performing well in this benchmark, tend to have poor responsiveness when the number of rendered elements is large enough. For instance, simple editing of text in an input field can become irritating because of the delays introduced by rerendering and diffing performed by those libraries on each keystroke.

## Helper functions

 * `qs(selector, scope = document)` — alias for `scope.querySelector(selector)`
 * `qsa(selector, scope = document)` — alias for `scope.querySelectorAll(selector)`
 * `each(selector, scope = document, func)` — call `func` for each element in `querySelectorAll()` result
 * `sortCompare(a, b)` — comparer for sorting numbers and strings, for example: `['b', 'a'].sort(sortCompare)`
 * `arrayRemove(array, value)` — remove first occurrence of `value` from `array`

## Debugging

Enable logging of all flushes and affected observers in console:

```javascript
view.logFlushes = true;
```

Enable logging of all proxy events:

```javascript
view.logEvents = true;
```

Highlight all affected DOM elements:

```javascript
view.highlightUpdates = true;
```

To inspect registered object observers, just explore the `[Symbol(proxyInternals)].observers` property of the proxy object in the developer tools of your browser. Most interesting fields of transactions are `element` and `name`. When you hover the `element` value, the actual element will usually be highlighted if it is visible.

## License

Apache 2.0.
