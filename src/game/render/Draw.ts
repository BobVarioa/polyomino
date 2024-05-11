import { Logic } from "../Logic";
import { BaseDraw } from "./BaseDraw";
import { CanvasDraw } from "./CanvasDraw";
import { GlDraw } from "./GlDraw";

export enum DrawMode {
	Canvas,
	WebGL
}

export class Draw {
	static create(mode: DrawMode, logic: Logic, canvas: HTMLCanvasElement): BaseDraw {
		switch (mode) {
			case DrawMode.Canvas:
				return new CanvasDraw(logic, canvas);
			case DrawMode.WebGL:
				return new GlDraw(logic, canvas);
		}
	}
}
