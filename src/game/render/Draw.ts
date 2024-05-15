import { Logic } from "../Logic";
import { BaseDraw } from "./BaseDraw";
import { CanvasDraw } from "./CanvasDraw";
import { GlDraw } from "./GlDraw";

export enum DrawMode {
	Canvas,
	WebGL
}

export class Draw {
	static create(mode: DrawMode, canvas: HTMLCanvasElement, holdCanvas: HTMLCanvasElement, queueCanvas: HTMLCanvasElement): BaseDraw {
		switch (mode) {
			case DrawMode.Canvas:
				return new CanvasDraw(canvas, holdCanvas, queueCanvas);
			case DrawMode.WebGL:
				return new GlDraw(canvas, holdCanvas, queueCanvas);
		}
	}
}
