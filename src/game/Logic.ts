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
import { BaseMode } from "./BaseMode";
import Gameboard from "./Gameboard";
import { Random } from "../utils/randomizer";

export enum CheckState {
	Clear,
	Gravity,
	Done,
}

export class Logic {
	public gameboard: Gameboard;
	public ghostboard: ArrayMatrix<string>;
	public activePiece: PieceState;
	public holdPiece: string;
	public paused: boolean;
	public swapHold: boolean;
	public failed: boolean;
	public lastMove: Keys;
	public abilityManager: AbilityManager;
	public gameDef: GameDef;
	public garbageRandom: Random;
	public stopped: boolean = false;
	mode: BaseMode;

	constructor(public prefs: Preferences, public input: InputManager, public draw: BaseDraw) {}

	_signal = new EventEmitter();

	init() {
		this.draw.logic = this;

		let rAF;
		let then = 0;
		const drawLoop = (now) => {
			now *= 0.001;
			this.draw.frame(now - then);
			then = now;
			rAF = requestAnimationFrame(drawLoop);
		};

		const fps = 60;

		let timeout;

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
			cancelAnimationFrame(rAF);
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
		};
		this.failed = false;

		this.flags = {
			noLineClears: false,
			disableGravity: false,
			disableLockDelay: false,
			receiveSentGarbage: false,
		};

		this.abilityManager = new AbilityManager(this);

