import { tetra } from "./data/gameTypes";
import { MultiKeyMap } from "./utils/MultiKeyMap";
import { WrappedGenerator, blackjack } from "./utils/blackjack";
import { ArrayMatrix } from "./utils/ArrayMatrix";

class Piece {
	constructor(public name: string, public matrix: ArrayMatrix<number>, public color: string) {}
}

interface PieceDef {
	def: string;
	color: string;
}

interface GameSchema {
	pieces: Record<string, PieceDef>;
	rotation: Record<string, { "0": string; R: string; "2": string; L: string }>;
	randomizer: string;
	settings: Settings;
}

interface Settings {
	boardSize: [number, number];
	screenSize: [number, number];
	are: number;
	gravity: number;
	lockDelay: number;
	hold: boolean;
	holdDelay: number;
	lineClearDelay: number;
}

class GameDef {
	constructor(
		public pieces: Map<string, Piece>,
		public rotations: MultiKeyMap<string, KickTable>,
		public randomizer: WrappedGenerator<string>,
		public settings: Settings
	) {}

	static fromJson(json: GameSchema | string) {
		if (typeof json == "string") {
			json = JSON.parse(json) as GameSchema;
		}

		const pieces = new Map();

		for (const [key, value] of Object.entries(json.pieces)) {
			const data = value.def.split("/");
			const size = data[0].length;
			const matrix = new ArrayMatrix<number>(size, size);

			for (let x = 0; x < size; x++) {
				for (let y = 0; y < size; y++) {
					matrix.setXY(x, y, data[y][x] === "0" ? 0 : 1);
				}
			}

			pieces.set(key, new Piece(key, matrix, value.color));
		}

		const rotations = new MultiKeyMap<string, KickTable>();

		for (const [key, value] of Object.entries(json.rotation)) {
			const keys = key.split(",");

			const kickTable: any = {};

			for (const validKey of ["0", "R", "2", "L"] as const) {
				const str = value[validKey];

				kickTable[validKey] = str.split(";").map((v) => {
					const [x, y] = v.split(",");
					return [parseInt(x), parseInt(y)];
				});
			}

			rotations.set(keys, kickTable);
		}

		const randomizer = blackjack(json.randomizer);

		const settings = json.settings;

		return new GameDef(pieces, rotations, randomizer, settings);
	}
}

interface KickTable {
	"0": [number, number][];
	R: [number, number][];
	"2": [number, number][];
	L: [number, number][];
}
class Preferences {
	public arr: number = 2;
	public das: number = 10;
	public softDropSpeed: number;

	constructor() {}
}

class RotState {
	static Initial = new RotState(0);
	static Left = new RotState(1);
	static Flipped = new RotState(2);
	static Right = new RotState(3);

	constructor(public value: number) {}

	left() {
		let value = this.value + 1;
		if (value > 3) value = 0;
		return new RotState(value);
	}

	right() {
		let value = this.value - 1;
		if (value < 0) value = 3;
		return new RotState(value);
	}

	flip() {
		return this.left().left();
	}

	name(): "0" | "L" | "2" | "R" {
		switch (this.value) {
			case 0:
				return "0";
			case 1:
				return "L";
			case 2:
				return "2";
			case 3:
				return "R";
		}
	}
}

enum Keys {
	RotateLeft,
	RotateRight,
	Rotate180,
	MoveLeft,
	MoveRight,
	SoftDrop,
	HardDrop,
	Hold,
	Pause,
	// NOTE: must be last element
	Length,
}

class InputManager {
	inputMap = new MultiKeyMap<string, Keys>();
	pressedMap: boolean[] = new Array(Keys.Length).fill(false);

	constructor(ele: Node) {
		document.addEventListener("keydown", (ev) => this.keyDown(ev.key));
		document.addEventListener("keyup", (ev) => this.keyUp(ev.key));
	}

