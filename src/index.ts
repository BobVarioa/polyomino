import { tetro, pento } from "./data/gameTypes";
import { GameDef, GameSchema } from "./game/GameDef";
import { InputManager, Keys } from "./game/InputManager";
import { Logic } from "./game/Logic";
import { Draw, DrawMode } from "./game/render/Draw";
import { Preferences } from "./game/Preferences";

function init() {
	let gameDef = GameDef.fromJson(pento as any as GameSchema);
	let prefs = new Preferences();
	prefs.arr = 0;
	prefs.das = 7;
	prefs.sdf = -1;

	let input = new InputManager(document);
	input.setKey(Keys.RotateLeft, "z");
	input.setKey(Keys.RotateRight, "x");
	input.setKey(Keys.Rotate180, "c");
	input.setKey(Keys.RotateSpecial, "v");
	input.setKey(Keys.MoveLeft, "ArrowLeft");
	input.setKey(Keys.MoveRight, "ArrowRight");
	input.setKey(Keys.SoftDrop, "ArrowDown");
	input.setKey(Keys.HardDrop, "ArrowUp");
	input.setKey(Keys.Hold, " ");
	input.setKey(Keys.Restart, "r");
	input.setKey(Keys.Fail, "f");
	input.setKey(Keys.Pause, "Escape");

	let logic = new Logic(gameDef, prefs, input);
	logic.start();

	let canvas = document.querySelector<HTMLCanvasElement>("#gameBoard");
	let draw = Draw.create(DrawMode.Canvas, logic, canvas);
	let drawFunc = draw.start();
	
	draw.grid = 32;
	canvas.width = draw.grid * gameDef.settings.screenSize[0];
	canvas.height = draw.grid * gameDef.settings.screenSize[1];

	let rAF;

	(async () => {
		const fps = 60;

		const func = () => {
			logic.frame();

			setTimeout(func, 1000 / fps);
		};

		func();
	})().catch((v) => {
		cancelAnimationFrame(rAF);
	});

	let then = 0;
	function drawLoop(now) {
		now *= 0.001;
		drawFunc(now - then);
		then = now;

		rAF = requestAnimationFrame(drawLoop);
	}
	rAF = requestAnimationFrame(drawLoop);
}

document.addEventListener("DOMContentLoaded", init);
