import { ArrayMatrix } from "../utils/ArrayMatrix";
import { GameDef, Piece, PieceFlags } from "./GameDef";
import { InputManager, Keys } from "./InputManager";
import { PieceState, RotState } from "./PieceState";
import { Preferences, Prefs } from "./Preferences";
import { AbilityManager } from "./AbilityManager";
import random from "secure-random";
import { pento, tetro } from "../data/gameTypes";
import { BaseDraw } from "./render/BaseDraw";
import { EventEmitter } from "eventemitter3";
import { BaseMode } from "./modes/BaseMode";
import Gameboard from "./Gameboard";
import { Random } from "../utils/randomizer";
import { SoundManager, Sounds } from "./SoundManager";

export enum CheckState {
	Clear,
	Gravity,
	Done,
}

export class Logic {
	public gameboard!: Gameboard;
	public ghostboard!: ArrayMatrix<number>;
	public activePiece!: PieceState;
	public holdPiece!: PieceState;
	public paused!: boolean;
	public swapHold!: boolean;
	public gameover!: boolean;
	public lastMove!: Keys;
	public abilityManager!: AbilityManager;
	public gameDef!: GameDef;
	public garbageRandom!: Random;
	public stopped: boolean = false;
	mode!: BaseMode;

	constructor(
		public prefs: Preferences,
		public input: InputManager,
		public draw: BaseDraw,
		public sound: SoundManager,
	) {}

	_signal = new EventEmitter();

	init() {
		this.draw.logic = this;

		let rAF: number;
		let then = 0;
		const drawLoop = (now: number) => {
			now *= 0.001;
			this.draw.frame(now - then);
			then = now;
			if (!this.stopped) {
				rAF = requestAnimationFrame(drawLoop);
			}
		};

		const fps = 60;

		// note: any because typescript desides we're in node here, and well, we're not in node, so i refuse to use NodeJS.Timeout as the type here
		let timeout: any;

		const func = () => {
			if (!this.stopped) {
				this.frame();
				timeout = setTimeout(func, 1000 / fps);
			} else {
				this._signal.emit("stopped");
			}
		};

		this._signal.on("stop", () => {
			this.stopped = true;
			clearTimeout(timeout);
		});
		this._signal.on("start", () => {
			this.stopped = false;
			func();
			requestAnimationFrame(drawLoop);
		});

		return this._signal;
	}

	restart() {
		this._signal.emit("stop");
		this._signal.once("stopped", () => {
			this.reset();
			this._signal.emit("start");
		});
	}

	swapGameDef(gameDef: GameDef) {
		this._signal.emit("stop");
		this.gameDef = gameDef;
	}

	swapMode(mode: BaseMode) {
		this._signal.emit("stop");
		this.mode = mode;
		this.mode.logic = this;
	}

	reset() {
		this.paused = false;
		const seed = random(1, { type: "Uint8Array" })[0];
		this.gameDef.randomizer.reset(seed);
		this.garbageRandom = new Random(seed);
		this.state = {
			areTimer: 0,
			arrTimer: 0,
			dasTimer: 0,
			sdfTimer: 0,
			sdfMax: Math.min(this.prefs.get(Prefs.Sdf), this.gameDef.settings.gravity),
			gravityTimer: 0,
			lockDelayTimer: 0,
			lockDelayMoves: 0,
			pauseBuffer: 0,
			heldLast: false,
			combo: 0,
			b2b: 0,
			dasDirection: undefined,
			failTimer: 0,
			failBuffer: 0,
			checkState: CheckState.Clear,
			queue: [],
		};
		this.gameover = false;

		this.flags = {
			noLineClears: false,
			disableGravity: false,
			disableLockDelay: false,
			receiveSentGarbage: false,
		};

		this.abilityManager = new AbilityManager(this);

		const { boardSize } = this.gameDef.settings;
		// clear gameboard
		this.gameboard = new Gameboard(boardSize[0], boardSize[1], this);
		this.ghostboard = ArrayMatrix.create(boardSize[0], boardSize[1], 0);
		this.activePiece = PieceState.none;
		this.holdPiece = PieceState.none;
		this.swapHold = false;
		this.paused = false;
		this.lastMove = Keys.Pause; // used as a placeholder empty value
		this.draw.reset();
		this.mode.reset();
	}

