'use strict'

class SatoriUndo {
	constructor(satori, size, getState, applyState, disableRedo) {
		this.satori = satori;
		this.size = size;
		this.getState = getState;
		this.applyState = applyState;
		this.disableRedo = disableRedo;
		this.reset();
		this.eventHandler = event => this.onEvent(event);
		satori.onEvent.add(this.eventHandler);
	}

	unbind() {
		this.satori.onEvent.delete(this.eventHandler);
	}

	reset() {
		this.currentAction = null;
		this.undoHistory = [];
		this.redoHistory = [];
		this.freeze = 0;
	}

	action(func, extend, close) {
		if (extend && this.lastAction && !this.lastAction.closed) {
			this.currentAction = this.undoHistory.pop();
		} else {
			this.begin();
		}

		const result = func();

		if (close) {
			this.currentAction.closed = true;
		}

		this.end();
		return result;
	}

	get lastAction() {
		return this.undoHistory.length ? this.undoHistory[this.undoHistory.length - 1] : null;
	}

	begin() {
		this.currentAction = {events: [], stateBefore: null, stateAfter: null, closed: false};

		if (this.getState) {
			this.currentAction.stateBefore = this.getState();
		}
	}

	end() {
		if (!this.currentAction) {
			return;
		}

		if (this.getState) {
			this.currentAction.stateAfter = this.getState();
		}

		if (this.currentAction.events.length || !this.currentAction.closed) {
			if (this.lastAction) {
				if (!this.lastAction.events.length) {
					this.undoHistory.pop();
				} else {
					this.lastAction.closed = true;
				}
			}

			this.undoHistory.push(this.currentAction);
		}

		this.currentAction = null;
	}

	onEvent(event) {
		if (!this.currentAction || this.freeze) {
			return;
		}

		if (this.redoHistory.length) {
			this.redoHistory = [];
		}

		this.currentAction.events.push(event);
	}

	undo() {
		let action;

		do {
			if (!this.undoHistory.length) {
				return false;
			}

			action = this.undoHistory.pop();
		} while (!action.events.length);

		action.closed = true;
		this.freeze++;

		for (let i = action.events.length - 1; i >= 0; --i) {
			this.satori.undo(action.events[i]);
		}

		if (this.applyState) {
			this.applyState(action.stateBefore);
		}

		this.freeze--;

		if (!this.disableRedo) {
			this.redoHistory.push(action);
		}

		return true;
	}

	redo() {
		if (this.disableRedo) {
			throw new Error('Redo is disabled');
		}

		if (!this.redoHistory.length) {
			return false;
		}

		const action = this.redoHistory.pop();
		this.freeze++;

		for (let i = 0, len = action.events.length; i < len; ++i) {
			this.satori.redo(action.events[i]);
		}

		if (this.applyState) {
			this.applyState(action.stateAfter);
		}

		this.freeze--;
		this.undoHistory.push(action);
		return true;
	}
}
