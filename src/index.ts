import { InputManager, Keys } from "./game/InputManager";
import { Logic } from "./game/Logic";
import { Draw, DrawMode } from "./game/render/Draw";
import { Preferences, Prefs } from "./game/Preferences";
import { PCOMode } from "./game/PCOMode";
import { MenuEle, MenuManager } from "./menu/MenuManager";

const $ = <T>(s: string): T => document.querySelector(s) as T;

function init() {
	const prefs = new Preferences();
	
	const input = new InputManager(document);
	input.set(Keys.RotateLeft, "KeyZ");
	input.set(Keys.RotateRight, "KeyX");
	input.set(Keys.Rotate180, "KeyC");
	input.set(Keys.RotateSpecial, "KeyV");
	input.set(Keys.Ability, "Shift");
	input.set(Keys.MoveLeft, "ArrowLeft");
	input.set(Keys.MoveRight, "ArrowRight");
	input.set(Keys.SoftDrop, "ArrowDown");
	input.set(Keys.HardDrop, "ArrowUp");
	input.set(Keys.Hold, "Space");
	input.set(Keys.Restart, "KeyR");
	input.set(Keys.Fail, "KeyF");
	input.set(Keys.Pause, "Escape");

	const devMode = true;
	if (devMode) {
		prefs.set(Prefs.Arr, 0);
		prefs.set(Prefs.Das, 7);
		prefs.set(Prefs.Sdf, -1);

		input.set(Keys.DiscardActivePiece, "Digit1");
		input.set(Keys.ClearHoldBox, "Digit2");
		input.set(Keys.ToggleGravity, "Digit3");
		input.set(Keys.ToggleLocking, "Digit4");
		input.set(Keys.CycleActivePiece, "Digit5");
		input.set(Keys.Ghostboard, "Digit7");
		input.set(Keys.RecieveSentGarbage, "Digit8");
	}

	const canvas = $<HTMLCanvasElement>("#gameCanvas");
	const holdCanvas = $<HTMLCanvasElement>("#holdCanvas");
	const queueCanvas = $<HTMLCanvasElement>("#queueCanvas");
	const draw = Draw.create(DrawMode.Canvas, canvas, holdCanvas, queueCanvas);
	draw.clear();

	draw.grid = 32;

	const logic = new Logic(prefs, input, draw);
	logic.init();

	// init menus
	const menusEle = $<HTMLDivElement>("#menus");

	const buttons: MenuEle[] = [
		{
			id: "menu.play",
			action: "nest",
			children: [
				{ id: "game.duo", action: "game" },
				{ id: "game.tro", action: "game" },
				{ id: "game.tetro", action: "game" },
				{ id: "game.pento", action: "game" },
			],
		},
		{
			id: "menu.settings",
			action: "nest",
			children: [
				{ id: "prefs.sound", action: "slider", min: 0, max: 100 },
				{ id: "prefs.music", action: "slider", min: 0, max: 100 },
				{ id: "prefs.arr", action: "slider", min: 0, max: 60 },
				{ id: "prefs.das", action: "slider", min: 0, max: 60 },
				{ id: "prefs.sdf", action: "slider", min: -1, max: 60, minLabel: "prefs.sdf.infinite" },
				{
					id: "menu.keys",
					action: "nest",
					children: [
						{ id: "key.rotate_left", action: "key" },
						{ id: "key.rotate_right", action: "key" },
						{ id: "key.rotate180", action: "key" },
						{ id: "key.rotate_special", action: "key" },
						{ id: "key.ability", action: "key" },
						{ id: "key.move_left", action: "key" },
						{ id: "key.move_right", action: "key" },
						{ id: "key.soft_drop", action: "key" },
						{ id: "key.hard_drop", action: "key" },
						{ id: "key.hold", action: "key" },
						{ id: "key.restart", action: "key" },
						{ id: "key.fail", action: "key" },
						{ id: "key.pause", action: "key" },
					],
				},
			],
		},
	];

	const menu = new MenuManager(logic, input, prefs, menusEle, buttons);

	menu.render();
}

document.addEventListener("DOMContentLoaded", init);
