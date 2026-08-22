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

interface SetAction extends BaseAction {
	type: "set";
	x: number;
	y: number;
	p: number;
	f: number;
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

export type Action = DeleteAction | DropAction | GarbageAction | SetAction;

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

	detectSectors(isEqual: (ax: number, ay: number, bx: number, by: number) => boolean): [number, number][][] {
		const sectors: [number, number][][] = [];
		const visited = new ArrayMatrix<boolean>(this.width, this.height).fill(false);

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (!visited.atXY(x, y)) {
					const sector: [number, number][] = [];
					let queue = [[x, y]];
					let item;

					while ((item = queue.pop())) {
						const [xx, yy] = item;
						if (this.isOoB(xx, yy)) {
							continue;
						}

						if (visited.atXY(xx, yy) || !isEqual(x, y, xx, yy)) {
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

	detectConnected(): [number, number][][] {
		const sectors: [number, number][][] = [];
		const visited = new ArrayMatrix<boolean>(this.width, this.height).fill(false);

		const test = (ax: number, ay: number, bx: number, by: number) => {
			const a = this.pieceXY(ax, ay)!;
			const b = this.pieceXY(bx, by)!;
			const af = this.flagXY(ax, ay)!;
			const bf = this.flagXY(bx, by)!;

			if (a != b) return false;
			if (a == 0 || b == 0) return false;

			if (ax === bx && ay === by) return true;

			if (ax - bx > 0) {
				// a left, b right
				if ((af & PieceFlags.L) !== 0 && (bf & PieceFlags.R) !== 0) return true;
				return false;
			} else if (ax - bx < 0) {
				// a right, b left
				if ((af & PieceFlags.R) !== 0 && (bf & PieceFlags.L) !== 0) return true;
				return false;
			}
			if (ay - by > 0) {
				// a bottom, b top
				if ((af & PieceFlags.U) !== 0 && (bf & PieceFlags.D) !== 0) return true;
				return false;
			} else if (ay - by < 0) {
				// a top, b bottom
				if ((af & PieceFlags.D) !== 0 && (bf & PieceFlags.U) !== 0) return true;
				return false;
			}

			// note: unreachable theoretically, because this would mean that the positions are equal
			return true;
		};

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (!visited.atXY(x, y)) {
					const sector: [number, number][] = [];
					let queue = [[x, y, x, y]];
					let item;

					while ((item = queue.pop())) {
						// 1 is the target location, 2 is the starting location
						const [x1, y1, x2, y2] = item;
						if (this.isOoB(x1, y1)) {
							continue;
						}

						if (visited.atXY(x1, y1) || !test(x1, y1, x2, y2)) {
							continue;
						}

						visited.setXY(x1, y1, true);
						sector.push([x1, y1]);

						// Explore neighbors
						queue.push(
							[x1 + 0, y1 + 1, x1, y1],
							[x1 + 0, y1 - 1, x1, y1],
							[x1 + 1, y1 + 0, x1, y1],
							[x1 - 1, y1 + 0, x1, y1],
						);
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

	// sets a block at x,y to p,f
	set(x: number, y: number, p: number, f: number) {
		this.active.push({ type: "set", x, y, p, f });
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
				switch (item.type) {
					case "delete":
						this.setXY(item.x, item.y, 0, PieceFlags.None);
						break;
					case "set":
						this.setXY(item.x, item.y, item.p, item.f);
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

	gravity(): CheckState {
		const {
			logic: {
				gameDef: { settings },
			},
		} = this;

		const dropDelay = settings.dropDelay;
		switch (settings.gravityType) {
			case "naive": {
				for (let y = this.height - 1; y > 0; y--) {
					let lines = 0;
					upper: while (true) {
						for (let x = 0; x < this.width; x++) {
							const piece = this.pieceXY(x, y - lines);
							if (piece != 0) {
								break upper;
							}
						}
						lines++;
					}

					// if this whole board above is empty, continue
					if (y - lines < 0) continue;

					if (lines > 0) {
						this.in();
						for (let x = 0; x < this.width; x++) {
							this.drop(x, 0, y, lines);
						}
						this.out(dropDelay);
						return CheckState.Gravity;
					}
				}
				return CheckState.Done;
			}

			case "linear": {
				let dropped = false;
				this.in();
				for (let x = 0; x < this.width; x++) {
					for (let y = this.height - 1; y > 0; y--) {
						let lines = 0;
						while (this.pieceXY(x, y - lines) === 0) {
							lines++;
						}
						// if this whole column is empty, break
						if (y - lines < 0) break;
						if (lines != 0) {
							this.drop(x, 0, y, lines);
							dropped = true;
							break;
						}
					}
				}
				this.out(dropDelay);
				if (dropped) {
					return CheckState.Clear;
				}
				return CheckState.Done;
			}

			case "sticky": {
				for (let y = this.height - 1; y > 0; y--) {
					// X XX
					//
					//  x
					// XXX
					// detect empty lines
					let empty = true;
					for (let x = 0; x < this.width; x++) {
						const piece = this.pieceXY(x, y);
						if (piece != 0) {
							empty = false;
							break;
						}
					}

					if (empty) continue;

					// 1 22
					//
					//  3
					// 333
					// detect sectors
					const sectors = this.detectSectors(
						(ax, ay, bx, by) => this.pieceXY(ax, ay) != 0 && this.pieceXY(bx, by) != 0,
					);

					
					//
					//
					// 1322
					// 333
					// make sectors fall
					const tp = this.pieces.copy();
					const tf = this.flags.copy();
					let moved = false;

					this.in();
					for (const sector of sectors) {
						// just so typescript doesn't complain...
						const points = sector as any as [number, number, number, number][];
						points.sort((a, b) => b[1] - a[1]);
						for (const point of points) {
							point[2] = tp.atXY(point[0], point[1])!;
							point[3] = tf.atXY(point[0], point[1])!;
							tp.setXY(point[0], point[1], 0);
							tf.setXY(point[0], point[1], PieceFlags.None);
							this.delete(point[0], point[1]);
						}

						let yy = 1;
						loop: while (true) {
							for (const [px, py] of points) {
								const p = tp.atXY(px, py + yy);
								if (p != 0) {
									yy -= 1;
									break loop;
								}
							}
							yy += 1;
						}

						for (const [px, py, p, f] of points) {
							if (yy > 0) {
								moved = true;
								tp.setXY(px, py + yy, p);
								tf.setXY(px, py + yy, f);
								this.set(px, py + yy, p, f);
							} else {
								this.active.pop();
							}
						}
					}

					if (moved) {
						this.out(dropDelay);
						return CheckState.Clear;
					} else {
						this.active = [];
						return CheckState.Done;
					}
				}

				// this is a hack that im almost certain does not work, but for now is fine
				// todo: actually rework this to use the gameboard action queuing system, which will fix this bug
				return CheckState.Done;
			}

			case "cascade": {
				for (let y = this.height - 1; y > 0; y--) {
					// X XX
					//
					//  x
					// XXX
					// detect empty lines
					let empty = true;
					for (let x = 0; x < this.width; x++) {
						const piece = this.pieceXY(x, y);
						if (piece != 0) {
							empty = false;
							break;
						}
					}

					if (empty) continue;

					// 1 22
					//
					//  3
					// 333
					// detect sectors
					const sectors = this.detectConnected();
					sectors.sort((a, b) => {
						let aAvgY = 0;
						for (const point of a) {
							aAvgY += point[1]
						}
						aAvgY /= a.length;
						
						let bAvgY = 0;
						for (const point of b) {
							bAvgY += point[1]
						}
						bAvgY /= b.length;

						return aAvgY - bAvgY;
					});

					//
					//
					// 1322
					// 333
					// make sectors fall
					const tp = this.pieces.copy();
					const tf = this.flags.copy();
					let moved = false;

					this.in();
					for (const sector of sectors) {
						// just so typescript doesn't complain...
						const points = sector as any as [number, number, number, number][];
						points.sort((a, b) => b[1] - a[1]);
						for (const point of points) {
							point[2] = tp.atXY(point[0], point[1])!;
							point[3] = tf.atXY(point[0], point[1])!;
							tp.setXY(point[0], point[1], 0);
							tf.setXY(point[0], point[1], PieceFlags.None);
							this.delete(point[0], point[1]);
						}

						let yy = 1;
						loop: while (true) {
							for (const [px, py] of points) {
								const p = tp.atXY(px, py + yy);
								if (p != 0) {
									yy -= 1;
									break loop;
								}
							}
							yy += 1;
						}

						for (const [px, py, p, f] of points) {
							if (yy > 0) {
								moved = true;
								tp.setXY(px, py + yy, p);
								tf.setXY(px, py + yy, f);
								this.set(px, py + yy, p, f);
							} else {
								this.active.pop();
							}
						}
					}

					if (moved) {
						this.out(dropDelay);
						return CheckState.Clear;
					} else {
						this.active = [];
						return CheckState.Done;
					}
				}

				return CheckState.Done;
			}
		}

		throw new RangeError(`Invalid gravity type "${settings.gravityType}"`);
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
