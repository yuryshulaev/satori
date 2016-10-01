'use strict'

const DEEP_KEYS = new Set(['class', 'attr', 'prop', 'data', 'css', 'on', 'onCapture', 'keydown', 'keyup']);

class SatoriComponent {
	constructor(view, state) {
		this.view = view;
		const defaultState = this.getDefaultState();
		this.state = view.proxy(defaultState ? Object.assign(defaultState, state) : state);
		this.initialize();
	}

	initialize() {
	}

	render() {
	}

	getDefaultState() {
	}

	mount(container) {
		this.view.content(container, this.render());
		return this;
	}

	el(name, mods) {
		return this.mods(mods, this.constructor.name + '_' + name);
	}

	mods(mods, className) {
		className = className || this.constructor.name;
		const classes = {[className]: true};

		if (mods) {
			Object.keys(mods).forEach(mod => {
				classes[className + '-' + mod] = mods[mod];
			});
		}

		return classes;
	}

	defaults(defaults, options) {
		const result = Object.assign({}, defaults, options);

		for (const key in defaults) {
			if (!DEEP_KEYS.has(key)) {
				continue;
			}

			result[key] = Object.assign({}, defaults[key], options[key]);
		}

		return result;
	}
}
