import { InputManager, Keys } from "./game/InputManager";
import { Logic } from "./game/Logic";
import { Draw, DrawMode } from "./game/render/Draw";
import { Preferences } from "./game/Preferences";
import { PCOMode } from "./game/PCOMode";
import { MenuEle, MenuManager } from "./menu/MenuManager";

const $ = <T>(s: string): T => document.querySelector(s) as T;

function init() {
	const prefs = new Preferences();
	prefs.arr = 0;
	prefs.das = 7;
	prefs.sdf = -1;

	const input = new InputManager(document);
	input.setKey(Keys.RotateLeft, "z");
	input.setKey(Keys.RotateRight, "x");
	input.setKey(Keys.Rotate180, "c");
	input.setKey(Keys.RotateSpecial, "v");
	input.setKey(Keys.Ability, "Shift");
	input.setKey(Keys.MoveLeft, "ArrowLeft");
	input.setKey(Keys.MoveRight, "ArrowRight");
	input.setKey(Keys.SoftDrop, "ArrowDown");
	input.setKey(Keys.HardDrop, "ArrowUp");
	input.setKey(Keys.Hold, " ");
	input.setKey(Keys.Restart, "r");
	input.setKey(Keys.Fail, "f");
	input.setKey(Keys.Pause, "Escape");

	const devMode = true;
	if (devMode) {
		input.setKey(Keys.DiscardActivePiece, "1");
		input.setKey(Keys.ClearHoldBox, "2");
		input.setKey(Keys.ToggleGravity, "3");
		input.setKey(Keys.ToggleLocking, "4");
		input.setKey(Keys.Ghostboard, "7");
		input.setKey(Keys.TetroMode, "9");
		input.setKey(Keys.PentoMode, "0");
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
