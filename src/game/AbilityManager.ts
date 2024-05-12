import { Logic } from "./Logic";

export enum AbilityType {
	// freezes line clears to stack all at once
	Zone,
	// destroys the bottom 5 lines
	Laser,
	// fills up to 4 holes in the bottom of the stack
	Filler,
}

const AbilityCosts = {
	[AbilityType.Zone]: 16,
	[AbilityType.Laser]: 8,
	[AbilityType.Filler]: 10,
};

export class AbilityManager {
	type: AbilityType = AbilityType.Filler;

	charge = 0;
	zoneTimer = 0;

	constructor(public logic: Logic) {}

	frame() {
		switch (this.type) {
			case AbilityType.Zone:
				if (this.zoneTimer > 0) {
					this.zoneTimer--;
					this.logic.counters.gravityTimer -= 1;
					this.logic.flags.noLineClears = true;
				} else {
					this.logic.flags.noLineClears = false;
				}
				break;
		}
	}

	handleInput() {
		if (this.charge < AbilityCosts[this.type]) return;

		main: switch (this.type) {
			case AbilityType.Zone:
				this.zoneTimer = 5 * 60; // 5 seconds
				break;

			case AbilityType.Laser: {
				const { gameboard } = this.logic;
				const linesCleared = 4;
				for (let y = gameboard.height - 1; y > 0; y--) {
					for (let x = 0; x < gameboard.width; x++) {
						gameboard.setXY(x, y, gameboard.atXY(x, y - linesCleared) ?? " ");
					}
				}
				break;
			}

			case AbilityType.Filler: {
				const { gameboard } = this.logic;
				let holes = 4;
				for (let y = gameboard.height - 1; y > 0; y--) {
					for (let x = 0; x < gameboard.width; x++) {
						if (holes <= 0) break main;
						if (gameboard.atXY(x, y) == " ") {
							gameboard.setXY(x, y, "?");
							holes--;
						}
					}
				}
				break;
			}
		}

		this.charge -= AbilityCosts[this.type];
	}
}
