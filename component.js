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
		this.view.content(container, this);
		return this;
	}

	el(name, mods) {
		return this.mods(mods, this.constructor.name + '_' + name);
	}

	mods(mods, className) {
		className = className || this.constructor.name;
		const classes = {[className]: true};

		if (mods) {
			for (let mod in mods) {
				classes[className + '-' + mod] = mods[mod];
			}
		}

		return classes;
	}

	defaults(defaults, options) {
		const result = Object.assign({}, defaults, options);

		for (let key in defaults) {
			if (!DEEP_KEYS.has(key)) {
				continue;
			}

			result[key] = Object.assign({}, defaults[key], options[key]);
		}

		return result;
	}
}
