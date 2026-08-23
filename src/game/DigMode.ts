import { BaseMode } from "./BaseMode";
import { CheckState } from "./Logic";

export class DigMode extends BaseMode {
	state!: {
		initialized: boolean;
	};

	reset(): void {
		this.state = {
			initialized: false,
		};
	}

	frame(): void {
		if (!this.state.initialized) {
			this.logic.gameboard.in();
			for (let i = 0; i < 12; i++) {
				this.logic.gameboard.receiveGarbage(1);
			}
			this.logic.gameboard.out(0);
			this.state.initialized = true;
		} else {
			if (this.logic.activePiece.invalid) {
				let win = true;
				const board = this.logic.gameboard;
				top: for (let y = 0; y < board.height; y++) {
					for (let x = 0; x < board.width; x++) {
						if (board.pieceXY(x, y) === board.garbageIdx) {
							win = false;
							break top;
						}
					}
				}

				if (win) {
					this.logic.gameWin();
				}
			}
		}
	}
}
