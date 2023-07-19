import { ArrayMatrix } from "../utils/ArrayMatrix";
import { GameDef, Piece } from "./GameDef";
import { InputManager, Keys } from "./InputManager";
import { PieceState, RotState } from "./PieceState";
import { Preferences } from "./Preferences";


export class Logic {
	public gameboard: ArrayMatrix<string>;
	public activePiece: PieceState;
	public holdPiece: string;
	public paused: boolean;
	public holdSwap: boolean;
	public lastMove: Keys;

	constructor(public gameDef: GameDef, public prefs: Preferences, public input: InputManager) { }

	start() {
		// reset randomizer
		this.gameDef.randomizer.reset(Math.random());
		this.timers = {
			areTimer: 0,
			arrTimer: 0,
			dasTimer: 0,
			gravityTimer: 0,
			lockDelayTimer: 0,
			lockDelayMoves: 0,
			pauseBuffer: 0,
		};

		const { boardSize } = this.gameDef.settings;
		// clear gameboard
		this.gameboard = new ArrayMatrix<string>(boardSize[0], boardSize[1]).fill(" ");
		this.activePiece = PieceState.none;
		this.holdPiece = " ";
		this.holdSwap = false;
		this.paused = false;
		this.lastMove = Keys.Pause; // used as a placeholder empty value
	}

