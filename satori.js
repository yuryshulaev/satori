/* Licensed under the Apache License, Version 2.0. © 2016 Yury Shulaev <yury.shulaev@gmail.com> */
'use strict'

class Satori {
	constructor() {
		this.symRaw = Symbol('raw');
		this.symProxyInternals = Symbol('proxyInternals');
		this.proxies = new WeakMap();
		this.stack = [];
		this.dirtyObservers = new Map();
		this.onEvent = new Set();
		this.onElementUpdate = new Set();
		this.highlightUpdate = element => this.highlightElement(element);
		this.logFlushes = false;
		this.logEvents = false;
		this.synchronous = false;
		this.html = this.createTagFactories(this.constructor.TAGS);
		Object.assign(this, this.html);
		this.Key = this.constructor.Key;
	}

	createTagFactories(tags, obj) {
		obj = obj || {};
		tags.forEach(tag => {obj[tag] = (modifiers, content) => this.create(tag, modifiers, content)});
		return obj;
	}

	create(tag, modifiers, content) {
		if (modifiers === null || typeof modifiers !== 'object' || modifiers.constructor !== Object) {
			if (content) {
				throw new Error('Invalid arguments');
			}

			content = modifiers;
			modifiers = {};
		}

		return this.assign(document.createElement(tag), content != null ? Object.assign({content}, modifiers) : modifiers);
	}

	assign(element, modifiers) {
		for (var modifier in modifiers) {
			if (!this[modifier]) {
				throw new Error('Unknown modifier: \'' + modifier + '\'. Did you forget \'attr\'?');
			}

			this[modifier](element, modifiers[modifier], modifiers);
		}

		return element;
	}

	content(element, content) {
		return this.createModifier('content', element, content, this.setElementContent);
	}

	text(element, text) {
		return this.createModifier('text', element, text, (element, text) => element.textContent = text);
	}

	show(element, show) {
		return this.createModifier('show', element, show, (element, show) => {
			if (show) {
				element.style.removeProperty('display');
			} else {
				element.style.setProperty('display', 'none');
			}
		});
	}

	class(element, classes) {
		if (typeof classes !== 'object') {
			element.classList.add(classes);
			return element;
		}

		if (classes instanceof Array) {
			element.classList.add(...classes);
			return element;
		}

		return this.createMultikeyModifier('class', element, classes, (element, cls, value) => {
			element.classList.toggle(cls, !!value)
		});
	}

	attr(element, attrs) {
		return this.createMultikeyModifier('attr', element, attrs, (element, attr, value) => {
			if (value != null && value !== false) {
				element.setAttribute(attr, value);
			} else {
				element.removeAttribute(attr);
			}
		});
	}

	prop(element, props, name) {
		return this.createMultikeyModifier(name || 'prop', element, props, (element, key, value) => {
			if (element[key] !== value && (key !== 'value' && key !== 'textContent' || element !== document.activeElement)) {
				element[key] = value;
			}
		});
	}

	data(element, data) {
		return this.createMultikeyModifier('data', element, data, (element, key, value) => {
			if (value != null) {
				element.dataset[key] = value;
			} else {
				delete element.dataset[key];
			}
		});
	}

	css(element, css) {
		return this.createMultikeyModifier('css', element, css, (element, key, value) => {
			if (value != null) {
				element.style.setProperty(key, value);
			} else {
				element.style.removeProperty(key);
			}
		});
	}

	bind(el, {model, key, to, on, handler}, mods) {
		to = to || (el.getAttribute('type') === 'checkbox' || mods.attr && mods.attr.type === 'checkbox' ? 'checked' : 'value');
		on = on ? (on instanceof Array ? on : [on]) : ['change'];
		this.prop(el, {[to]: () => model[key]}, 'bind');
		let update = () => {model[key] = el[to]};
		on.forEach(eventType => this.on(el, {[eventType]: handler ? event => handler(update, event) : update}));
	}

	on(element, eventHandlers, useCapture) {
		for (let eventType in eventHandlers) {
			let handler = eventHandlers[eventType];

			if (handler) {
				element.addEventListener(eventType, handler, useCapture);
			}
		}

		return element;
	}

