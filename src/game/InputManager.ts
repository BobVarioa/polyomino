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

const namesToKeys = Object.fromEntries((Object.entries(Keys) as [string, Keys][]).map(v => ([
	"key" + v[0].replace(/A-Z/g, l => `_${l.toLowerCase()}`), 
	v[1]
])));

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

	setKeyByName(name: string, key: string) {
		const id = namesToKeys[name];
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
