import { Logic } from "../Logic";

export abstract class BaseDraw {
	grid: number;
	sw: number;
	sh: number;

	backgroundColor: string;
	gridColor: string;
	logic: Logic;

	constructor(public canvas: HTMLCanvasElement, public holdCanvas: HTMLCanvasElement, public queueCanvas: HTMLCanvasElement) { }

	start() {
		this.grid = 32;

		const { boardSize, screenSize } = this.logic.gameDef.settings;
		this.sw = screenSize[0];
		// i.e 40 - 20 = 20, row 20 is our 0
		this.sh = boardSize[1] - screenSize[1];

		this.backgroundColor = this.logic.prefs.backgroundColor;
		this.gridColor = this.logic.prefs.gridColor;
	}

	abstract frame(deltaTime: number): void;
}