	pieceIntersecting(piece: PieceState): boolean {
		if (piece.invalid) throw new Error("Invalid piece");
		for (let x = 0; x < piece.data.width; x++) {
			for (let y = 0; y < piece.data.height; y++) {
				if (piece.data.atXY(x, y) != 0) {
					const p = this.gameboard.pieceXY(piece.x + x, piece.y + y);
					if (p !== 0 || p == undefined) {
						return true;
					}
				}
			}
		}

		return false;
	}

	gameOver() {
		this.gameover = true;
		this._signal.emit("fail");
	}

	gameWin() {
		this.gameover = true;
		this._signal.emit("win");
	}

	calculateKicks(piece: Piece, from: RotState, to: RotState): [number, number][] {
		const kicks: [number, number][] = [];

		const kickTable = this.gameDef.rotations.get(piece.index)!;

		const fromK = kickTable[from.name()];
		const toK = kickTable[to.name()];

		for (let i = 0; i < fromK.length; i++) {
			const f = fromK[i];
			const t = toK[i];
			kicks.push([f[0] - t[0], f[1] - t[1]]);
		}

		return kicks;
	}

	state!: {
		areTimer: number;
		arrTimer: number;
		dasTimer: number;
		sdfTimer: number;
		sdfMax: number;
		gravityTimer: number;
		lockDelayTimer: number;
		lockDelayMoves: number;
		pauseBuffer: number;
		heldLast: boolean;
		combo: number;
		b2b: number;
		dasDirection: Keys | undefined;
		failTimer: number;
		failBuffer: number;
		checkState: CheckState;
		queue: PieceState[];
	};

	flags!: {
		noLineClears: boolean;
		disableGravity: boolean;
		disableLockDelay: boolean;
		receiveSentGarbage: boolean;
	};

