import { Logic } from "../Logic";
import { BaseDraw } from "./BaseDraw";
import { CanvasDraw } from "./CanvasDraw";
import { GlDraw } from "./GlDraw";

export enum DrawMode {
	Canvas,
	WebGL
}

export class Draw {
	static create(mode: DrawMode, canvas: HTMLCanvasElement): BaseDraw {
		switch (mode) {
			case DrawMode.Canvas:
				return new CanvasDraw(canvas);
			case DrawMode.WebGL:
				return new GlDraw(canvas);
		}
	}
}
