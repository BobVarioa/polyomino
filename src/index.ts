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
	input.set(Keys.RotateLeft, "z");
	input.set(Keys.RotateRight, "x");
	input.set(Keys.Rotate180, "c");
	input.set(Keys.RotateSpecial, "v");
	input.set(Keys.Ability, "Shift");
	input.set(Keys.MoveLeft, "ArrowLeft");
	input.set(Keys.MoveRight, "ArrowRight");
	input.set(Keys.SoftDrop, "ArrowDown");
	input.set(Keys.HardDrop, "ArrowUp");
	input.set(Keys.Hold, " ");
	input.set(Keys.Restart, "r");
	input.set(Keys.Fail, "f");
	input.set(Keys.Pause, "Escape");

	const devMode = true;
	if (devMode) {
		prefs.set(Prefs.Arr, 0);
		prefs.set(Prefs.Das, 7);
		prefs.set(Prefs.Sdf, -1);

		input.set(Keys.DiscardActivePiece, "1");
		input.set(Keys.ClearHoldBox, "2");
		input.set(Keys.ToggleGravity, "3");
		input.set(Keys.ToggleLocking, "4");
		input.set(Keys.CycleActivePiece, "5");
		input.set(Keys.Ghostboard, "7");
		input.set(Keys.TetroMode, "9");
		input.set(Keys.PentoMode, "0");
	}

	const canvas = $<HTMLCanvasElement>("#gameCanvas");
	const holdCanvas = $<HTMLCanvasElement>("#holdCanvas");
	const queueCanvas = $<HTMLCanvasElement>("#queueCanvas");
	const draw = Draw.create(DrawMode.Canvas, canvas, holdCanvas, queueCanvas);
	draw.grid = 32;

	const logic = new Logic(prefs, input, draw);
	logic.init();

	// init menus
	const menusEle = $<HTMLDivElement>("#menus");

	const buttons: MenuEle[] = [
		{ id: "play", action: "nest", children: [
			{ id: "duo", action: "game" },
			{ id: "tro", action: "game" },
			{ id: "tetro", action: "game" },
			{ id: "pento", action: "game" },
		] },
		{ id: "settings", action: "nest", children: [
			{ id: "prefs.volume", action: "slider" },
			{ id: "prefs.music_volume", action: "slider" },
			{ id: "prefs.arr", action: "slider" },
			{ id: "prefs.das", action: "slider" },
			{ id: "prefs.sdf", action: "slider" },
			{ id: "keys", action: "nest", children: [
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
			] }
		] }
	];

	const menu = new MenuManager(logic, menusEle, buttons);

	menu.render()
}

document.addEventListener("DOMContentLoaded", init);
