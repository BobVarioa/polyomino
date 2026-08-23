import { Logic } from "../game/Logic";
import { hasOwn } from "../utils/types";
import { InputManager } from "../game/InputManager";
import { Preferences } from "../game/Preferences";
import { l } from "../utils/lang";
import { GameDef } from "../game/GameDef";
import { BaseMode } from "../game/BaseMode";
import { Draw } from "../game/render/Draw";

interface BaseMenuEle {
	id: string;
	action: string;
}

interface KeyEle extends BaseMenuEle {
	action: "key";
}

interface SliderEle extends BaseMenuEle {
	action: "slider";
	min: number;
	max: number;
	minLabel?: string;
}

interface ModeEle extends BaseMenuEle {
	action: "mode";
	mode: new () => BaseMode;
}

interface GameEle extends BaseMenuEle {
	action: "game";
	gamedef: GameDef;
	children: ModeEle[];
}

interface NestEle extends BaseMenuEle {
	action: "nest";
	children: MenuEle[];
}

export type MenuEle = KeyEle | SliderEle | GameEle | ModeEle | NestEle;

export class MenuManager {
	public menuQueue: number[] = [];

	failListener: () => void;
	winListener: () => void;
	pauseListener: () => void;
	resumeListener: () => void;

	constructor(
		public logic: Logic,
		public input: InputManager,
		public prefs: Preferences,
		public parentEle: HTMLDivElement,
		public menuMap: MenuEle[],
	) {
		this.failListener = () => {
			this.renderDone(false);
		};
		this.winListener = () => {
			this.renderDone(true);
		};
		this.pauseListener = () => {
			this.renderPause();
		};
		this.resumeListener = () => {
			this.parentEle.replaceChildren();
		};
	}


	renderPause() {
		const title = document.createElement("span");
		title.textContent = l("menu.pause");

		const resumeButton = document.createElement("button");
		resumeButton.textContent = l("menu.resume");
		resumeButton.addEventListener("click", () => {
			this.parentEle.replaceChildren();

			this.logic.resume();
		});

		const quitButton = document.createElement("button");
		quitButton.textContent = l("menu.quit");
		quitButton.addEventListener("click", () => {
			this.logic.draw.clear();
			this.logic.draw.setScreenSize(640, 640);
			
			this.logic._signal.removeListener("fail", this.failListener);
			this.logic._signal.removeListener("win", this.winListener);
			this.logic._signal.removeListener("pause", this.pauseListener);
			this.logic._signal.removeListener("resume", this.pauseListener);
			this.render();
		});

		this.parentEle.appendChild(title);
		this.parentEle.appendChild(resumeButton);
		this.parentEle.appendChild(quitButton);
	}


	renderDone(win: boolean) {
		const title = document.createElement("span");
		title.textContent = win ? l("menu.win") : l("menu.fail");

		const restartButton = document.createElement("button");
		restartButton.textContent = l("menu.restart");
		restartButton.addEventListener("click", () => {
			this.parentEle.replaceChildren();

			this.logic.reset();
			this.logic._signal.emit("start");
		});

		const quitButton = document.createElement("button");
		quitButton.textContent = l("menu.quit");
		quitButton.addEventListener("click", () => {
			this.logic.draw.clear();
			this.logic.draw.setScreenSize(640, 640);
			
			this.logic._signal.removeListener("fail", this.failListener);
			this.logic._signal.removeListener("win", this.winListener);
			this.logic._signal.removeListener("pause", this.pauseListener);
			this.logic._signal.removeListener("resume", this.pauseListener);
			this.render();
		});

		this.parentEle.appendChild(title);
		this.parentEle.appendChild(restartButton);
		this.parentEle.appendChild(quitButton);
	}

