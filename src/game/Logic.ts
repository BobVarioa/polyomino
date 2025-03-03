import { ArrayMatrix } from "../utils/ArrayMatrix";
import { GameDef, Piece } from "./GameDef";
import { InputManager, Keys } from "./InputManager";
import { PieceState, RotState } from "./PieceState";
import { Preferences } from "./Preferences";
import { AbilityManager } from "./AbilityManager";
import random from "secure-random";
import { pento, tetro } from "../data/gameTypes";
import { BaseDraw } from "./render/BaseDraw";
import { EventEmitter } from "eventemitter3";
import { BaseMode } from "./BaseMode";

export class Logic {
	public gameboard: ArrayMatrix<string>;
	public ghostboard: ArrayMatrix<string>;
	public activePiece: PieceState;
	public holdPiece: string;
	public paused: boolean;
	public swapHold: boolean;
	public failed: boolean;
	public lastMove: Keys;
	public abilityManager: AbilityManager;
	public gameDef: GameDef;
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
			this.frame();

			timeout = setTimeout(func, 1000 / fps);
		};

		this._signal.on("stop", () => {
			cancelAnimationFrame(rAF);
			clearTimeout(timeout);
		});
		this._signal.on("start", () => {
			func();
			requestAnimationFrame(drawLoop);
		});

		return this._signal;
	}

	restart() {
		this._signal.emit("stop");
		this.reset();
		this._signal.emit("start");
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
		this.gameDef.randomizer.reset(random(1, { type: "Uint8Array" })[0]);
		this.counters = {
			areTimer: 0,
			arrTimer: 0,
			dasTimer: 0,
			gravityTimer: 0,
			lockDelayTimer: 0,
			lockDelayMoves: 0,
			pauseBuffer: 0,
			heldLast: false,
			combo: 0,
			timesDropped: 0,
			dasDirection: undefined,
			failTimer: 0,
			failBuffer: 0,
		};
		this.failed = false;

		this.flags = {
			noLineClears: false,
			disableGravity: false,
			disableLockDelay: false,
		};

		this.abilityManager = new AbilityManager(this);

		const { boardSize } = this.gameDef.settings;
		// clear gameboard
		this.gameboard = new ArrayMatrix<string>(boardSize[0], boardSize[1]).fill(" ");
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

	counters: {
		areTimer: number;
		arrTimer: number;
		dasTimer: number;
		gravityTimer: number;
		lockDelayTimer: number;
		lockDelayMoves: number;
		pauseBuffer: number;
		heldLast: boolean;
		combo: number;
		timesDropped: number;
		dasDirection: Keys;
		failTimer: number;
		failBuffer: number;
	};

	flags: {
		noLineClears: boolean;
		disableGravity: boolean;
		disableLockDelay: boolean;
	};

	gravity() {
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

					if (lines > 0) {
						for (let yy = y; yy > 0; yy--) {
							for (let x = 0; x < this.gameboard.width; x++) {
								this.gameboard.setXY(x, yy, this.gameboard.atXY(x, yy - lines) ?? " ");
							}
						}
					}
				}
				break;

			case "linear":
				let maxDropped = 0;
				for (let x = 0; x < this.gameboard.width; x++) {
					for (let y = this.gameboard.height - 1; y > 0; y--) {
						let lines = 0;
						while (this.gameboard.atXY(x, y - lines) === " ") {
							lines++;
						}
						if (y - lines < 0) break;
						for (let yy = y; yy > 0; yy--) {
							this.gameboard.setXY(x, yy, this.gameboard.atXY(x, yy - lines) ?? " ");
						}
						maxDropped = Math.max(lines, maxDropped);
					}
				}
				this.counters.timesDropped += maxDropped;
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

					this.counters.timesDropped++;
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
			wasSpin = corners > 2;
		}

		switch (this.gameDef.settings.clearType) {
			case "line":
				for (let y = this.gameboard.height - 1; y > 0; y--) {
					let hole = false;
					for (let x = 0; x < this.gameboard.width; x++) {
						const piece = this.gameboard.atXY(x, y);
						if (piece == " ") {
							hole = true;
							break;
						}
					}

					if (!hole) {
						for (let x = 0; x < this.gameboard.width; x++) {
							this.gameboard.setXY(x, y, " ");
						}
						clearedLines += 1;
					}
				}
				break;

			case "color":
				const sectors = this.gameboard.detectSectors((a, b) => a != " " && a == b);
				for (const sector of sectors) {
					if (sector.length >= 4) {
						clearedLines += 1;
						for (const [x, y] of sector) {
							this.gameboard.setXY(x, y, " ");
						}
					}
				}
				break;
		}

		if (clearedLines > 0) {
			this.counters.areTimer -= this.gameDef.settings.lineClearDelay * (clearedLines / 2);
			this.counters.combo += 1;
		} else {
			this.counters.combo = 0;
		}

		this.abilityManager.charge += clearedLines;
		// console.log(this.abilityManager.charge);

		return clearedLines;
	}

	/**
	 * logic loop function, should run 60 times per second
	 */
	frame() {
		if (this.input.isKeyPressed(Keys.Restart)) {
			this.input.pressedMap[Keys.Restart] = false;
			const ghost = this.ghostboard;
			this.restart();
			this.ghostboard = ghost;
			return;
		}

		if (this.input.isKeyPressed(Keys.Pause) && this.counters.pauseBuffer == 0) {
			this.paused = !this.paused;
			this.counters.pauseBuffer = 60; // 0.5s
		} else if (this.counters.pauseBuffer != 0) {
			this.counters.pauseBuffer--;
		}

		if (this.paused) return;

		if (this.failed) {
			if (this.counters.failTimer >= 60) {
				this._signal.emit("stop");
				this._signal.emit("fail");
				return;
			}
			if (this.input.isKeyPressed(Keys.Fail)) {
				this.counters.failTimer += 1;
			}
			return;
		}

		if (this.input.isKeyPressed(Keys.Fail)) {
			this.counters.failBuffer = 10;
			if (this.counters.failTimer >= 60) {
				this.counters.failTimer = -10;
				this.gameOver();
			} else {
				this.counters.failTimer += 1;
			}
		} else if (this.counters.failBuffer <= 0) {
			if (this.counters.failTimer >= 0) this.counters.failTimer -= 1;
		} else {
			this.counters.failBuffer--;
		}

		const { boardSize, screenSize, are, hold: canHold, gravity, lockDelay, holdDelay } = this.gameDef.settings;

		// if no piece,
		if (this.activePiece.invalid) {
			// wait for are
			if (this.counters.areTimer <= are) {
				this.counters.areTimer++;
				return;
			} else {
				this.counters.timesDropped = 0;
				if (this.gameDef.settings.gravityType == "naive") {
					if (this.clearLines() != 0) this.gravity();
					if (this.counters.areTimer <= are) return;
				} else {
					this.clearLines();
					this.gravity();
					if (this.counters.timesDropped > 1) {
						this.counters.areTimer -=
							this.counters.timesDropped * Math.floor(this.gameDef.settings.lineClearDelay / 8);
					}
					if (this.counters.areTimer <= are) return;
				}
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

			this.counters.areTimer = 0;

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
			// TODO: [garbage] update garbage ?
			// if is piece in valid location
			if (!this.pieceIntersecting(this.activePiece)) {
				if (canHold && !this.counters.heldLast && this.input.isKeyPressed(Keys.Hold)) {
					this.activePiece.invalidate();
					this.swapHold = this.holdPiece != " ";
					if (this.swapHold == false) {
						this.holdPiece = this.activePiece.piece.name;
					}
					// make are longer for holds
					this.counters.areTimer = -holdDelay;
					this.counters.heldLast = true;
					return;
				}

				// (frames * cells/frames) >= 1 // we moved more than 1 cell, drop piece
				if (!this.flags.disableGravity && this.counters.gravityTimer * gravity >= 1) {
					this.activePiece.softDrop();
					this.counters.gravityTimer = 0;
					this.counters.lockDelayTimer = 0;
				}
				this.counters.gravityTimer += 1;

				this.handleInputs();

				// is piece touching floor?
				if (!this.flags.disableLockDelay && this.pieceIntersecting(this.activePiece.relative(0, 1))) {
					this.counters.lockDelayTimer += 1;
				}

				this.abilityManager.frame();

				if (this.counters.lockDelayTimer >= lockDelay) {
					this.activePiece.write();
					this.counters.heldLast = false;
					this.counters.lockDelayTimer = 0;
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
		if (this.input.isKeyPressed(Keys.DiscardActivePiece)) {
			this.activePiece.invalidate();
			this.input.pressedMap[Keys.DiscardActivePiece] = false;
		}

		if (this.input.isKeyPressed(Keys.ClearHoldBox)) {
			this.holdPiece = " ";
			this.input.pressedMap[Keys.ClearHoldBox] = false;
		}

		if (this.input.isKeyPressed(Keys.Ghostboard)) {
			const { boardSize } = this.gameDef.settings;
			this.ghostboard = this.gameboard.copy();
			this.gameboard = new ArrayMatrix<string>(boardSize[0], boardSize[1]).fill(" ");
			this.input.pressedMap[Keys.Ghostboard] = false;
		}

		if (this.input.isKeyPressed(Keys.ToggleGravity)) {
			this.flags.disableGravity = !this.flags.disableGravity;
			this.input.pressedMap[Keys.ToggleGravity] = false;
		}

		if (this.input.isKeyPressed(Keys.CycleActivePiece)) {
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

		if (this.input.isKeyPressed(Keys.ToggleLocking)) {
			this.flags.disableLockDelay = !this.flags.disableLockDelay;
			this.input.pressedMap[Keys.ToggleLocking] = false;
		}

		if (this.input.isKeyPressed(Keys.TetroMode)) {
			this.swapGameDef(tetro);
			this.restart();
			this.input.pressedMap[Keys.TetroMode] = false;
		}

		if (this.input.isKeyPressed(Keys.PentoMode)) {
			this.swapGameDef(pento);
			this.restart();
			this.input.pressedMap[Keys.PentoMode] = false;
		}
	}

	handleInputs() {
		let updated = false;
		const { specialRotation, rotation } = this.gameDef.settings;

		this.devInputs();

		if (this.input.isKeyPressed(Keys.RotateLeft) && rotation) {
			const piece = this.activePiece.rotateLeft();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateLeft] = false;
			this.lastMove = Keys.RotateLeft;
		}

		if (this.input.isKeyPressed(Keys.RotateRight) && rotation) {
			const piece = this.activePiece.rotateRight();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateRight] = false;
			this.lastMove = Keys.RotateRight;
		}

		if (this.input.isKeyPressed(Keys.Rotate180) && rotation) {
			const piece = this.activePiece.rotate180();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.Rotate180] = false;
			this.lastMove = Keys.Rotate180;
		}

		if (this.input.isKeyPressed(Keys.Ability)) {
			this.abilityManager.handleInput();
			this.input.pressedMap[Keys.Ability] = false;
		}

		if (this.input.isKeyPressed(Keys.RotateSpecial) && specialRotation != "none") {
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

		if (this.input.isKeyPressed(Keys.HardDrop)) {
			this.activePiece.hardDrop();
			this.counters.lockDelayTimer = this.gameDef.settings.lockDelay;
			updated = true;
			this.input.pressedMap[Keys.HardDrop] = false;
		}

		if (this.input.isKeyPressed(Keys.SoftDrop)) {
			if (this.prefs.sdf == -1) {
				this.activePiece.hardDrop();
			} else {
				let i = this.prefs.sdf;
				while (i-- > 0) this.activePiece.softDrop();
			}
			updated = true;
		}

		const movingLeft = this.input.isKeyPressed(Keys.MoveLeft);
		const movingRight = this.input.isKeyPressed(Keys.MoveRight);
		let attemptingMovement = movingLeft || movingRight;

		if (this.movedLastFrame) {
			if (attemptingMovement) {
				if (this.counters.dasTimer >= this.prefs.das) {
					if (this.counters.arrTimer == 0) {
						if (movingLeft) {
							this.activePiece.moveLeft();
							updated = true;
							this.lastMove = Keys.MoveLeft;
							this.counters.dasDirection = Keys.MoveLeft;
						}

						if (movingRight) {
							this.activePiece.moveRight();
							updated = true;
							this.lastMove = Keys.MoveRight;
							this.counters.dasDirection = Keys.MoveRight;
						}
					}

					if (this.counters.arrTimer >= this.prefs.arr) {
						this.counters.arrTimer = 0;
					} else {
						this.counters.arrTimer++;
					}
				} else {
					if (this.counters.dasDirection != undefined) {
						const movedLeft = this.counters.dasDirection == Keys.MoveLeft;
						const movedRight = this.counters.dasDirection == Keys.MoveRight;
						if (movedLeft && movingLeft) {
							this.counters.dasTimer++;
						} else if (movedRight && movingRight) {
							this.counters.dasTimer++;
						} else {
							this.counters.dasTimer = 0;
							this.counters.dasDirection = undefined;
						}
					} else {
						this.counters.dasTimer++;
						if (movingLeft) this.counters.dasDirection = Keys.MoveLeft;
						if (movingRight) this.counters.dasDirection = Keys.MoveRight;
					}
				}
			} else {
				this.counters.dasTimer = 0;
				this.counters.arrTimer = 0;
				this.movedLastFrame = false;
				this.counters.dasDirection = undefined;
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
		if (updated && this.counters.lockDelayMoves >= 15) {
			this.counters.lockDelayTimer = 0;
			this.counters.lockDelayMoves++;
		}
	}
}
