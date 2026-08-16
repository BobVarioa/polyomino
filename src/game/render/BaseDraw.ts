import { Logic } from "../Logic";

export abstract class BaseDraw {
	grid!: number;
	sw!: number;
	sh!: number;

	backgroundColor!: string;
	gridColor!: string;
	logic!: Logic;

	maxWidth!: number;
	maxHeight!: number;

	topLeftMap!: Map<string, [number, number]>;

	constructor(
		public canvas: HTMLCanvasElement,
		public holdCanvas: HTMLCanvasElement,
		public queueCanvas: HTMLCanvasElement,
	) {}

	reset() {
		this.grid = 32;

		const { settings: { boardSize, screenSize }, pieces } = this.logic.gameDef;
		this.sw = screenSize[0];
		// i.e 40 - 20 = 20, row 20 is our 0
		this.sh = boardSize[1] - screenSize[1];

		this.backgroundColor = this.logic.prefs.backgroundColor;
		this.gridColor = this.logic.prefs.gridColor;

		this.topLeftMap = new Map();

		let maxW = 0;
		let maxH = 0;
		for (const piece of pieces.values()) {
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
	}

	abstract clear(): void;

	abstract frame(deltaTime: number): void;
}
