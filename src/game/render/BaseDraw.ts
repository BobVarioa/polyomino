import { Logic } from "../Logic";

export abstract class BaseDraw {
	grid!: number;
	sw!: number;
	sh!: number;

	backgroundColor!: string;
	gridColor!: string;
	logic!: Logic;

	constructor(
		public canvas: HTMLCanvasElement,
	) {}

	reset() {
		this.grid = 32;

		const { settings: { boardSize, screenSize } } = this.logic.gameDef;
		this.sw = screenSize[0];
		this.sh = screenSize[1];

		this.canvas.width = this.grid * (this.sw + this.logic.gameDef.maxPieceWidth * 2 + 4);
		this.canvas.height = this.grid * (this.sh + 2 + 2);

		this.backgroundColor = this.logic.prefs.backgroundColor;
		this.gridColor = this.logic.prefs.gridColor;
	}

	setScreenSize(width: number, height: number) {
		this.canvas.width = width;
		this.canvas.height = height;
	}

	abstract clear(): void;

	abstract frame(deltaTime: number): void;
}
