import { ArrayMatrix } from "../utils/ArrayMatrix";
import { CheckState, Logic } from "./Logic";

interface BaseAction {
	type: string;
}

interface DeleteAction extends BaseAction {
	type: "delete";
	x: number;
	y: number;
}

interface DropAction extends BaseAction {
	type: "drop";
	x: number;
	y_1: number;
	y_2: number;
	n: number;
}

interface GarbageAction extends BaseAction {
	type: "garbage";
	lines: number;
}

export type Action = DeleteAction | DropAction | GarbageAction;

export interface ActionList {
	delay: number;
	list: Action[];
}

export default class Gameboard extends ArrayMatrix<string> {
	constructor(width: number, height: number, public logic: Logic) {
		super(width, height);
	}

	actionQueue: ActionList[] = [];
	delayTimer: number = 0;
	active: Action[];

	// creates a list of animations to perform
	// in()
	in() {
		this.active = [];
	}

	// drops a column down starting at y_1 and ending at y_2 down n spaces
	drop(x: number, y_1: number, y_2: number, n: number) {
		this.active.push({ type: "drop", x, y_1, y_2, n });
	}

	// deletes the mino at x and y
	delete(x: number, y: number) {
		this.active.push({ type: "delete", x, y });
	}

	// generates garbage lines
	receiveGarbage(lines: number) {
		this.active.push({ type: "garbage", lines });
	}

	// ends the action collection, stating it should last for the specified delay in logic frames
	out(delay: number) {
		if (this.active.length != 0) {
			this.actionQueue.push({ delay, list: this.active });
		}
		this.active = undefined; // technically unnecessary, but things will throw errors if they are in an incorrect state
	}

	// will increment the action timer, commits actions when completed, returns true if the action in ongoing
	step() {
		if (this.actionQueue.length == 0) return false;
		const actionList = this.actionQueue[0];
		if (actionList.delay <= this.delayTimer) {
			for (const item of actionList.list) {
				console.log(item);
				switch (item.type) {
					case "delete":
						this.setXY(item.x, item.y, " ");
						break;
					case "drop":
						for (let yy = item.y_2; yy >= item.y_1; yy--) {
							this.setXY(item.x, yy, this.atXY(item.x, yy - item.n) ?? " ");
						}
						break;
					case "garbage":
						this.doGarbage(item.lines);
						break;
				}
			}
			this.actionQueue.shift();
			this.delayTimer = 0;
			return false;
		}

		this.delayTimer++;
		return true;
	}

	// this method seems like it absolutely shouldn't be here, but for now its fine ig
	private doGarbage(lines: number) {
		const { garbageHoles, garbageLocation, garbageCheese: cheeseN } = this.logic.gameDef.settings;
		let holes: Set<number> = new Set();
		switch (garbageLocation) {
			case "bottom":
				this.shiftUp(lines, " ");
				for (let y = 0; y < lines; y++) {
					if (y % cheeseN === 0) {
						holes.clear()
						while (holes.size < garbageHoles) {
							holes.add(this.logic.garbageRandom.randomInt(0, this.width - 1));
						}
					}
					for (let x = 0; x < this.width; x++) {
						if (holes.has(x)) continue;
						this.setXY(x, this.height - 1 - y, "?");
					}
				}

				break;
			case "top":
				for (let y = 0; y < lines; y++) {
					if (y % cheeseN === 0) {
						holes.clear()
						while (holes.size < garbageHoles) {
							holes.add(this.logic.garbageRandom.randomInt(0, this.width - 1));
						}
					}
					for (let x = 0; x < this.width; x++) {
						if (holes.has(x)) continue;
						this.setXY(x, y, "?");
					}
				}
				// this seems pretty brittle
				this.logic.state.checkState = CheckState.Gravity;
				break;
		}
	}
}
