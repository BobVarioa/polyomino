import { MultiKeyMap } from "../utils/MultiKeyMap";

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
	// NOTE: must be last element
	Length,
}

export class InputManager {
	inputMap = new MultiKeyMap<string, Keys>();
	pressedMap: boolean[] = new Array(Keys.Length).fill(false);

	constructor(ele: Node) {
		document.addEventListener("keydown", (ev) => this.keyDown(ev.key));
		document.addEventListener("keyup", (ev) => this.keyUp(ev.key));
	}

	setKey(id: Keys, key: string) {
		this.inputMap.deleteKey(key);
		this.inputMap.set([key], id);
	}

	isKeyPressed(key: Keys) {
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
