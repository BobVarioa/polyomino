import { ArrayMatrix } from "../../utils/ArrayMatrix";
import { Piece } from "../GameDef";
import { PieceState } from "../PieceState";
import { BaseDraw } from "./BaseDraw";

export class CanvasDraw extends BaseDraw {
	ctx: CanvasRenderingContext2D;
	ctxQueue: CanvasRenderingContext2D;
	ctxHold: CanvasRenderingContext2D;

	maxWidth: number;
	maxHeight: number;

	topLeftMap: Map<string, [number, number]>;

	reset() {
		super.reset();
		const gameDef = this.logic.gameDef;

		this.canvas.width = this.grid * gameDef.settings.screenSize[0];
		this.canvas.height = this.grid * gameDef.settings.screenSize[1];
		this.ctx = this.canvas.getContext("2d");

		this.topLeftMap = new Map();

		let maxW = 0;
		let maxH = 0;
		for (const piece of gameDef.pieces.values()) {
			let topLeftPoint: [number, number] = [0, 0];
			let realWidth = 0;
			let realHeight = 0;
			// NOTE: you probably don't need two loops here but pieces are so small, and this only happens once, so this really shouldn't be a big deal
			column: for (let x = 0; x < piece.matrix.width; x++) {
				for (let y = 0; y < piece.matrix.height; y++) {
					if (piece.matrix.atXY(x, y) != 0) {
						if (realWidth == 0) {
							topLeftPoint[0] = x;
						}
						realWidth++;
						continue column;
					}
				}
			}

			row: for (let y = 0; y < piece.matrix.height; y++) {
				for (let x = 0; x < piece.matrix.width; x++) {
					if (piece.matrix.atXY(x, y) != 0) {
						if (realHeight == 0) {
							topLeftPoint[1] = y;
						}
						realHeight++;
						continue row;
					}
				}
			}

			this.topLeftMap.set(piece.name, topLeftPoint);

			maxW = Math.max(realWidth, maxW);
			maxH = Math.max(realHeight, maxH);
		}
		this.maxHeight = maxH * this.grid;
		this.maxWidth = maxW * this.grid;

		this.holdCanvas.classList.remove("gone");
		this.holdCanvas.width = this.maxWidth + 20; // 10px padding + piece size
		this.holdCanvas.height = this.maxHeight + 20; // 10px padding + piece size
		this.ctxHold = this.holdCanvas.getContext("2d");

		this.queueCanvas.classList.remove("gone");
		this.queueCanvas.width = this.maxWidth + 20; // 10px padding + piece size
		this.queueCanvas.height =
			this.maxHeight * gameDef.settings.queueLength + 10 * (gameDef.settings.queueLength + 2); // 10px padding top and bottom + 5x piece size + 10px padding between pieces
		this.ctxQueue = this.queueCanvas.getContext("2d");
	}

	private drawPieceState(piece: PieceState) {
		const {
			grid,
			sh,
			ctx,
			logic: { gameDef },
		} = this;

		for (let y = 0; y < piece.data.height; y++) {
			for (let x = 0; x < piece.data.width; x++) {
				const v = piece.data.atXY(x, y);
				if (v !== 0) {
					ctx.fillStyle =
						gameDef.colors.get(piece.piece.name) ?? gameDef.colors.get(gameDef.subpieces.get(v));
					ctx.fillRect((piece.x + x) * grid, (piece.y - sh + y) * grid, grid - 1, grid - 1);
				}
			}
		}
	}

	private drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, offsetX: number, offsetY: number) {
		const {
			grid,
			logic: { gameDef },
		} = this;

		const topLeft = this.topLeftMap.get(piece.name);
		for (let y = topLeft[1]; y < piece.matrix.height; y++) {
			for (let x = topLeft[0]; x < piece.matrix.width; x++) {
				const v = piece.matrix.atXY(x, y);
				if (v != 0) {
					ctx.fillStyle = gameDef.colors.get(piece.name) ?? gameDef.colors.get(gameDef.subpieces.get(v));
					ctx.fillRect(
						offsetX + (x - topLeft[0]) * grid,
						offsetY + (y - topLeft[1]) * grid,
						grid - 1,
						grid - 1
					);
				}
			}
		}
	}

	private drawBoard(playfield: ArrayMatrix<string>, height: number) {
		const {
			ctx,
			grid,
			sh,
			sw,
			logic: {
				gameDef: { colors },
			},
		} = this;
		// todo: display half of the row above the screen if boardSize is bigger than screenSize

		for (let y = sh; y < height; y++) {
			for (let x = 0; x < sw; x++) {
				const name = playfield.atXY(x, y);
				if (name == " ") continue;

				ctx.fillStyle = colors.get(name);
				ctx.fillRect(x * grid, (y - sh) * grid, grid - 1, grid - 1);
			}
		}
	}

	lastQueueTop: string;
	lastHold: string;

	clear(): void {
		if (this.ctx && this.canvas) {
			this.canvas.width = 320;
			this.canvas.height = 640;
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
		if (this.queueCanvas) {
			this.queueCanvas.classList.add("gone");
		}
		if (this.holdCanvas) {
			this.holdCanvas.classList.add("gone");
		}
	}

	frame(deltaTime: number) {
		const { ctx } = this;
		const { gameDef } = this.logic;
		ctx.fillStyle = this.gridColor;
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		const boardSize = gameDef.settings.boardSize;

		const { grid, sh, sw } = this;
		ctx.fillStyle = this.backgroundColor;
		for (let y = sh; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				// drawing 1 px smaller than the grid creates a grid effect
				ctx.clearRect(x * grid, (y - sh) * grid, grid - 1, grid - 1);
			}
		}

		ctx.save();
		ctx.globalAlpha = 0.4;
		this.drawBoard(this.logic.ghostboard, boardSize[1]);
		ctx.restore();

		this.drawBoard(this.logic.gameboard, boardSize[1]);

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			ctx.save();
			ctx.globalAlpha = 0.4;
			this.drawPieceState(ghostPiece);
			ctx.restore();

			this.drawPieceState(piece);
		}

		if (this.logic.state.failTimer > 0) {
			ctx.save();
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = "red";
			ctx.fillRect(
				0,
				this.canvas.height - this.canvas.height * Math.min(1, this.logic.state.failTimer / 60),
				this.canvas.width,
				this.canvas.height
			);
			ctx.restore();
		}

		// draw queue
		const nextPiece = gameDef.randomizer.peek(1)[0];
		if (this.lastQueueTop != nextPiece) {
			this.lastQueueTop = nextPiece;

			const queue = gameDef.randomizer.peek(gameDef.settings.queueLength).map((v) => gameDef.pieces.get(v));
			this.ctxQueue.clearRect(0, 0, this.queueCanvas.width, this.queueCanvas.height);
			let x = 10;
			let y = 10;
			for (const piece of queue) {
				this.drawPiece(this.ctxQueue, piece, x, y);
				y += 10 + this.maxHeight;
			}
		}

		// draw hold
		const holdPiece = this.logic.holdPiece;
		if (this.lastHold != holdPiece) {
			this.lastHold = holdPiece;
			this.ctxHold.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);

			if (holdPiece != " ") {
				this.drawPiece(this.ctxHold, gameDef.pieces.get(holdPiece), 10, 10);
			}
		}
	}
}
