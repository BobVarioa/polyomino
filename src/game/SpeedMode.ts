import { BaseMode } from "./BaseMode";

export class SpeedMode extends BaseMode {
	state!: {
		lines: number
	}

	reset(): void {
		this.state = {
			lines: 0
		}
	}

	frame(): void {}

	lineClear(lines: number): void {
		this.state.lines += lines;
		if (this.state.lines >= 40) {
			this.logic.gameWin();
		}
	}
}