	onCapture(element, eventHandlers) {
		return this.on(element, eventHandlers, true);
	}

	keydown(element, keyHandlers) {
		return this.onKeyEvent(element, keyHandlers, 'keydown');
	}

	keyup(element, keyHandlers) {
		return this.onKeyEvent(element, keyHandlers, 'keyup');
	}

	onKeyEvent(element, keyHandlers, eventType) {
		return this.on(element, {
			[eventType](event) {
				let handler = keyHandlers[event.keyCode];

				if (handler) {
					if (handler(element, event) === false) {
						event.preventDefault();
						event.stopPropagation();
					}
				}
			}
		});
	}

	createModifier(name, element, value, apply) {
		if (typeof value !== 'function') {
			apply(element, value);
		} else {
			this.observer(name, () => {
				apply(element, value());
				this.onElementUpdate.forEach(handler => handler(element));
			}, element);
		}

		return element;
	}

	createMultikeyModifier(name, element, data, apply) {
		Object.keys(data).forEach(key => {
			let value = data[key];

			if (typeof value !== 'function') {
				apply(element, key, value);
			} else {
				this.observer(name + '.' + key, () => {
					apply(element, key, value());
					this.onElementUpdate.forEach(handler => handler(element));
				}, element);
			}
		});

		return element;
	}

	observer(name, func, element, keepChildren) {
		let observer = new SatoriObserver(func, this.currentObserver, name, element, keepChildren);
		this.runObserver(observer);
		return observer;
	}

	runObserver(observer) {
		this.stack.push(observer);
		observer.run();
		this.stack.pop();
	}

	get currentObserver() {
		return this.stack.length ? this.stack[this.stack.length - 1] : null;
	}

	addDirtyObserver(observer, event) {
		if (!this.dirtyObservers.size) {
			this.requestFlush();
		}

		this.dirtyObservers.set(observer, event);
		observer.dependencies.add(this.dirtyObservers);
	}

	requestFlush() {
		requestAnimationFrame(() => this.flush());
	}

	flush() {
		if (!this.dirtyObservers.size) {
			return;
		}

		if (this.logFlushes) {
			console.group('flush', this.dirtyObservers.size);
			console.time('flush');
		}

		this.dirtyObservers.forEach((event, observer) => {
			if (this.logFlushes) {
				console.time('observer ' + observer.name);
			}

			this.runObserver(observer);

			if (this.logFlushes) {
				console.timeEnd('observer ' + observer.name);

				if (observer.element) {
					console.log('\t', observer.element);
				}

				console.log('\t', event);
			}
		});

		this.dirtyObservers.clear();

		if (this.logFlushes) {
			console.timeEnd('flush');
			console.groupEnd();
		}
	}

	registerDependency(observers) {
		let observer = this.currentObserver;

		if (!observer) {
			return;
		}

		observers.add(observer);
		observer.dependencies.add(observers);
	}

	event(observers, event, noOnEvent) {
		if (!noOnEvent) {
			this.onEvent.forEach(handler => handler(event));
		}

		if (!observers) {
			return;
		}

		if (this.logEvents) {
			console.group('event', event.prop);
			console.log(event);
		}

		Array.from(observers).forEach(observer => {
			if (this.logEvents) {
				console.log(observer);
			}

			if (this.synchronous) {
				this.runObserver(observer);
			} else {
				this.addDirtyObserver(observer, event);
			}
		});

		if (this.logEvents) {
			console.groupEnd();
		}
	}

	proxy(obj) {
		if (typeof obj !== 'object' || obj === null || obj instanceof Node || obj[this.symRaw]) {
			return obj;
		}

		let proxy = this.proxies.get(obj);

		if (proxy) {
			return proxy;
		}

		proxy = (obj instanceof Array ? this.proxyArray(obj) : this.proxyObject(obj));
		this.proxies.set(obj, proxy);
		return proxy;
	}

