'use strict'

const assert = chai.assert;

describe('Satori', function () {
	let view;
	let h;
	let model;
	let array;
	let container;
	let root;

	function trackUpdates(func, expected) {
		const updates = [];

		function onElementUpdate(element) {
			updates.push(element);
		}

		view.onElementUpdate.add(onElementUpdate);
		func();
		view.onElementUpdate.delete(onElementUpdate);
		return updates;
	}

	beforeEach(function () {
		const rawModel = {
			id: 0,
			title: 'First',
			text: 'Text',
			tags: ['One', 'Two'],
			isPublished: false,
		};

		const rawArray = [rawModel, {id: 1, title: 'Second', text: 'Content'}, {id: 2, title: 'Third', text: 'Content'}];
		view = new Satori(window);
		h = view.h;
		view.synchronous = true;
		model = view.proxy(rawModel);
		array = view.proxy(rawArray);
		container = view.proxy({array});
		root = document.getElementById('test-root');
		root.innerHTML = '';
	});

	describe('create', function () {
		it('should create element with text', function () {
			root.appendChild(h('h1', null, model.title));
			assert.equal(root.innerHTML, '<h1>First</h1>');
		});

		it('should create element with children', function () {
			root.appendChild(h('h1', null, [h('span', null, model.title), h('span', null, 'Test')]));
			assert.equal(root.innerHTML, '<h1><span>First</span><span>Test</span></h1>');
		});

		it('should create element with class', function () {
			root.appendChild(h('h1', {class: 'header'}, model.title));
			assert.equal(root.innerHTML, '<h1 class="header">First</h1>');
		});

		it('should create element with class using object, true', function () {
			root.appendChild(h('h1', {class: {header: true}}, model.title));
			assert.equal(root.innerHTML, '<h1 class="header">First</h1>');
		});

		it('should create element with class using object, false', function () {
			root.appendChild(h('h1', {class: {title: true, header: false}}, model.title));
			assert.equal(root.innerHTML, '<h1 class="title">First</h1>');
		});

		it('should create element with attribute', function () {
			root.appendChild(h('h1', {attr: {id: 'header'}}, model.title));
			assert.equal(root.innerHTML, '<h1 id="header">First</h1>');
		});

		it('should create element with data', function () {
			root.appendChild(h('h1', {data: {a: 123}}, model.title));
			assert.equal(root.innerHTML, '<h1 data-a="123">First</h1>');
		});

		it('should create element with CSS', function () {
			root.appendChild(h('h1', {css: {color: 'blue'}}, model.title));
			assert.equal(root.innerHTML, '<h1 style="color: blue;">First</h1>');
		});

		it('should bind event handler', function () {
			let clicked = false;
			const header = h('h1', {on: {click: () => {clicked = true}}}, () => model.title);
			root.appendChild(header);
			header.click();
			assert.equal(root.innerHTML, '<h1>First</h1>');
			assert.equal(clicked, true);
		});
	});

	describe('update', function () {
		it('should update element text on property change', function () {
			const header1 = h('h1', null, () => model.title);
			const header2 = h('h1', null, () => model.title);
			const text = h('div', null, [header2, h('div', null, () => model.text)]);
			root.appendChild(header1);
			root.appendChild(text);

			assert.deepEqual(trackUpdates(() => {
				model.title = 'New title';
			}), [header1, header2]);

			assert.equal(root.innerHTML, '<h1>New title</h1><div><h1>New title</h1><div>Text</div></div>');
		});

		it('should update element class on property change', function () {
			const container = h('div', {class: {post: true, published: () => model.isPublished}}, [
				h('h1', null, () => model.title),
			]);

			root.appendChild(container);
			assert.equal(root.innerHTML, '<div class="post"><h1>First</h1></div>');

			assert.deepEqual(trackUpdates(() => {
				model.isPublished = true;
			}), [container]);

			assert.equal(root.innerHTML, '<div class="post published"><h1>First</h1></div>');
		});
	});

	describe('list', function () {
		const item = value => h('li', null, value.title);
		const itemHtml = value => '<li>' + value.title + '</li>';

		it('should create elements for array items', function () {
			root.appendChild(h('ul', {list: {array: () => array, item}}));
			assert.equal(root.innerHTML, '<ul>' + array.map(itemHtml).join('') + '</ul>');
		});

		it('should append element on array push', function () {
			const list = h('ul', {list: {array: () => array, item}});
			root.appendChild(list);
			array.push({title: 'New'});
			assert.equal(root.innerHTML, '<ul>' + array.map(itemHtml).join('') + '</ul>');
		});

		it('should append element on array unshift', function () {
			const list = h('ul', {list: {array: () => array, item}});
			root.appendChild(list);
			array.unshift({title: 'New'});
			assert.equal(root.innerHTML, '<ul>' + array.map(itemHtml).join('') + '</ul>');
		});

		it('should update array item element on change', function () {
			const list = h('ul', {list: {array: () => array, item}});
			root.appendChild(list);
			array[1] = {title: 'New'};
			assert.equal(root.innerHTML, '<ul>' + array.map(itemHtml).join('') + '</ul>');
		});

		it('should append element on array push', function () {
			const list = h('ul', null, () => model.tags.map(tag => h('li', null, tag)));
			root.appendChild(list);
			model.tags.push('New');
			assert.equal(root.innerHTML, '<ul>' + model.tags.map(tag => '<li>' + tag + '</li>').join('') + '</ul>');
		});

		it('should append element on array unshift', function () {
			const list = h('ul', null, () => model.tags.map((tag, i) => h('li', null, i + ' ' + tag)));
			root.appendChild(list);
			model.tags.unshift('New');
			assert.equal(root.innerHTML,
				'<ul>' + model.tags.map((tag, i) => '<li>' + i + ' ' + tag + '</li>').join('') + '</ul>');
		});

		it('should update list on reverse', function () {
			const list = h('ul', {list: {array: () => array, item}});
			root.appendChild(list);
			array.reverse();
			assert.equal(root.innerHTML, '<ul>' + array.map(itemHtml).join('') + '</ul>');
		});

		it('should update list on reassign, same objects', function () {
			const list = h('ul', {list: {array: () => container.array, item}});
			root.appendChild(list);
			container.array = array.slice().reverse();
			assert.equal(root.innerHTML, '<ul>' + array.slice().reverse().map(itemHtml).join('') + '</ul>');
		});

		it('should update list on reassign, new objects', function () {
			const container = view.proxy({array});
			const list = h('ul', {list: {array: () => container.array, item: value => h('li', null, () => value.title)}});
			root.appendChild(list);
			const oldChildren = [].slice.call(list.children);
			const newArray = JSON.parse(JSON.stringify(array));
			newArray[1].title = 'New Second';
			newArray.forEach((value, i) => Object.assign(array[i], value));
			const newChildren = [].slice.call(list.children);
			assert.equal(root.innerHTML, '<ul>' + newArray.map(itemHtml).join('') + '</ul>');
			assert.deepEqual(newChildren, oldChildren);
		});
	});

	describe('undo/redo', function () {
		let undo;

		beforeEach(function () {
			undo = new SatoriUndo(view);
		});

		it('should undo and redo property change', function () {
			assert.equal(model.title, 'First');
			undo.action(() => {model.title = 'New title'});
			assert.equal(model.title, 'New title');
			undo.undo();
			assert.equal(model.title, 'First');
			undo.redo();
			assert.equal(model.title, 'New title');
		});

		it('should undo array push', function () {
			const before = array.slice();
			undo.action(() => array.push({title: 'New'}));
			const after = array.slice();
			assert.notDeepEqual(array, before);
			undo.undo();
			assert.deepEqual(array, before);
			undo.redo();
			assert.deepEqual(array, after);
		});
	});
});
