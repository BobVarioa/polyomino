import { PieceState } from "./PieceState";
import { Logic } from "./Logic";

export class Draw {
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