	unproxy(obj) {
		return typeof obj !== 'object' || obj === null ? obj : (obj[this.symRaw] || obj);
	}

	proxyAll(array) {
		return array.map(value => this.proxy(value));
	}

	unproxyAll(array) {
		return array.map(value => this.unproxy(value));
	}

	getProxyInternals(obj) {
		return obj[this.symProxyInternals];
	}

	proxyObject(obj) {
		let that = this;
		let proxy;

		let proxyInternals = obj[this.symProxyInternals] = {
			propObservers: new Map(),
			keysObservers: new Set(),

			get(target, prop, proxy) {
				switch (prop) {
					case '__proto__': return target[prop];
					case that.symRaw: return target;
					case that.symProxyInternals: return proxyInternals;
				}

				let observers = this.propObservers.get(prop);

				if (!observers) {
					observers = new Set();
					observers.owner = proxy;
					this.propObservers.set(prop, observers);
				}

				that.registerDependency(observers);
				let descriptor = Object.getOwnPropertyDescriptor(target, prop) ||
				                 Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), prop);
				return that.proxy(descriptor && descriptor.get ? descriptor.get.call(proxy) : target[prop]);
			},

			set(target, prop, value, proxy) {
				let raw = that.unproxy(value);

				if (raw === target[prop]) {
					return true;
				}

				let existed = prop in target;
				let old = target[prop];
				target[prop] = raw;
				that.event(this.propObservers.get(prop), {proxy, prop, value: raw, existed, old});

				if (!existed) {
					that.event(this.keysObservers, {proxy, prop, value: raw}, true);
				}

				return true;
			},

			ownKeys(target) {
				that.registerDependency(this.keysObservers);
				return Object.keys(target);
			},

			deleteProperty(target, prop) {
				let existed = prop in target;
				let old = target[prop];
				let result = delete target[prop];

				if (existed) {
					that.event(this.keysObservers, {proxy, prop, deleteProperty: prop}, true);
					that.event(this.propObservers.get(prop), {proxy, prop, old, deleteProperty: prop});
				}

				return result;
			},

			undo(event) {
				if (event.existed) {
					event.proxy[event.prop] = event.old;
				} else {
					delete event.proxy[event.prop];
				}
			},

