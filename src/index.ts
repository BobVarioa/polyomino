import { tetra } from "./data/gameTypes";
import { GameDef, GameSchema } from "./game/GameDef";
import { InputManager, Keys } from "./game/InputManager";
import { Logic } from "./game/Logic";
import { Draw } from "./game/Draw";
import { Preferences } from "./game/Preferences";

function init() {
	let gameDef = GameDef.fromJson(tetra as any as GameSchema);
	let prefs = new Preferences();
	prefs.arr = 0;
	prefs.das = 7;

	let input = new InputManager(document);

	input.setKey(Keys.RotateLeft, "z");
	input.setKey(Keys.RotateRight, "x");
	input.setKey(Keys.Rotate180, "c");
	input.setKey(Keys.MoveLeft, "ArrowLeft");
	input.setKey(Keys.MoveRight, "ArrowRight");
	input.setKey(Keys.SoftDrop, "ArrowDown");
	input.setKey(Keys.HardDrop, "ArrowUp");
	input.setKey(Keys.Hold, " ");
	input.setKey(Keys.Pause, "Escape");

	let logic = new Logic(gameDef, prefs, input);
	logic.start();

	let canvas = document.querySelector<HTMLCanvasElement>("#gameBoard");

	let draw = new Draw(logic, canvas);
	draw.start();
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

	function drawLoop() {
		rAF = requestAnimationFrame(drawLoop);
		draw.frame();
	}
	rAF = requestAnimationFrame(drawLoop);
}

document.addEventListener("DOMContentLoaded", init);
