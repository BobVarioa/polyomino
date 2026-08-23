import { BaseMode } from "./BaseMode";

export class AttackMode extends BaseMode {
	state!: {
		frames: number;
	};

	reset(): void {
		this.state = {
			frames: 0,
		};
	}

	frame(): void {
		this.state.frames++;

		if (this.state.frames > 60 * 60 * 2) { // 2 mins
			this.logic.gameWin()
		}
	}
}