	pieceIntersecting(piece: PieceState): boolean {
		for (let x = 0; x < piece.data.width; x++) {
			for (let y = 0; y < piece.data.height; y++) {
				if (piece.data.atXY(x, y) == 1) {
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
		// throw "Game over!";
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

	timers: {
		areTimer: number;
		arrTimer: number;
		dasTimer: number;
		gravityTimer: number;
		lockDelayTimer: number;
		lockDelayMoves: number;
		pauseBuffer: number;
	};

	clearLines() {
		let clearedLines = 0;
		let wasSpin = false;

		let score = 0;

		// clearedLines.length
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

		for (let y = this.gameboard.height - 1; y > 0; y--) {
			let lines = 0;
			upper: while (true) {
				for (let x = 0; x < this.gameboard.width; x++) {
					const piece = this.gameboard.atXY(x, y - lines);
					if (piece == " ") {
						break upper;
					}
				}
				lines++;
			}

			if (lines > 0) {
				clearedLines++;
				for (let yy = y; yy > 0; yy--) {
					for (let x = 0; x < this.gameboard.width; x++) {
						this.gameboard.setXY(x, yy, this.gameboard.atXY(x, yy - lines) ?? " ");
					}
				}
			}
		}

		if (clearedLines >= 0) {
			this.timers.areTimer -= this.gameDef.settings.lineClearDelay * clearedLines;
		}
	}

	/**
	 * logic loop function, should run 60 times per second
	 */
	frame() {
		if (this.input.isKeyPressed(Keys.Pause) && this.timers.pauseBuffer == 0) {
			this.paused = !this.paused;
			this.timers.pauseBuffer = 60; // 0.5s
		} else if (this.timers.pauseBuffer != 0) {
			this.timers.pauseBuffer--;
		}

		if (this.paused) return;

		if (this.input.isKeyPressed(Keys.Fail)) {
			this.gameOver();
		}

		if (this.input.isKeyPressed(Keys.Restart)) {
			this.start();
			return;
		}

		const { boardSize, screenSize, are, hold: canHold, gravity, lockDelay, holdDelay } = this.gameDef.settings;

		// if no piece,
		if (this.activePiece.invalid) {
			// wait for are
			if (this.timers.areTimer <= are) {
				this.timers.areTimer++;
				return;
			} else {
				this.clearLines();
			}

			if (canHold && this.holdSwap) {
				const pieceName = this.holdPiece;
				const piece = this.gameDef.pieces.get(pieceName);
				// x = ceil((BW - n) / 2)
				const x = Math.ceil((boardSize[0] - piece.matrix.width) / 2);
				let y = screenSize[1] + 1;
				if (y > boardSize[1]) y = boardSize[1];

				this.holdPiece = this.activePiece.piece.name;
				this.activePiece = new PieceState(this, piece, RotState.Initial, x - 1, y - 1);
				this.holdSwap = false;
			} else {
				// generate piece
				const pieceName = this.gameDef.randomizer.next();
				const piece = this.gameDef.pieces.get(pieceName);
				// x = ceil((BW - n) / 2)
				const x = Math.ceil((boardSize[0] - piece.matrix.width) / 2);
				let y = screenSize[1] + 1;
				if (y > boardSize[1]) y = boardSize[1];

				this.activePiece = new PieceState(this, piece, RotState.Initial, x - 1, y - 1);
			}

			this.timers.areTimer = 0;

			// check if player is trying to rotate piece, rotate
			// TODO broken
			this.handleInputs();

			// if piece intersects gameboard,
			if (this.pieceIntersecting(this.activePiece)) {
				this.gameOver();
			}
		} else {
			// TODO: [garbage] update garbage ?
			// if is piece in valid location
			if (!this.pieceIntersecting(this.activePiece)) {
				if (canHold && this.input.isKeyPressed(Keys.Hold)) {
					this.activePiece.invalidate();
					this.holdSwap = this.holdPiece != " ";
					if (this.holdSwap == false) {
						this.holdPiece = this.activePiece.piece.name;
					}
					// make are longer for holds
					this.timers.areTimer = -holdDelay;
				}

				// (frames * cells/frames) >= 1 // we moved more than 1 cell, drop piece
				if (this.timers.gravityTimer * gravity >= 1) {
					this.activePiece.softDrop();
					this.timers.gravityTimer = 0;
					this.timers.lockDelayTimer = 0;
				}
				this.timers.gravityTimer += 1;

				this.handleInputs();

				// is piece touching floor?
				if (this.pieceIntersecting(this.activePiece.relative(0, 1))) {
					this.timers.lockDelayTimer += 1;
				}

				if (this.timers.lockDelayTimer >= lockDelay) {
					this.activePiece.write();
					this.timers.lockDelayTimer = 0;
				}
			} else {
				// TODO: [garbage] below
				// eventually we will probably push the piece up because
				// the only way to get in this state is probably garbage?
				// and then only if the piece can't be pushed up then we game over
				this.gameOver();
			}
		}
	}

	movedLastFrame = true;

	handleInputs() {
		let updated = false;
		if (this.input.isKeyPressed(Keys.RotateLeft)) {
			const piece = this.activePiece.rotateLeft();
			if (piece != undefined) {
				this.activePiece = piece;
				// gameboard is flipped to make logic easier
				updated = true;
			}
			this.input.pressedMap[Keys.RotateLeft] = false;
			this.lastMove = Keys.RotateLeft;
		}

		if (this.input.isKeyPressed(Keys.RotateRight)) {
			const piece = this.activePiece.rotateRight();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.RotateRight] = false;
			this.lastMove = Keys.RotateRight;
		}

		if (this.input.isKeyPressed(Keys.Rotate180)) {
			const piece = this.activePiece.rotate180();
			if (piece != undefined) {
				this.activePiece = piece;
				updated = true;
			}
			this.input.pressedMap[Keys.Rotate180] = false;
			this.lastMove = Keys.Rotate180;
		}

		if (this.input.isKeyPressed(Keys.HardDrop)) {
			this.activePiece.hardDrop();
			this.timers.lockDelayTimer = this.gameDef.settings.lockDelay;
			updated = true;
			this.input.pressedMap[Keys.HardDrop] = false;
		}

		if (this.input.isKeyPressed(Keys.SoftDrop)) {
			if (this.prefs.sdf == -1) {
				this.activePiece.hardDrop()
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
				if (this.timers.dasTimer >= this.prefs.das) {
					if (this.timers.arrTimer == 0) {
						if (movingLeft) {
							this.activePiece.moveLeft();
							updated = true;
							this.lastMove = Keys.MoveLeft;
						}

						if (movingRight) {
							this.activePiece.moveRight();
							updated = true;
							this.lastMove = Keys.MoveRight;
						}
					}

					if (this.timers.arrTimer >= this.prefs.arr) {
						this.timers.arrTimer = 0;
					} else {
						this.timers.arrTimer++;
					}
				} else {
					this.timers.dasTimer++;
				}
			} else {
				this.timers.dasTimer = 0;
				this.timers.arrTimer = 0;
				this.movedLastFrame = false;
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
		if (updated && this.timers.lockDelayMoves >= 15) {
			this.timers.lockDelayTimer = 0;
			this.timers.lockDelayMoves++;
		}
	}
}
