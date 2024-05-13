import { ArrayMatrix } from "../../utils/ArrayMatrix";
import { PieceState } from "../PieceState";
import { BaseDraw } from "./BaseDraw";

export class CanvasDraw extends BaseDraw {
	ctx: CanvasRenderingContext2D;

	start() {
		super.start();

		this.ctx = this.canvas.getContext("2d");
		return this.frameCanvas.bind(this);
	}

	private drawPiece(piece: PieceState) {
		const { grid, sh, ctx } = this;
		
		ctx.fillStyle = piece.piece.color;
		for (let y = 0; y < piece.data.height; y++) {
			for (let x = 0; x < piece.data.width; x++) {
				if (piece.data.atXY(x, y) == 1) {
					ctx.fillRect((piece.x + x) * grid, (piece.y - sh + y) * grid, grid - 1, grid - 1);
				}
			}
		}
	}

	private drawBoard(playfield: ArrayMatrix<string>, height: number) {
		const { pieces } = this.logic.gameDef;
		const { ctx, grid, sh, sw } = this;
		// todo: display half of the row above the screen if boardSize is bigger than screenSize

		for (let y = sh; y < height; y++) {
			for (let x = 0; x < sw; x++) {
				const name = playfield.atXY(x, y);
				if (name != " ") {
					ctx.fillStyle = pieces.get(name).color;
				} else continue;
				
				ctx.fillRect(x * grid, (y - sh) * grid, grid - 1, grid - 1);
			}
		}
	}
	
	frameCanvas(deltaTime: number) {
		const { ctx } = this;
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.fillStyle = this.gridColor;
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		const boardSize = this.logic.gameDef.settings.boardSize;
		
		const { grid, sh, sw } = this;
		ctx.fillStyle = this.backgroundColor;
		for (let y = sh; y < boardSize[1]; y++) {
			for (let x = 0; x < sw; x++) {
				// drawing 1 px smaller than the grid creates a grid effect
				ctx.fillRect(x * grid, (y - sh) * grid, grid - 1, grid - 1);
			}
		}
		
		ctx.save()
		ctx.globalAlpha = 0.4;
		this.drawBoard(this.logic.ghostboard, boardSize[1]);
		ctx.restore()

		this.drawBoard(this.logic.gameboard, boardSize[1]);
		

		if (!this.logic.activePiece.invalid) {
			const piece = this.logic.activePiece;
			const ghostPiece = this.logic.activePiece.copy().hardDrop();

			
			ctx.save()
			ctx.globalAlpha = 0.4;
			this.drawPiece(ghostPiece)
			ctx.restore()

			this.drawPiece(piece);
		}
	}
}
