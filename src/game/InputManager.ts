import { MultiKeyMap } from "../utils/MultiKeyMap";
import { camelToSnake } from "../utils/camelToSnake";

export enum Keys {
	RotateLeft,
	RotateRight,
	Rotate180,
	RotateSpecial,
	Ability,
	MoveLeft,
	MoveRight,
	SoftDrop,
	HardDrop,
	Hold,
	Pause,
	Restart,
	Fail,
	// dev keys
	DiscardActivePiece,
	ClearHoldBox,
	Ghostboard,
	ToggleGravity,
	ToggleLocking,
	CycleActivePiece,
	TetroMode,
	PentoMode,
	// NOTE: must be last element
	Length,
}

const namesToKeys = camelToSnake(Keys, "key.");

export class InputManager {
	inputMap = new MultiKeyMap<string, Keys>();
	pressedMap: boolean[] = new Array(Keys.Length).fill(false);

	constructor(ele: Node) {
		document.addEventListener("keydown", (ev) => this.keyDown(ev.code));
		document.addEventListener("keyup", (ev) => this.keyUp(ev.code));
	}

	set(id: Keys, key: string) {
		this.inputMap.deleteKey(key);
		this.inputMap.set([key], id);
	}

	setByName(name: string, key: string) {
		const id = namesToKeys[name];
		this.inputMap.deleteKey(key);
		this.inputMap.set([key], id);
	}

	getByName(name: string) {
		const id = namesToKeys[name];
		return this.inputMap.getByValue(id);
	}

	isPressed(key: Keys) {
		return this.pressedMap[key];
	}

	keyDown(k: string) {
		const key = this.inputMap.get(k);
		if (key != undefined) {
			this.pressedMap[key] = true;
		}
	}
	keyUp(k: string) {
		const key = this.inputMap.get(k);
		if (key != undefined) {
			this.pressedMap[key] = false;
		}
	}
}