		const { boardSize } = this.gameDef.settings;
		// clear gameboard
		this.gameboard = new Gameboard(boardSize[0], boardSize[1], this).fill(" ");
		this.ghostboard = new ArrayMatrix<string>(boardSize[0], boardSize[1]).fill(" ");
		this.activePiece = PieceState.none;
		this.holdPiece = " ";
		this.swapHold = false;
		this.paused = false;
		this.lastMove = Keys.Pause; // used as a placeholder empty value
		this.draw.reset();
	}

	pieceIntersecting(piece: PieceState): boolean {
		if (piece.invalid) throw new Error("Invalid piece");
		for (let x = 0; x < piece.data.width; x++) {
			for (let y = 0; y < piece.data.height; y++) {
				if (piece.data.atXY(x, y) != 0) {
					const extracted = this.gameboard.atXY(piece.x + x, piece.y + y);
					if (extracted != " ") {
						return true;
					}
				}
			}
		}

		return false;
	}

	gameOver() {
		this.failed = true;
	}

	calculateKicks(piece: Piece, from: RotState, to: RotState): [number, number][] {
		const kicks = [];

		const kickTable = this.gameDef.rotations.get(piece.name);

		const fromK = kickTable[from.name()];
		const toK = kickTable[to.name()];

		for (let i = 0; i < fromK.length; i++) {
			const f = fromK[i];
			const t = toK[i];
			kicks.push([f[0] - t[0], f[1] - t[1]]);
		}

		return kicks;
	}

	state: {
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
		dasDirection: Keys;
		failTimer: number;
		failBuffer: number;
		checkState: CheckState;
	};

	flags: {
		noLineClears: boolean;
		disableGravity: boolean;
		disableLockDelay: boolean;
		receiveSentGarbage: boolean;
	};

	gravity() {
		const dropDelay = this.gameDef.settings.dropDelay;
		switch (this.gameDef.settings.gravityType) {
			case "naive":
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					let lines = 0;
					upper: while (true) {
						for (let x = 0; x < this.gameboard.width; x++) {
							const piece = this.gameboard.atXY(x, y - lines);
							if (piece != " ") {
								break upper;
							}
						}
						lines++;
					}

					// if this whole board above is empty, continue
					if (y - lines < 0) continue;

					if (lines > 0) {
						this.gameboard.in();
						for (let x = 0; x < this.gameboard.width; x++) {
							this.gameboard.drop(x, 0, y, lines);
						}
						this.gameboard.out(dropDelay);
						this.state.checkState = CheckState.Gravity;
						return;
					}
				}
				break;

			case "linear":
				let dropped = false;
				this.gameboard.in();
				for (let x = 0; x < this.gameboard.width; x++) {
					for (let y = this.gameboard.height - 1; y > 0; y--) {
						let lines = 0;
						while (this.gameboard.atXY(x, y - lines) === " ") {
							lines++;
						}
						// if this whole column is empty, break
						if (y - lines < 0) break;
						if (lines != 0) {
							this.gameboard.drop(x, 0, y, lines);
							dropped = true;
							break;
						}
					}
				}
				this.gameboard.out(dropDelay);
				if (dropped) {
					this.state.checkState = CheckState.Clear;
				}
				break;

			case "sticky":
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					// X XX
					//
					//  x
					// XXX
					// detect empty lines
					let empty = true;
					for (let x = 0; x < this.gameboard.width; x++) {
						const piece = this.gameboard.atXY(x, y);
						if (piece != " ") {
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
					const sectors = this.gameboard.detectSectors((a, b) => a != " " && b != " ");

					//
					//
					// 1322
					// 333
					// make sectors fall
					for (const sector of sectors) {
						// just so typescript doesn't complain...
						const sector2 = sector as any as [number, number, string][];
						sector2.sort((a, b) => b[1] - a[1]);
						for (const point of sector2) {
							point[2] = this.gameboard.atXY(point[0], point[1]);
							this.gameboard.setXY(point[0], point[1], " ");
						}

						let yy = 1;
						loop: while (true) {
							for (const [px, py] of sector2) {
								const extracted = this.gameboard.atXY(px, py + yy);
								if (extracted != " ") {
									yy -= 1;
									break loop;
								}
							}
							yy += 1;
						}

						for (const [px, py, pt] of sector2) {
							this.gameboard.setXY(px, py + yy, pt);
						}
					}

					// this is a hack that im almost certain does not work, but for now is fine
					// todo: actually rework this to use the gameboard action queuing system, which will fix this bug
					this.state.checkState = CheckState.Done;
				}
				break;

			case "cascade":
				// NOTE: this is going to require a *lot* of state, so for right now i'm going to avoid this
				// well, okay it might not, because we do store which piece is which for colors, but i don't think reversing these is trival
				break;
		}
	}

	clearLines() {
		if (this.flags.noLineClears) return;

		let clearedLines = 0;
		let wasSpin = false;

		// clearedLines
		// three corner rule
		// TODO: scoring
		if (this.lastMove == Keys.RotateLeft || this.lastMove == Keys.RotateRight || this.lastMove == Keys.Rotate180) {
			let corners = 0;
			const piece = this.activePiece;
			const matrix = piece.piece.matrix;
			for (const x of [0, matrix.width - 1]) {
				for (const y of [0, matrix.height - 1]) {
					if (this.gameboard.atXY(piece.x + x, piece.y + y) != " ") {
						corners++;
					}
				}
			}
			if (corners > 2 && this.gameDef.garbage.isSpin(piece.piece.name)) {
				wasSpin = true;
			}
		}

		const pieces = this.gameDef.pieces;
		const lineClearDelay = this.gameDef.settings.lineClearDelay;
		switch (this.gameDef.settings.clearType) {
			case "line":
				this.gameboard.in();
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					let hole = false;
					for (let x = 0; x < this.gameboard.width; x++) {
						const piece = this.gameboard.atXY(x, y);
						if (piece == " " || pieces.get(piece).flags & PieceFlags.Unclearable) {
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
				const sectors = this.gameboard.detectSectors((a, b) => {
					if (a === " ") return false;
					if (pieces.get(a).flags & PieceFlags.Garbage) return false;
					return a === b;
				});
				this.gameboard.in();
				for (const sector of sectors) {
					if (sector.length >= 4) {
						clearedLines += 1 + sector.length - 4;
						for (const [x, y] of sector) {
							this.gameboard.delete(x, y);
							for (const xx of [-1, 1]) {
								for (const yy of [-1, 1]) {
									const piece = this.gameboard.atXY(x + xx, y + yy) ?? " ";
									if (piece != " ") {
										const flags = pieces.get(piece).flags;
										if (flags & PieceFlags.Garbage && !(flags & PieceFlags.Unclearable)) {
											this.gameboard.delete(x + xx, y + yy);
										}
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

		let wasPC = true;
		for (const ele of this.gameboard) {
			if (ele != " ") {
				wasPC = false;
				break;
			}
		}

		if (clearedLines > 0) {
			const garbage = this.gameDef.garbage.clear(clearedLines, this.state.combo, this.state.b2b, wasSpin, wasPC);
			if (this.flags.receiveSentGarbage) {
				console.log("sent garbage", garbage);
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
	}

	public garbageQueue: number[] = [];

	receiveGarbage(lines: number) {
		this.gameboard.in();
		this.gameboard.receiveGarbage(lines);
		this.gameboard.out(0);
	}

	/**
	 * logic loop function, should run 60 times per second
	 */
	frame() {
		if (this.input.isPressed(Keys.Restart)) {
			this.input.pressedMap[Keys.Restart] = false;
			const ghost = this.ghostboard;
			this.restart();
			this.ghostboard = ghost;
			return;
		}

		if (this.input.isPressed(Keys.Pause) && this.state.pauseBuffer == 0) {
			this.paused = !this.paused;
			this.state.pauseBuffer = 60; // 0.5s
		} else if (this.state.pauseBuffer != 0) {
			this.state.pauseBuffer--;
		}

		if (this.paused) return;

		if (this.failed) {
			if (this.state.failTimer >= 60) {
				this._signal.emit("stop");
				this._signal.emit("fail");
				return;
			}
			if (this.input.isPressed(Keys.Fail)) {
				this.state.failTimer += 1;
			}
			return;
		}

		if (this.input.isPressed(Keys.Fail)) {
			this.state.failBuffer = 10;
			if (this.state.failTimer >= 60) {
				this.state.failTimer = -10;
				this.gameOver();
			} else {
				this.state.failTimer += 1;
			}
		} else if (this.state.failBuffer <= 0) {
			if (this.state.failTimer >= 0) this.state.failTimer -= 1;
		} else {
			this.state.failBuffer--;
		}

		if (this.gameboard.step()) return;
		if (this.state.checkState == CheckState.Clear) {
			this.state.checkState = CheckState.Done;
			this.clearLines();
			if (this.gameDef.settings.gravityType !== "naive") {
				this.state.checkState = CheckState.Gravity;
			}
		} else if (this.state.checkState == CheckState.Gravity) {
			this.state.checkState = CheckState.Done;
			this.gravity();
		}
		if (this.state.checkState != CheckState.Done) return;

		const { boardSize, screenSize, are, hold: canHold, gravity, lockDelay, holdDelay } = this.gameDef.settings;

		// if no piece,
		if (this.activePiece.invalid) {
			// wait for are
			if (this.state.areTimer <= are) {
				this.state.areTimer++;
				return;
			}

			if (canHold && this.swapHold) {
				const pieceName = this.holdPiece;
				const piece = this.gameDef.pieces.get(pieceName);
				// x = ceil((BW - n) / 2)
				const x = Math.ceil((boardSize[0] - piece.matrix.width) / 2);
				let y = screenSize[1] + 1;
				if (y > boardSize[1]) y = boardSize[1];

				this.holdPiece = this.activePiece.piece.name;
				this.activePiece = new PieceState(this, piece, RotState.Initial, x - 1, y - 1);
				this.swapHold = false;
			} else {
				// generate piece
				const pieceName = this.gameDef.randomizer.next();
				const piece = this.gameDef.pieces.get(pieceName);
				// x = ceil((BW - n) / 2)
				let x = Math.ceil((boardSize[0] - piece.matrix.width) / 2);
				let y = screenSize[1] + 1;
				if (piece.matrix.height > 3) {
					y -= 1;
				}
				if (y > boardSize[1]) y = boardSize[1];
				if (x < 1) x = 1;
				if (y < 1) y = 1;

				this.activePiece = new PieceState(this, piece, RotState.Initial, x - 1, y - 1);
			}

			// check if player is trying to rotate piece, rotate
			this.handleInputs();

			// if piece intersects gameboard,
			if (this.pieceIntersecting(this.activePiece)) {
				const piece = this.activePiece.relative(0, -2);
				if (!this.pieceIntersecting(piece)) {
					this.activePiece = piece;
				} else {
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
					this.swapHold = this.holdPiece != " ";
					if (this.swapHold == false) {
						this.holdPiece = this.activePiece.piece.name;
					}
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
					this.state.checkState = CheckState.Clear;
				}
			} else {
				// TODO: [garbage] below
				// eventually we will probably push the piece up because
				// the only way to get in this state is probably garbage?
				// and then only if the piece can't be pushed up then we game over
				this.gameOver();
			}
		}

		if (this.mode) {
			this.mode.frame();
		}
	}

	movedLastFrame = true;

	devInputs() {
		if (this.input.isPressed(Keys.DiscardActivePiece)) {
			this.activePiece.invalidate();
			this.input.pressedMap[Keys.DiscardActivePiece] = false;
		}

		if (this.input.isPressed(Keys.ClearHoldBox)) {
			this.holdPiece = " ";
			this.input.pressedMap[Keys.ClearHoldBox] = false;
		}

		if (this.input.isPressed(Keys.Ghostboard)) {
			const { boardSize } = this.gameDef.settings;
			this.ghostboard = this.gameboard.copy();
			this.gameboard = new Gameboard(boardSize[0], boardSize[1], this).fill(" ");
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
				pieces,
			} = this.gameDef;

			const piecesKeys = [...pieces.keys()];
			const nextPieceName = piecesKeys[(piecesKeys.indexOf(this.activePiece.piece.name) + 1) % piecesKeys.length];

			const piece = pieces.get(nextPieceName);
			// x = ceil((BW - n) / 2)
			const x = Math.ceil((boardSize[0] - piece.matrix.width) / 2);
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
			let piece;
			switch (specialRotation) {
				case "flip":
					const p = this.activePiece;
					const name = p.piece.name;
					if (name.endsWith("'")) {
						const pieceData = this.gameDef.pieces.get(name.slice(0, -1));
						if (pieceData == undefined) {
							piece = undefined;
							break;
						}
						piece = new PieceState(this, pieceData, RotState.Initial, p.x, p.y);
						if (p.rot.value == RotState.Right.value) {
							piece.rotate90degcc();
						}
						if (p.rot.value == RotState.Left.value) {
							piece.rotate90deg();
						}
					} else {
						const pieceData = this.gameDef.pieces.get(name + "'");
						if (pieceData == undefined) {
							piece = undefined;
							break;
						}
						piece = new PieceState(this, pieceData, RotState.Initial, p.x, p.y);
						if (p.rot.value == RotState.Left.value) {
							piece.rotate90deg();
						}
						if (p.rot.value == RotState.Right.value) {
							piece.rotate90degcc();
						}
					}
					if (p.rot.value == RotState.Twice.value) {
						piece.rotate90deg();
						piece.rotate90deg();
					}
					if (this.pieceIntersecting(piece)) {
						piece = undefined;
					}
					break;
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
