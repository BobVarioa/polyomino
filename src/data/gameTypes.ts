import duoJ from "./duo.jsonc";
import troJ from "./tro.jsonc";
import tetroJ from "./tetro.jsonc";
import pentoJ from "./pento.jsonc";
import { GameDef, GameSchema } from "../game/GameDef";

export const duo = GameDef.fromJson(duoJ as GameSchema);
export const tro = GameDef.fromJson(troJ as GameSchema);
export const tetro = GameDef.fromJson(tetroJ as GameSchema);
export const pento = GameDef.fromJson(pentoJ as GameSchema);
