import { ArrayMatrix } from "../utils/ArrayMatrix";
import { MultiKeyMap } from "../utils/MultiKeyMap";
import { BaseMode } from "./BaseMode";
import { Logic } from "./Logic";

const solutions = new MultiKeyMap<string, string[]>();
// prettier-ignore
{
	// 7 pieces
	solutions.set(
		["IJIT", "ITIJ", "ITJI", "IIJT", "IJTI", "IITJ", "JITI", "JIIT", "JTII", "TIJI", "TIIJ"],
		["IIIII", 
		 "ITTT ", 
		 "IJT  ", 
		 "IJJJ "]
	);
	solutions.set(
		["IJIT", "IIJT", "JIIT"],
		["IITTT", 
		 "IIJJ ", 
		 "IIJ  ", 
		 "IIJT "]
	);
	solutions.set(
		["ITIL", "IITL", "ITLI", "TILI", "TIIL", "TLII"],
		["IIIII", 
		 "ILLL ", 
		 "ILT  ", 
		 "ITTT "]
	);
	solutions.set(
		["ILIT", "ILTI", "TLII", "LITI", "LIIT", "LTII"],
		["IITTT", 
		 "IILT ", 
		 "IIL  ", 
		 "IILL "]
	);
	solutions.set(
		["ITJS", "ITSJ", "TISJ", "TJSI", "TSIJ", "TJIS", "TIJS", "TSJI", "STIJ", "STJI"],
		["IJJSS", 
		 "IJSS ", 
		 "IJT  ", 
		 "ITTT "]
	);
	solutions.set(
		["IJST", "JSIT", "JSTI", "JIST"],
		["IJJSS", 
		 "IJSS ", 
		 "IJT  ", 
		 "ITTT "]
	);
	solutions.set(
		["IZIL", "IIZL", "IZLI", "ZILI", "ZIIL"],
		["IIIII", 
		 "ILLL ", 
		 "IZZ  ", 
		 "ILZZ "]
	);
	solutions.set(
		["IZJS", "IZSJ", "ZISJ", "ZSIJ", "ZIJS", "SZIJ"],
		["IJJSS", 
		 "IJSS ", 
		 "IZZ  ", 
		 "IJZZ "]
	);
	solutions.set(
		["IJZS", "JIZS"],
		["IJZSS", 
		 "IJJJ ", 
		 "IZZ  ", 
		 "IZSS "]
	);
	solutions.set(
		["IITO", "ITIO", "ITOI", "TIIO", "TIOI"],
		["IIIII", 
		 "ITOO ", 
		 "ITT  ", 
		 "ITOO "]
	);
	solutions.set(
		["IOIJ", "IIOJ", "IOJI", "OIIJ", "OIJI"],
		["IIIII", 
		 "IJJJ ", 
		 "IOO  ", 
		 "IOOJ "]
	);
	solutions.set(
		["IISJ", "ISIJ", "ISJI", "SIIJ", "SIJI"],
		["IIIII", 
		 "IJSS ", 
		 "ISS  ", 
		 "IJJJ "]
	);
	solutions.set(
		["IITS", "ITIS", "TIIS"],
		["IITSS", 
		 "IITT ", 
		 "IIT  ", 
		 "IISS "]
	);
	solutions.set(
		["ITJL", "ITLJ", "TIJL", "TILJ"],
		["ILLJJ", 
		 "ITLJ ", 
		 "ITT  ", 
		 "ITLJ "]
	);
	solutions.set(
		["ITSZ", "STIZ", "TSIZ", "TISZ"],
		["IZZSS", 
		 "ITSS ", 
		 "ITT  ", 
		 "ITZZ "]
	);
	solutions.set(
		["ITZS", "TZIS", "TIZS"],
		["IZZSS", 
		 "ITZZ ", 
		 "ITT  ", 
		 "ITSS "]
	);
	solutions.set(
		["IOJT", "OIJT", "OJIT"],
		["IJTTT", 
		 "IJJJ ", 
		 "IOO  ", 
		 "IOOT "]
	);
	// 6 peices
	solutions.set(
		["ILIT, ILTI"],
		["LIIII", 
		 "LTTT ", 
		 "LLT  ", 
		 "IIII "]
	);
	solutions.set(
		["ITJS, TIJS"],
		["IJJSS", 
		 "ITTT ", 
		 "IJT  ", 
		 "IJSS "]
	);
	// ISJT, IJTS, ISTJ, IJST, SITJ, STIJ, SIJT
	// ILIZ, ILZI
	// IZJS, IJZS
	// ISTI, ITSI, ITIS, SITI, STII
	// ILTJ, ITLJ
	// IOTJ, IJTO, ITOJ, IOJT, ITJO, TIOJ, TIJO
	// IJTO, ITJO, TIJO
	// IJTO, IJOT, JIOT, JITO
}

export class PCOMode extends BaseMode {

	state = 0;
	solution: string[];

	frame() {
		if (this.state == 0) {
			this.logic.ghostboard.fill(" ")
			this.bagInfo = [this.logic.activePiece.piece.name, ...this.logic.gameDef.randomizer.peek(6)];

			// prettier-ignore
			if (this.hasMixedSequence("OSZI")) {
				// 
			} else {
				if (this.bagBefore("Z", "S")) {
					this.writeBoard(this.logic.ghostboard, [
						"LLL     SS", 
						"LOO    SST", 
						"JOO   ZZTT", 
						"JJJ    ZZT"
					]);
				} else {
					this.writeBoard(this.logic.ghostboard, [
						"ZZ     JJJ", 
						"TZZ    OOJ", 
						"TTSS   OOL", 
						"TSS    LLL"
					]);
				}
			}

			this.state++;
			return;
		}

		if (this.state == 1) {
			const unmirrored = this.doesBoardEqual(this.logic.gameboard, [
				"LLL     SS",
				"LOO    SST",
				"JOO   ZZTT",
				"JJJ    ZZT",
			]);
			const mirrored = this.doesBoardEqual(this.logic.gameboard, [
				"ZZ     JJJ",
				"TZZ    OOJ",
				"TTSS   OOL",
				"TSS    LLL",
			]);

			if (unmirrored || mirrored) {
				this.logic.ghostboard.fill(" ");
				this.replaceAll(this.logic.gameboard, (v) => v != " ", "?");
				this.state++;
			}
			return;
		}

		if (this.state == 2) {
			this.bagInfo = [this.logic.activePiece.piece.name, ...this.logic.gameDef.randomizer.peek(6)];
			for (const key of solutions.keys()) {
				if (this.canSequence(key, this.logic.holdPiece)) {
					this.solution = solutions.get(key);
					this.state = 4;
					break;
				}
			}
			if (this.solution != undefined) {
				this.writeBoard(this.logic.ghostboard, this.solution, [4,0]);
				this.state++;
			} else {
				this.state = 5;
			}	
			return;
		}

		if (this.state == 4) {
			// check for pc / each step of solution or smth
			// finish
		}

		if (this.state == 5) {
			// recovery in case not possible
		}
	}
}
