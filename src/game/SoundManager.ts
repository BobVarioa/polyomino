
export enum Sounds {
	Lock,
	Clear
}

export class SoundManager {
	sounds: Map<Sounds, HTMLAudioElement> = new Map();

	constructor() {

	}

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
		const audio = this.sounds.get(sound)!;
		if (audio.duration > 0) {
			audio.currentTime = 0;
			audio.play();
		}
	}
}