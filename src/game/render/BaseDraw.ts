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

		this.backgroundColor = this.logic.prefs.backgroundColor;
		this.gridColor = this.logic.prefs.gridColor;
	}

	abstract clear(): void;

	abstract frame(deltaTime: number): void;
}
