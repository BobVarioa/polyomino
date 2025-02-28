import { Logic } from "../game/Logic";
import * as GameTypes from "../data/gameTypes";
import EventEmitter from "eventemitter3";

export interface MenuEle {
	id: string;
	action: "key" | "slider" | "game" | "nest";
	children?: MenuEle[];
}

export class MenuManager {
	public menuQueue: number[] = [];

	constructor(public logic: Logic, public parentEle: HTMLDivElement, public menuMap: MenuEle[]) {}

	render() {
		this.parentEle.replaceChildren();

		let menu = this.menuMap;
		while (this.menuQueue.length > 0) {
			let subMenu = menu[this.menuQueue.pop()];
			if (Object.hasOwn(subMenu, "children")) {
				menu = subMenu.children;
			} else {
				throw new Error("invalid menu structure");
			}
		}

		for (let i = 0; i < menu.length; i++) {
			const menuEle = menu[i];
			const ele = document.createElement("button");
			ele.textContent = menuEle.id;
			switch (menuEle.action) {
				case "nest":
					ele.addEventListener("click", () => {
						this.menuQueue.push(i);
						this.render();
					});
					break;
				case "game":
					ele.addEventListener("click", () => {
						this.parentEle.replaceChildren();
						this.logic.swapGameDef(GameTypes[menuEle.id]);

						this.logic._signal.once("fail", () => {
							this.render();
						});
						this.logic.reset();
						this.logic._signal.emit("start");
					});
					break;
				case "key":
				case "slider":
			}
			this.parentEle.appendChild(ele);
		}
	}
}