			redo(event) {
				if ('deleteProperty' in event) {
					delete event.proxy[event.deleteProperty];
				} else {
					event.proxy[event.prop] = event.value;
				}
			},
		};

		proxy = new Proxy(obj, proxyInternals);
		return proxy;
	}

	proxyArray(obj) {
		let that = this;

		let proxyInternals = obj[this.symProxyInternals] = {
			observers: new Set(),

			event(event) {
				that.event(this.observers, event);
			},

			get(target, prop, proxy) {
				switch (prop) {
					case '__proto__':
					case Symbol.iterator:
						return target[prop];
					case that.symRaw:
						return target;
					case that.symProxyInternals:
						return proxyInternals;
					case 'indexOf':
						that.registerDependency(this.observers);
						return value => target.indexOf(that.unproxy(value));
					case 'slice':
						that.registerDependency(this.observers);
						return (...args) => that.proxy(target.slice(...args));
					case 'map':
					case 'filter':
					case 'forEach':
						that.registerDependency(this.observers);
						return func => target[prop].call(target, (value, i) => func(that.proxy(value), i));
					case 'sort':
						return (...args) => {
							that.registerDependency(this.observers);
							let old = target.slice();
							let result = target[prop].call(target, ...args);
							this.event({proxy, prop, method: prop, old, args});
							return result;
						};
					case 'reverse':
						return (...args) => {
							target[prop].call(target, ...args);
							this.event({proxy, method: prop, prop});
							return proxy;
						};
					case 'push':
					case 'unshift':
						return (...values) => {
							let raw = that.unproxyAll(values);
							let result = target[prop].call(target, ...raw);
							this.event({proxy, prop, method: prop, values: raw});
							return result;
						};
					case 'pop':
					case 'shift':
						return () => {
							that.registerDependency(this.observers);
							let value = target[prop].call(target);
							this.event({proxy, method: prop, prop, value});
							return that.proxy(value);
						};
					case 'splice':
						return (start, count, ...insert) => {
							that.registerDependency(this.observers);
							count = count != null ? count : target.length - start;
							start = Math.min(Math.max(start, 0), target.length);
							count = Math.min(count, target.length - start);
							let raw = that.unproxyAll(insert);
							let removed = that.proxy(target.splice(start, count, ...raw));
							this.event({proxy, prop, method: prop, start, count, insert: raw, removed});
							return removed;
						};
				}

				that.registerDependency(this.observers);
				return that.proxy(target[prop]);
			},

			set(target, prop, value, proxy) {
				let raw = that.unproxy(value);

				if (raw === target[prop]) {
					return true;
				}

				let old = target[prop];
				target[prop] = raw;
				this.event({proxy, prop, value: raw, old});
				return true;
			},

			undo(event) {
				if (!event.method) {
					event.proxy[event.prop] = event.old;
					return;
				}

				switch (event.method) {
					case 'push': event.proxy.pop(); break;
					case 'pop': event.proxy.push(event.value); break;
					case 'unshift': event.proxy.shift(); break;
					case 'shift': event.proxy.unshift(event.value); break;
					case 'splice': event.proxy.splice(event.start, event.insert.length, ...event.removed); break;
					case 'reverse': event.proxy.reverse(); break;
					case 'sort': event.proxy.splice(0, target.length, ...event.old); break;
				}
			},

			redo(event) {
				if (!event.method) {
					event.proxy[event.prop] = event.value;
					return;
				}

				switch (event.method) {
					case 'push': event.proxy.push(...event.values); break;
					case 'pop': event.proxy.pop(); break;
					case 'unshift': event.proxy.unshift(...event.values); break;
					case 'shift': event.proxy.shift(); break;
					case 'splice': event.proxy.splice(event.start, event.count, ...event.insert); break;
					case 'reverse': event.proxy.reverse(); break;
					case 'sort': event.proxy.sort(...event.args); break;
				}
			},
		};

		let proxy = new Proxy(obj, proxyInternals);
		proxyInternals.observers.owner = proxy;
		return proxy;
	}

	undo(event) {
		this.getProxyInternals(event.proxy).undo(event);
	}

	redo(event) {
		this.getProxyInternals(event.proxy).redo(event);
	}

	list(element, {array, item: itemFactory}) {
		let items = new Map();

		this.observer('list', () => {
			let currentArray = array() || [];
			let values = new Set(currentArray);

			if (values.size !== currentArray.length) {
				throw new Error('Duplicate values are not allowed in lists');
			}

			items.forEach((item, proxy) => {
				if (!values.has(proxy)) {
					item.element.remove();
					item.observer.remove();
					items.delete(proxy);
				}
			});

			currentArray.forEach((proxy, i) => {
				let item = items.get(proxy);

				if (item) {
					let actualElement = element.children[i];

					if (!actualElement) {
						element.appendChild(item.element);
					} else if (actualElement !== item.element) {
						element.replaceChild(item.element, actualElement);
					}

					return;
				}

				this.observer('list.item', observer => {
					let itemElement = itemFactory(proxy);
					this.onElementUpdate.forEach(handler => handler(itemElement, element));
					items.set(proxy, {element: itemElement, observer});

					if (!observer.runCount) {
						element.insertBefore(itemElement, element.children[i]);
					} else {
						element.replaceChild(itemElement, observer.element);
					}

					observer.element = itemElement;
				});
			});
		}, element, true);
	}

	setElementContent(element, content) {
		if (content instanceof Array) {
			element.innerHTML = '';

			for (let i = 0, len = content.length; i < len; ++i) {
				let child = content[i];

				if (child == null) {
					continue;
				}

				element.appendChild(child instanceof Node ? child : document.createTextNode(child));
			}
		} else if (content instanceof HTMLElement) {
			element.innerHTML = '';
			element.appendChild(content);
		} else if (content != null) {
			element.textContent = content;
		}
	}

	get highlightUpdates() {
		return this.onElementUpdate.has(this.highlightUpdate);
	}

	set highlightUpdates(value) {
		if (value) {
			this.onElementUpdate.add(this.highlightUpdate);
		} else {
			this.onElementUpdate.delete(this.highlightUpdate);
		}
	}

	highlightElement(element) {
		element.style.setProperty('background-color', this.randomColor());
	}

	throttle(timeout, func) {
		let timer;

		return function () {
			if (timer) {
				return;
			}

			timer = setTimeout(() => {
				func();
				timer = null;
			}, timeout);
		};
	}

	tokens(tokens) {
		return (tokens instanceof Map
			? Array.from(tokens).map(token => token[1] && token[0])
			: Object.keys(tokens).map(token => tokens[token] && token)
		).filter(Boolean).join(' ');
	}

	focus(element) {
		this.flush();
		element.focus();
	}

	inputKeyHandler(func, {noTrim, allowEmpty, reset}) {
		return {
			[this.constructor.Key.ENTER]: el => {
				let value = noTrim ? el.value :  el.value.trim();

				if (!value && !allowEmpty) {
					return false;
				}

				func(value);

				if (reset) {
					el.value = '';
				}

				return false;
			}
		};
	}

	qs(selector, scope) {
		return (scope || document).querySelector(selector);
	}

	qsa(selector, scope) {
		return (scope || document).querySelectorAll(selector);
	}

	each(selector, scope, func) {
		if (arguments.length < 3) {
			func = scope;
			scope = document;
		}

		[].forEach.call(scope.querySelectorAll(selector), func);
	}

	sortCompare(a, b) {
		return a !== b ? +(a > b) || -1 : 0;
	}

	arrayRemove(array, value) {
		let index = array.indexOf(value);

		if (index !== -1) {
			array.splice(index, 1);
		}
	}

	pluralize(word, count) {
		return word + (count !== 1 ? 's' : '');
	}

	randomColor() {
		return 'rgb(' + new Array(3).fill().map(() => Math.round(127 + Math.random() * 128)).join(', ') + ')';
	}
}

