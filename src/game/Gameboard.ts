import { ArrayMatrix } from "../utils/ArrayMatrix";
import { PieceFlags } from "./GameDef";
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

export default class Gameboard {
	pieces: ArrayMatrix<number>;
	flags: ArrayMatrix<number>;

	readonly garbageIdx: number;

	constructor(
		public width: number,
		public height: number,
		public logic: Logic,
	) {
		this.pieces = ArrayMatrix.create(width, height, 0);
		this.flags = ArrayMatrix.create(width, height, 0);

		this.garbageIdx = this.logic.gameDef.getPieceIdx("?");
	}

	actionQueue: ActionList[] = [];
	delayTimer: number = 0;
	active!: Action[];

	isOoB(x: number, y: number) {
		if (x < 0 || y >= this.height || x < 0 || x >= this.width) {
			return true;
		}
		return false;
	}

	pieceXY(x: number, y: number) {
		if (this.isOoB(x, y)) return undefined;
		return this.pieces.atXY(x, y);
	}

	flagXY(x: number, y: number) {
		if (this.isOoB(x, y)) return undefined;
		return this.flags.atXY(x, y);
	}

	setXY(x: number, y: number, p: number, f: number) {
		this.pieces.setXY(x, y, p);
		this.flags.setXY(x, y, f);
	}

	shiftUp(lines: number) {
		this.pieces.shiftUp(lines, 0);
		this.flags.shiftUp(lines, 0);
	}

	isEmpty() {
		for (let i = 0; i < this.pieces.length; i++) {
			if (this.pieces[i] != 0) return false;
		}
		return true;
	}

	detectSectors(isEqual: (a: number, b: number, af: number, bf: number) => boolean): [number, number][][] {
		const sectors: [number, number][][] = [];
		const visited = new ArrayMatrix<boolean>(this.width, this.height).fill(false);

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (!visited.atXY(x, y)) {
					const p = this.pieceXY(x, y)!;
					const f = this.flagXY(x, y)!;
					const sector: [number, number][] = [];
					let queue = [[x, y]];
					let item;

					while ((item = queue.pop())) {
						const [xx, yy] = item;
						if (yy < 0 || yy >= this.height || xx < 0 || xx >= this.width) {
							continue;
						}

						if (visited.atXY(xx, yy) || !isEqual(this.pieceXY(xx, yy)!, p, this.flagXY(xx, yy)!, f)) {
							continue;
						}

						visited.setXY(xx, yy, true);
						sector.push([xx, yy]);

						// Explore neighbors
						queue.push([xx + 0, yy + 1], [xx + 0, yy - 1], [xx + 1, yy + 0], [xx - 1, yy + 0]);
					}
					if (sector.length > 0) sectors.push(sector);
				}
			}
		}

		return sectors;
	}

	// creates a list of actions to perform
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
		this.active = []; // clear action list
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
						this.setXY(item.x, item.y, 0, PieceFlags.None);
						break;
					case "drop":
						for (let yy = item.y_2; yy >= item.y_1; yy--) {
							this.setXY(
								item.x,
								yy,
								this.pieceXY(item.x, yy - item.n) ?? 0,
								this.flagXY(item.x, yy - item.n) ?? PieceFlags.None,
							);
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
		const f = PieceFlags.Normal | PieceFlags.Garbage;
		switch (garbageLocation) {
			case "bottom":
				this.shiftUp(lines);
				for (let y = 0; y < lines; y++) {
					if (y % cheeseN === 0) {
						holes.clear();
						while (holes.size < garbageHoles) {
							holes.add(this.logic.garbageRandom.randomInt(0, this.width - 1));
						}
					}
					for (let x = 0; x < this.width; x++) {
						if (holes.has(x)) continue;
						this.setXY(x, this.height - 1 - y, this.garbageIdx, f);
					}
				}

				break;
			case "top":
				for (let y = 0; y < lines; y++) {
					if (y % cheeseN === 0) {
						holes.clear();
						while (holes.size < garbageHoles) {
							holes.add(this.logic.garbageRandom.randomInt(0, this.width - 1));
						}
					}
					for (let x = 0; x < this.width; x++) {
						if (holes.has(x)) continue;
						this.setXY(x, y, this.garbageIdx, f);
					}
				}
				// this seems pretty brittle
				this.logic.state.checkState = CheckState.Gravity;
				break;
		}
	}
}