	setKey(id: Keys, key: string) {
		this.inputMap.deleteKey(key);
		this.inputMap.set([key], id);
	}

	isKeyPressed(key: Keys) {
		return this.pressedMap[key];
	}

	keyDown(k: string) {
		const key = this.inputMap.get(k);
		if (key != undefined) {
			this.pressedMap[key] = true;
		}
	}
	keyUp(k: string) {
		const key = this.inputMap.get(k);
		if (key != undefined) {
			this.pressedMap[key] = false;
		}
	}
}

class PieceState {
	public data: ArrayMatrix<number>;
	public invalid = false;

	static none = new PieceState(undefined, undefined, RotState.Initial, 0, 0).invalidate();

	constructor(public parent: Logic, public piece: Piece, public rot: RotState, public x: number, public y: number) {
		this.data = piece?.matrix;
	}

	invalidate() {
		this.invalid = true;
		return this;
	}

	moveLeft() {
		this.x -= 1;
		if (this.parent.pieceIntersecting(this)) {
			this.x += 1;
		}
		return this;
	}

	moveRight() {
		this.x += 1;
		if (this.parent.pieceIntersecting(this)) {
			this.x -= 1;
		}
		return this;
	}

	softDrop() {
		this.y += 1;
		if (this.parent.pieceIntersecting(this)) {
			this.y -= 1;
		}
		return this;
	}

	hardDrop() {
		// this just straight up shouldn't affect performance, but a few ideas on how to make this faster
		// 1. keep track of top empty row whenever piece is set
		// 2. count from bottom instead of top since typically that's more empty, unless stack is > half tall
		while (true) {
			this.y += 1;
			if (this.parent.pieceIntersecting(this)) {
				this.y -= 1;
				break;
			}
		}
		return this;
	}

	rotate90deg() {
		this.data = this.data.rotate90deg();
		this.rot = this.rot.right();
		return this;
	}

	rotate90degcc() {
		this.data = this.data.rotate90degcc();
		this.rot = this.rot.left();
		return this;
	}

	rotateLeft() {
		let piece = this.copy();

		let rot = piece.rot;
		piece.rotate90degcc();
		let newRot = piece.rot;
		let kicks = piece.parent.calculateKicks(piece.piece, rot, newRot);

		for (const [xK, yK] of kicks) {
			const translated = piece.relative(xK, yK);
			if (!this.parent.pieceIntersecting(translated)) {
				return translated;
			}
		}

		return undefined;
	}

	rotateRight() {
		let piece = this.copy();

		let rot = piece.rot;
		piece.rotate90deg();
		let newRot = piece.rot;
		let kicks = piece.parent.calculateKicks(piece.piece, rot, newRot);

		for (const [xK, yK] of kicks) {
			const translated = piece.relative(xK, yK);
			if (!this.parent.pieceIntersecting(translated)) {
				return translated;
			}
		}

		return undefined;
	}

	rotate180() {
		let piece = this.copy();

		let rot = piece.rot;
		piece.rotate90deg().rotate90deg();
		let newRot = piece.rot;
		let kicks = piece.parent.calculateKicks(piece.piece, rot, newRot);

		for (const [xK, yK] of kicks) {
			const translated = piece.relative(xK, yK);
			if (!this.parent.pieceIntersecting(translated)) {
				return translated;
			}
		}

		return undefined;
	}

	copy() {
		let piece = new PieceState(this.parent, this.piece, this.rot, this.x, this.y);
		piece.data = this.data;
		return piece;
	}

	at(x: number, y: number) {
		let piece = this.copy();
		piece.x = x;
		piece.y = y;
		return piece;
	}

	relative(x: number, y: number) {
		return this.at(this.x + x, this.y + y);
	}

	/**
	 * writes piece to gameboard then invalidates self
	 */
	write() {
		for (let y = 0; y < this.data.height; y++) {
			for (let x = 0; x < this.data.width; x++) {
				if (this.data.atXY(x, y) == 1) {
					this.parent.gameboard.setXY(this.x + x, this.y + y, this.piece.name);
				}
			}
		}

		this.invalidate();
	}
}

