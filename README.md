# Satori

Satori is a minimalistic JavaScript reactive view library that uses [ES6 Proxies](https://developers.google.com/web/updates/2016/02/es2015-proxies) for data binding ([browser support](http://caniuse.com/#feat=proxy)).

Key features:

 * Unobtrusive — you can keep your model intact. In contrast to non-Proxy solutions, even property additions do not need any special treatment
 * Pure JavaScript [DSL](https://en.wikipedia.org/wiki/Domain-specific_language) makes code reuse more straightforward
 * Expressive — [TodoMVC is only 75 SLOC](#examples) (including most of the markup)
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
const view = new Satori();
const h = view.h;
const HelloView = name => h('div', null, ['Hello, ', name]);
view.qs('body').appendChild(HelloView('World'));
```

But this is just a static element. To make something reactive, first make sure that the root object of your model is wrapped in a proxy:

```javascript
const user = view.proxy({name: 'Mike'});
```

Then just wrap the reactive part in a function:

```javascript
const HelloView = user => h('div', null, ['Hello, ', h('span', null, () => user.name)]);
view.qs('body').appendChild(HelloView(user));
// The content of the <span> will be updated automatically
setTimeout(() => {user.name = 'Joe'}, 1000);
```

Reactivity is based primarily on registering property accesses via proxies, so the properties you want observed have to be accessed inside the wrapper function. This means you can’t just write `() => name` — that would be static. Also, you can’t make reactive text nodes — you must have an element. This is why we added a `<span>` here.

## Documentation

### Element factory

DOM elements are created using the element factory method:

```javascript
h(tagName, modifiers, content): Element
```

### Element content

There are multiple ways to specify the element content:

 * Text:

 ```javascript
 h('div', null, 'Hello')
 ```

 * One child element:

 ```javascript
 h('div', null, h('div'))
 ```

 * Array of elements and/or strings:

 ```javascript
 h('div', null, [h('span'), ' ', h('span')])
 ```

The `view.setElementContent()` method is called under the hood and supports all of the above:

```javascript
view.setElementContent(element, content)
```

### Modifiers

Element modifiers are passed as the second argument to the element factory:

```javascript
h('div', {…}, content)
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
    on: {click: () => {model.clearCompleted()}},
});
```

All available modifiers are listed below.

#### Content: `content`

Content passed to the element factory is handled as `content` modifier internally.

```javascript
{content: string|Node|[string|Node] | () => string|Node|[string|Node]}
```

Examples:

```javascript
h('div', {content: 'Text'})
h('div', {content: h('h1', null, 'Title')})
h('div', {content: [h('strong', null, 10), ' items']})
h('div', {content: () => page.text})
```

#### Visibility: `show`

Adds `display: none` style property when the value is false and removes it, when the value is true.

```javascript
{show: bool | () => bool}
```

```javascript
h('div', {show: false}, 'Text')
h('div', {show: () => items.length}, 'Text')
```

#### CSS classes: `class`

Presence of CSS classes is specified using booleans:

```javascript
{class: string | [string] | {string: bool | () => bool, …}}
```

Single static class:

```javascript
h('div', {class: 'active'})
```

Static:

```javascript
h('div', {class: ['active']})
h('div', {class: {active: true}})
h('div', {class: {active: user.active}})
```

Reactive:

```javascript
h('div', {class: {active: () => user.active}})
```

#### Attributes: `attr`

```javascript
{attr: {string: string | () => string, …}}
```

```javascript
h('input', {attr: {type: 'checkbox'}})
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
h('div', {css: {'background-color': 'blue'}})
```

#### Event handlers: `on`

Simply calls `addEventHandler()` for each key.

```javascript
{on: {eventType(event) {…}, …}}
```

```javascript
h('div', {on: {click() {alert('Click!')}}})
```

#### Capturing event handlers: `onCapture`

For capturing handlers use `onCapture` modifier instead of `on`:

```javascript
{onCapture: {eventType(event) {…}, …}}
```

#### Keyboard event handler: `keydown`, `keyup`

```javascript
{keydown: {[view.Key.*]: (element, event) => …, …}}
{keyup: {[view.Key.*]: (element, event) => …, …}}
```

```javascript
h('input', {keydown: {
	[view.Key.ENTER]: el => {alert(el.value)},
	[view.Key.ESCAPE]: () => {alert('Esc')},
}})
```

#### Two-way data binding: `bind`

The value of the `to` element property gets assigned to the `model[key]` on every event specified in `on`. The opposite happens on every change of `model[key]`. Parameter `to` defaults to `'checked'` for checkboxes or `'value'` for anything else, and `on` defaults to `['change']`.

```javascript
{bind: {model: proxy, key: string, to: string, on: string|[string]}}
```

```javascript
h('input', {bind: {model: proxy, key: 'title', to: 'value', on: ['keydown', 'keyup']}})
```

## Examples

* [Component TodoMVC](https://github.com/yuryshulaev/satori-component-todomvc)
* [MVVM TodoMVC](https://github.com/yuryshulaev/satori-todomvc) (75 SLOC)

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

To inspect registered object observers, just explore the `[Symbol(proxyInternals)].observers` property of the proxy object in the developer tools of your browser. Most interesting observer fields are `element` and `name`. When you hover the `element` value, the actual element will usually be highlighted if it is visible.

## License

Apache 2.0.