	render() {
		this.parentEle.replaceChildren();

		let menu = this.menuMap;
		let parent: MenuEle | undefined = undefined;
		for (let i = 0; i < this.menuQueue.length; i++) {
			const subMenu = menu[this.menuQueue[i]];
			if (hasOwn(subMenu, "children")) {
				menu = subMenu.children;
				parent = subMenu;
			} else {
				throw new Error("invalid menu structure");
			}
		}

		for (let i = 0; i < menu.length; i++) {
			const menuEle = menu[i];
			let ele: Element;
			switch (menuEle.action) {
				case "nest":
					ele = document.createElement("button");
					ele.textContent = l(menuEle.id);
					ele.addEventListener("click", () => {
						this.menuQueue.push(i);
						this.render();
					});
					break;
				case "mode":
					ele = document.createElement("button");
					ele.textContent = l(menuEle.id);
					ele.addEventListener("click", () => {
						this.parentEle.replaceChildren();
						if (!parent || parent.action != "game") return;
						this.logic.swapGameDef(parent.gamedef);
						this.logic.swapMode(new menuEle.mode());

						this.logic._signal.on("fail", this.failListener);
						this.logic._signal.on("win", this.winListener);
						this.logic._signal.on("pause", this.pauseListener);
						this.logic._signal.on("resume", this.resumeListener);
						this.logic.reset();
						this.logic._signal.emit("start");
					});
					break;

				case "game":
					ele = document.createElement("button");
					ele.textContent = l(menuEle.id);
					ele.addEventListener("click", () => {
						this.menuQueue.push(i);
						this.render();
					});
					break;
				case "key":
					ele = document.createElement("div");
					ele.classList.add("key");

					const spacerEle = document.createElement("div");
					spacerEle.classList.add("spacer");

					const setEle = document.createElement("button");
					const keyEle = document.createElement("span");
					keyEle.textContent = [...this.input.getByName(menuEle.id)].join(", ");

					setEle.textContent = l(menuEle.id);
					setEle.addEventListener("click", () => {
						const cb = (ev: KeyboardEvent) => {
							if (this.input.inputMap.has(ev.key)) {
								this.input.inputMap.deleteKey(ev.key);
							} else {
								this.input.setByName(menuEle.id, ev.key);
							}
							keyEle.textContent = [...this.input.getByName(menuEle.id)].join(", ");
							document.removeEventListener("keydown", cb);
						};
						document.addEventListener("keydown", cb);
					});
					ele.appendChild(setEle);
					ele.appendChild(spacerEle);
					ele.appendChild(keyEle);

					break;
				case "slider":
					ele = document.createElement("div");
					ele.classList.add("slider");

					const prefVal = this.prefs.getByName(menuEle.id);

					const labelEle = document.createElement("span");
					labelEle.textContent = l(menuEle.id);
					labelEle.classList.add("label");

					const sliderEle = document.createElement("input");
					sliderEle.type = "range";
					sliderEle.min = menuEle.min.toString();
					sliderEle.max = menuEle.max.toString();
					sliderEle.step = "1";
					sliderEle.value = prefVal.toString();

					const valueEle = document.createElement("span");
					valueEle.textContent =
						menuEle.minLabel && prefVal == menuEle.min ? l(menuEle.minLabel) : prefVal.toString();
					valueEle.classList.add("value");

					sliderEle.addEventListener("change", (ev) => {
						const val = parseInt(sliderEle.value);
						this.prefs.setByName(menuEle.id, val);
						valueEle.textContent =
							menuEle.minLabel && val == menuEle.min ? l(menuEle.minLabel) : val.toString();
					});

					ele.appendChild(labelEle);
					ele.appendChild(sliderEle);
					ele.appendChild(valueEle);

					break;
			}
			this.parentEle.appendChild(ele);
		}

		if (this.menuQueue.length > 0) {
			const ele = document.createElement("button");
			ele.textContent = l("menu.back");
			ele.addEventListener("click", () => {
				this.menuQueue.pop();
				this.render();
			});
			this.parentEle.appendChild(ele);
		}
	}
}