class Logic {
	public gameboard: ArrayMatrix<string>;
	public activePiece: PieceState;
	public holdPiece: string;
	paused: boolean;
	holdSwap: boolean;
	lastMove: Keys;

	constructor(public gameDef: GameDef, public prefs: Preferences, public input: InputManager) {}

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
		}

		if (this.input.isKeyPressed(Keys.SoftDrop)) {
			this.activePiece.softDrop();
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

class Draw {
	ctx: CanvasRenderingContext2D;
	grid: number;
	sw: number;
	sh: number;
	constructor(public logic: Logic, public canvas: HTMLCanvasElement) {
		this.ctx = canvas.getContext("2d");
	}

	start() {
		this.grid = 32;

		const { boardSize, screenSize } = this.logic.gameDef.settings;
		this.sw = screenSize[0];
		// i.e 40 - 20 = 20, row 20 is our 0
		this.sh = boardSize[1] - screenSize[1];
	}

	frame() {
		const { ctx, grid, sh, sw } = this;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		const { pieces } = this.logic.gameDef;

		// todo: display half of the row above the screen if boardSize is bigger than screenSize
		// draw the playfield
		for (let y = sh; y < this.logic.gameDef.settings.boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				const playfield = this.logic.gameboard;
				const name = playfield.atXY(x, y);
				if (name != " ") {
					ctx.fillStyle = pieces.get(name).color;

					// drawing 1 px smaller than the grid creates a grid effect
					ctx.fillRect(x * grid, (y - sh) * grid, grid - 1, grid - 1);
				}
			}
		}

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			this.drawPiece(piece);
			this.drawPiece(ghostPiece, true);
		}
	}

	private drawPiece(piece: PieceState, ghost: boolean = false) {
		const { grid, sh, ctx } = this;

		ctx.save();
		ctx.fillStyle = piece.piece.color;
		if (ghost) ctx.globalAlpha = 0.4;
		for (let y = 0; y < piece.data.height; y++) {
			for (let x = 0; x < piece.data.width; x++) {
				if (piece.data.atXY(x, y) == 1) {
					// drawing 1 px smaller than the grid creates a grid effect
					ctx.fillRect((piece.x + x) * grid, (piece.y - sh + y) * grid, grid - 1, grid - 1);
				}
			}
		}
		ctx.restore();
	}
}

function init() {
	let gameDef = GameDef.fromJson(tetra as any as GameSchema);
	let prefs = new Preferences();

	prefs.arr = 0;
	prefs.das = 7;

	let input = new InputManager(document);

	input.setKey(Keys.RotateLeft, "z");
	input.setKey(Keys.RotateRight, "x");
	input.setKey(Keys.Rotate180, "c");
	input.setKey(Keys.MoveLeft, "ArrowLeft");
	input.setKey(Keys.MoveRight, "ArrowRight");
	input.setKey(Keys.SoftDrop, "ArrowDown");
	input.setKey(Keys.HardDrop, "ArrowUp");
	input.setKey(Keys.Hold, " ");
	input.setKey(Keys.Pause, "Escape");

	let logic = new Logic(gameDef, prefs, input);
	logic.start();

	let canvas = document.querySelector<HTMLCanvasElement>("#gameBoard");

	let draw = new Draw(logic, canvas);
	draw.start();
	let rAF;

	(async () => {
		const fps = 60;

		const func = () => {
			logic.frame();

			setTimeout(func, 1000 / fps);
		};

		func();
	})().catch((v) => {
		cancelAnimationFrame(rAF);
	});

	function drawLoop() {
		rAF = requestAnimationFrame(drawLoop);
		draw.frame();
	}
	rAF = requestAnimationFrame(drawLoop);
}

document.addEventListener("DOMContentLoaded", init);