	clearLines() {
		if (this.flags.noLineClears) return;

		let clearedLines = 0;
		let wasSpin = false;

		// clearedLines
		// three corner rule
		// todo: scoring
		if (this.lastMove == Keys.RotateLeft || this.lastMove == Keys.RotateRight || this.lastMove == Keys.Rotate180) {
			let corners = 0;
			const piece = this.activePiece;
			const matrix = piece.piece.data;
			for (const x of [0, matrix.width - 1]) {
				for (const y of [0, matrix.height - 1]) {
					if (this.gameboard.pieceXY(piece.x + x, piece.y + y) != 0) {
						corners++;
					}
				}
			}
			if (corners > 2 && this.gameDef.garbage.isSpin(piece.piece.name)) {
				wasSpin = true;
			}
		}

		const lineClearDelay = this.gameDef.settings.lineClearDelay;
		switch (this.gameDef.settings.clearType) {
			case "line":
				this.gameboard.in();
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					let hole = false;
					for (let x = 0; x < this.gameboard.width; x++) {
						const piece = this.gameboard.pieceXY(x, y);
						const flags = this.gameboard.flagXY(x, y)!;
						if (piece === 0 || (flags & PieceFlags.Unclearable) !== 0) {
							hole = true;
							break;
						}
					}

					if (!hole) {
						for (let x = 0; x < this.gameboard.width; x++) {
							this.gameboard.delete(x, y);
						}
						clearedLines += 1;
					}
				}
				this.gameboard.out(lineClearDelay);
				break;

			case "color":
				const sectors = this.gameboard.detectSectors((ax, ay, bx, by) => {
					const a = this.gameboard.pieceXY(ax, ay)!;
					const b = this.gameboard.pieceXY(bx, by)!;
					const af = this.gameboard.flagXY(ax, ay)!;
					const bf = this.gameboard.flagXY(bx, by)!;

					if (a === 0 || b === 0) return false;
					if ((af & PieceFlags.Garbage) != 0 || (bf & PieceFlags.Garbage) != 0) return false;
					return a === b;
				});
				this.gameboard.in();
				for (const sector of sectors) {
					if (sector.length < 4) continue;

					clearedLines += 1 + sector.length - 4;
					for (const [x, y] of sector) {
						this.gameboard.delete(x, y);
						for (const xx of [-1, 1]) {
							for (const yy of [-1, 1]) {
								const piece = this.gameboard.pieceXY(x + xx, y + yy) ?? 0;
								if (piece == 0) continue;
								const flags = this.gameboard.flagXY(x + xx, y + yy) ?? 0;
								if ((flags & PieceFlags.Garbage) !== 0 && (flags & PieceFlags.Unclearable) === 0) {
									this.gameboard.delete(x + xx, y + yy);
								}
							}
						}
					}
				}
				this.gameboard.out(lineClearDelay);
				break;

			case "match3":
				this.gameboard.in();
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					for (let x = 0; x < this.gameboard.width; x++) {
						const a = this.gameboard.pieceXY(x, y);
						const af = this.gameboard.flagXY(x, y)!;
						if (a === 0 || (af & PieceFlags.Unclearable) !== 0 || (af & PieceFlags.Garbage) !== 0) {
							continue;
						}

						top: for (const xx of [-1, 0, 1]) {
							for (const yy of [-1, 0, 1]) {
								if (xx == 0 && yy == 0) continue;
								const b = this.gameboard.pieceXY(x + xx, y + yy);
								if (a == b) {
									const c = this.gameboard.pieceXY(x + xx + xx, y + yy + yy);
									if (a == c) {
										this.gameboard.delete(x, y);
										this.gameboard.delete(x + xx, y + yy);
										this.gameboard.delete(x + xx + xx, y + yy + yy);

										clearedLines += 1;
										break top;
									}
								}
							}
						}
					}
				}
				this.gameboard.out(lineClearDelay);
				break;
		}

		const wasB2B = this.gameDef.garbage.isB2B(clearedLines, wasSpin);
		const wasPC = this.gameboard.isEmpty();

		if (clearedLines > 0) {
			this.sound.play(Sounds.Clear);

			const garbage = this.gameDef.garbage.clear(clearedLines, this.state.combo, this.state.b2b, wasSpin, wasPC);
			if (this.flags.receiveSentGarbage) {
				this.garbageQueue.push(garbage);
			}

			this.state.checkState = CheckState.Gravity;
			if (wasB2B) {
				this.state.b2b += 1;
			} else {
				this.state.b2b = 0;
			}
			this.state.combo += 1;
		} else {
			this.state.combo = 0;
		}

		this.abilityManager.charge += clearedLines;
		this.mode.lineClear(clearedLines);
	}

	public garbageQueue: number[] = [];

	receiveGarbage(lines: number) {
		this.gameboard.in();
		this.gameboard.receiveGarbage(lines);
		this.gameboard.out(0);
	}

	peekPieces(n: number) {
		let peeked = [];
		for (let i = 0; i < n; i++) {
			if (this.state.queue[i] != undefined) {
				peeked.push(this.state.queue[i]);
			} else {
				const piece = this.genPiece();
				this.state.queue.push(piece);
				peeked.push(piece);
			}
		}
		return peeked;
	}

	genPiece() {
		const { pieceGeneration } = this.gameDef.settings;

		let pieceIdx = 0;
		switch (pieceGeneration.type) {
			case "simple":
				pieceIdx = this.gameDef.randomizer.next();
				break;
			case "subpiece":
				pieceIdx = this.gameDef.getPieceIdx(pieceGeneration.template);
				break;
		}
		const genPiece = this.createPiece(pieceIdx);

		if (pieceGeneration.type == "subpiece") {
			for (let i = 0; i < genPiece.data.length; i++) {
				if (genPiece.data[i] != 0) {
					genPiece.data[i] = this.gameDef.randomizer.next();
				}
			}
		}

		return genPiece;
	}

	resetPiece(piece: PieceState) {
		const { boardSize, screenSize } = this.gameDef.settings;

		const pieceWidth = this.gameDef.widthHeightMap.get(piece.piece.index)![0];
		const topLeft = this.gameDef.topLeftMap.get(piece.piece.index)!;
		let x = Math.floor((boardSize[0] - pieceWidth) / 2);
		let y = boardSize[1] - screenSize[1] - 1;
		if (y > boardSize[1]) y = boardSize[1] - 1;
		if (x < 1) x = 1;
		if (y < 1) y = 1;

		piece.x = x - topLeft[0];
		piece.y = y - topLeft[1];

		if (piece.rot.equals(RotState.Left)) {
			piece.rotate90deg();
		} else if (piece.rot.equals(RotState.Right)) {
			piece.rotate90degcc();
		} else if (piece.rot.equals(RotState.Twice)) {
			piece.rotate90deg().rotate90deg();
		}
		piece.rot = RotState.Initial;
	}

	createPiece(pieceIdx: number) {
		const piece = this.gameDef.getPiece(pieceIdx);
		const state = new PieceState(this, piece, RotState.Initial, 0, 0);
		this.resetPiece(state);

		return state;
	}

	pause() {
		this.paused = true;
		this.state.pauseBuffer = 30; // 0.25s
		this._signal.emit("pause");
	}

	resume() {
		this.paused = false;
		this.state.pauseBuffer = 30; // 0.25s
		this._signal.emit("resume");
	}

	/**
	 * logic loop function, should run 60 times per second
	 */
	frame() {
		if (!this.gameover) {
			if (this.input.isPressed(Keys.Restart)) {
				this.input.pressedMap[Keys.Restart] = false;
				const ghost = this.ghostboard;
				this.restart();
				this.ghostboard = ghost;
				return;
			}
	
			if (this.input.isPressed(Keys.Pause) && this.state.pauseBuffer == 0) {
				if (this.paused) {
					this.resume();
				} else {
					this.pause();
				}
			} else if (this.state.pauseBuffer != 0) {
				this.state.pauseBuffer--;
			}

			if (this.input.isPressed(Keys.Fail)) {
				this.state.failBuffer = 10;
				if (this.state.failTimer >= 60) {
					this.gameOver();
				} else {
					this.state.failTimer += 1;
				}
			} else if (this.state.failBuffer <= 0) {
				if (this.state.failTimer >= 0) this.state.failTimer -= 1;
			} else {
				this.state.failBuffer--;
			}
		}

		if (this.paused) return;

		const { are, hold: canHold, gravity, lockDelay, holdDelay, gravityType } = this.gameDef.settings;

		this.mode.frame();
		if (this.gameboard.step()) return;
		if (this.state.checkState == CheckState.Clear) {
			this.state.checkState = CheckState.Done;
			this.clearLines();
			if (gravityType !== "naive") {
				this.state.checkState = CheckState.Gravity;
			}
		} else if (this.state.checkState == CheckState.Gravity) {
			this.state.checkState = this.gameboard.gravity();
		}
		if (this.state.checkState != CheckState.Done) return;

		if (this.gameover) {
			if (this.gameboard.actionQueue.length == 0) {
				this._signal.emit("stop");
			}
			return;
		}

		// if no piece,
		if (this.activePiece.invalid) {
			// wait for are
			if (this.state.areTimer <= are) {
				this.state.areTimer++;
				return;
			}

			if (canHold && this.swapHold) {
				if (!this.holdPiece.invalid) {
					this.activePiece.invalid = false;
					const hold = this.activePiece.copy();
					this.resetPiece(hold);
					this.activePiece = this.holdPiece.copy();
					this.holdPiece = hold;
				} else {
					this.holdPiece = this.activePiece.copy();
					this.activePiece.invalidate();
				}
				this.swapHold = false;
			}

			if (this.activePiece.invalid) {
				if (this.state.queue.length > 0) {
					this.activePiece = this.state.queue.shift()!;
				} else {
					this.activePiece = this.genPiece();
				}
			}

			// check if player is trying to rotate piece, rotate
			this.handleInputs();

			// if piece intersects gameboard,
			if (this.pieceIntersecting(this.activePiece)) {
				const piece = this.activePiece.relative(0, -2);
				if (!this.pieceIntersecting(piece)) {
					this.activePiece = piece;
				} else {
					this.activePiece.invalidate();
					this.gameOver();
				}
			}
		} else {
			if (this.garbageQueue.length > 0) {
				let lines;
				while ((lines = this.garbageQueue.pop()) != undefined) {
					this.receiveGarbage(lines);
				}
			}

			// if is piece in valid location
			if (!this.pieceIntersecting(this.activePiece)) {
				if (canHold && !this.state.heldLast && this.input.isPressed(Keys.Hold)) {
					this.activePiece.invalidate();
					this.swapHold = true;
					// make are longer for holds
					this.state.areTimer = -holdDelay;
					this.state.heldLast = true;
					return;
				}

				// (frames * cells/frames) >= 1 // we moved more than 1 cell, drop piece
				if (!this.flags.disableGravity && this.state.gravityTimer >= gravity) {
					this.activePiece.softDrop();
					this.state.gravityTimer = 0;
					this.state.lockDelayTimer = 0;
				}
				this.state.gravityTimer += 1;

				this.handleInputs();

				// is piece touching floor?
				if (!this.flags.disableLockDelay && this.pieceIntersecting(this.activePiece.relative(0, 1))) {
					this.state.lockDelayTimer += 1;
				}

				this.abilityManager.frame();

				if (this.state.lockDelayTimer >= lockDelay) {
					this.activePiece.write();
					this.state.heldLast = false;
					this.state.lockDelayTimer = 0;
					this.state.lockDelayMoves = 0;
					this.state.checkState = CheckState.Clear;
					this.sound.play(Sounds.Lock);
				}
			} else {
				// todo: [garbage] piece placement
				// eventually we will probably push the piece up because
				// the only way to get in this state is probably garbage?
				// and then only if the piece can't be pushed up then we game over
				this.gameOver();
			}
		}
	}

	movedLastFrame = true;

	devInputs() {
		if (this.input.isPressed(Keys.DiscardActivePiece)) {
			this.activePiece.invalidate();
			this.input.pressedMap[Keys.DiscardActivePiece] = false;
		}

		if (this.input.isPressed(Keys.ClearHoldBox)) {
			this.holdPiece = PieceState.none;
			this.input.pressedMap[Keys.ClearHoldBox] = false;
		}

		if (this.input.isPressed(Keys.Ghostboard)) {
			const { boardSize } = this.gameDef.settings;
			this.ghostboard = this.gameboard.pieces.copy();
			this.gameboard = new Gameboard(boardSize[0], boardSize[1], this);
			this.input.pressedMap[Keys.Ghostboard] = false;
		}

		if (this.input.isPressed(Keys.ToggleGravity)) {
			this.flags.disableGravity = !this.flags.disableGravity;
			console.log("Toggled gravity, currently:", this.flags.disableGravity);
			this.input.pressedMap[Keys.ToggleGravity] = false;
		}

		if (this.input.isPressed(Keys.CycleActivePiece)) {
			const {
				settings: { boardSize, screenSize },
			} = this.gameDef;

			const piece = this.gameDef.getPiece(this.activePiece.piece.index + 1) ?? this.gameDef.getPiece(1);

			// x = ceil((BW - n) / 2)
			const x = Math.ceil((boardSize[0] - piece.data.width) / 2);
			let y = screenSize[1] + 1;
			if (y > boardSize[1]) y = boardSize[1];
			this.activePiece = new PieceState(this, piece, RotState.Initial, x - 1, y - 1);

			this.input.pressedMap[Keys.CycleActivePiece] = false;
		}

		if (this.input.isPressed(Keys.ToggleLocking)) {
			this.flags.disableLockDelay = !this.flags.disableLockDelay;
			this.input.pressedMap[Keys.ToggleLocking] = false;
			console.log("Toggled locking, currently:", this.flags.disableLockDelay);
		}

		if (this.input.isPressed(Keys.RecieveSentGarbage)) {
			this.flags.receiveSentGarbage = !this.flags.receiveSentGarbage;
			this.input.pressedMap[Keys.RecieveSentGarbage] = false;
			console.log("Toggled receive sent garbage, currently:", this.flags.receiveSentGarbage);
		}
	}

	handleInputs() {
		let updated = false;
		const { specialRotation, rotation } = this.gameDef.settings;

		this.devInputs();

		if (this.input.isPressed(Keys.RotateLeft) && rotation) {
			const piece = this.activePiece.rotateLeft();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateLeft] = false;
			this.lastMove = Keys.RotateLeft;
		}

		if (this.input.isPressed(Keys.RotateRight) && rotation) {
			const piece = this.activePiece.rotateRight();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateRight] = false;
			this.lastMove = Keys.RotateRight;
		}

		if (this.input.isPressed(Keys.Rotate180) && rotation) {
			const piece = this.activePiece.rotate180();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.Rotate180] = false;
			this.lastMove = Keys.Rotate180;
		}

		if (this.input.isPressed(Keys.Ability)) {
			this.abilityManager.handleInput();
			this.input.pressedMap[Keys.Ability] = false;
		}

		if (this.input.isPressed(Keys.RotateSpecial) && specialRotation != "none") {
			let piece: PieceState | undefined;
			switch (specialRotation) {
				case "flip": {
					const p = this.activePiece;
					const pieceData = this.gameDef.getPiece(p.piece.mirror);
					if (pieceData == undefined) {
						piece = undefined;
						break;
					}
					piece = new PieceState(this, pieceData, RotState.Initial, p.x, p.y);
					if (p.rot.equals(RotState.Right)) {
						piece.rotate90degcc();
					}
					if (p.rot.equals(RotState.Left)) {
						piece.rotate90deg();
					}
					if (p.rot.equals(RotState.Twice)) {
						piece.rotate90deg();
						piece.rotate90deg();
					}
					if (this.pieceIntersecting(piece)) {
						piece = undefined;
					}
					break;
				}
				case "cycle": {
					const p = this.activePiece;
					const colorQueue: number[] = [];
					for (let i = 0; i < p.data.length; i++) {
						if (p.data[i] != 0) {
							colorQueue.push(p.data[i]);
						}
					}
					colorQueue.push(colorQueue.shift()!);

					piece = new PieceState(this, p.piece, RotState.Initial, p.x, p.y);
					if (p.rot.equals(RotState.Right)) {
						piece.rotate90degcc();
					}
					if (p.rot.equals(RotState.Left)) {
						piece.rotate90deg();
					}
					if (p.rot.equals(RotState.Twice)) {
						piece.rotate90deg();
						piece.rotate90deg();
					}
					// note: not a differently shaped piece, so should be physically impossible to intersect the piece with the board, so no checks necessary

					for (let i = 0; i < p.data.length; i++) {
						if (p.data[i] != 0) {
							piece.data[i] = colorQueue.shift()!;
						}
					}
					break;
				}
			}
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateSpecial] = false;
			this.lastMove = Keys.RotateSpecial;
		}

		if (this.input.isPressed(Keys.HardDrop)) {
			this.activePiece.hardDrop();
			this.state.lockDelayTimer = this.gameDef.settings.lockDelay;
			updated = true;
			this.input.pressedMap[Keys.HardDrop] = false;
		}

		if (this.input.isPressed(Keys.SoftDrop)) {
			if (this.prefs.get(Prefs.Sdf) == -1) {
				this.activePiece.hardDrop();
				this.state.gravityTimer = 0;
			} else {
				if (this.state.sdfTimer >= this.prefs.get(Prefs.Sdf)) {
					this.activePiece.softDrop();
					this.state.sdfTimer = 0;
					this.state.gravityTimer = 0;
				}
				this.state.sdfTimer++;
			}
			updated = true;
		}

		const movingLeft = this.input.isPressed(Keys.MoveLeft);
		const movingRight = this.input.isPressed(Keys.MoveRight);
		let attemptingMovement = movingLeft || movingRight;

		if (this.movedLastFrame) {
			if (attemptingMovement) {
				if (this.state.dasTimer >= this.prefs.get(Prefs.Das)) {
					if (this.state.arrTimer == 0) {
						if (movingLeft) {
							this.activePiece.moveLeft();
							updated = true;
							this.lastMove = Keys.MoveLeft;
							this.state.dasDirection = Keys.MoveLeft;
						}

						if (movingRight) {
							this.activePiece.moveRight();
							updated = true;
							this.lastMove = Keys.MoveRight;
							this.state.dasDirection = Keys.MoveRight;
						}
					}

					if (this.state.arrTimer >= this.prefs.get(Prefs.Arr)) {
						this.state.arrTimer = 0;
					} else {
						this.state.arrTimer++;
					}
				} else {
					if (this.state.dasDirection != undefined) {
						const movedLeft = this.state.dasDirection == Keys.MoveLeft;
						const movedRight = this.state.dasDirection == Keys.MoveRight;
						if (movedLeft && movingLeft) {
							this.state.dasTimer++;
						} else if (movedRight && movingRight) {
							this.state.dasTimer++;
						} else {
							this.state.dasTimer = 0;
							this.state.dasDirection = undefined;
						}
					} else {
						this.state.dasTimer++;
						if (movingLeft) this.state.dasDirection = Keys.MoveLeft;
						if (movingRight) this.state.dasDirection = Keys.MoveRight;
					}
				}
			} else {
				this.state.dasTimer = 0;
				this.state.arrTimer = 0;
				this.movedLastFrame = false;
				this.state.dasDirection = undefined;
			}
		} else {
			if (movingLeft) {
				this.activePiece.moveLeft();
				updated = true;
				this.movedLastFrame = true;
				this.lastMove = Keys.MoveLeft;
			}

			if (movingRight) {
				this.activePiece.moveRight();
				updated = true;
				this.movedLastFrame = true;
				this.lastMove = Keys.MoveRight;
			}
		}

		// if movement successful reset lock delay
		if (updated && this.state.lockDelayMoves >= 15) {
			this.state.lockDelayTimer = 0;
			this.state.lockDelayMoves++;
		}
	}
}
