import { Preferences, Prefs } from "./Preferences";

export enum Sounds {
	Lock,
	Clear
}

export class SoundManager {
	sounds: Map<Sounds, HTMLAudioElement> = new Map();

	constructor(public prefs: Preferences) {}

	load(sound: Sounds, url: string): Promise<void> {
		return new Promise((res, rej) => {
			const ele = new Audio(url);
			ele.addEventListener("canplay", () => {
				this.sounds.set(sound, ele);
				res();
			});
		})
	}

	play(sound: Sounds) {
		const volume = this.prefs.get(Prefs.Sound);
		if (volume == 0) return;

		const audio = this.sounds.get(sound)!;
		audio.volume = volume / 100;
		if (audio.duration > 0) {
			audio.currentTime = 0;
			audio.play();
		} else {
			audio.play();
		}
	}
}