Satori.TAGS = ['div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li', 'strong', 'em', 'a', 'p', 'br', 'section',
	'header', 'footer', 'nav', 'article', 'img', 'table', 'tr', 'td', 'hr', 'form', 'fieldset', 'button', 'input',
	'label', 'select', 'option', 'textarea', 'blockquote', 'thead', 'tbody', 'tfoot', 'pre', 'code', 'sub', 'sup',
	'abbr', 'audio', 'video', 'canvas', 'dl', 'dd', 'dt', 'kbd',
];

Satori.Key = {
	ALT: 18, BACKSPACE: 8, COMMA: 188, CONTROL: 17, DELETE: 46, DOWN: 40, END: 35, ENTER: 13, ESCAPE: 27,
	HOME: 36, LEFT: 37, META: 91, MENU: 93, PAGE_DOWN: 34, PAGE_UP: 33, PERIOD: 190, RIGHT: 39, SHIFT: 16,
	SPACE: 32, TAB: 9, UP: 38,
};

class SatoriObserver {
	constructor(func, parent, name, element, keepChildren) {
		this.func = func;
		this.parent = parent;
		this.name = name;
		this.element = element;
		this.dependencies = new Set();
		this.children = new Set();
		this.keepChildren = keepChildren;
		this.runCount = 0;

		if (parent) {
			parent.children.add(this);
		}
	}

	run() {
		this.cleanup(this.keepChildren);
		this.func(this);
		this.runCount++;
	}

	remove() {
		this.cleanup();

		if (this.parent) {
			this.parent.children.delete(this);
		}
	}

	cleanup(keepChildren) {
		this.cleanupDependencies();

		if (!keepChildren) {
			this.cleanupChildren();
		}
	}

	cleanupDependencies() {
		this.dependencies.forEach(dependency => {dependency.delete(this)});
		this.dependencies.clear();
	}

	cleanupChildren() {
		this.children.forEach(child => {child.cleanup()});
		this.children.clear();
	}
}
