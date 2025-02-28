import tetroJ from "./tetro.jsonc";
import pentoJ from "./pento.jsonc";
import duoJ from "./duo.jsonc";
import { GameDef, GameSchema } from "../game/GameDef";

export const tetro = GameDef.fromJson(tetroJ as GameSchema);
export const pento = GameDef.fromJson(pentoJ as GameSchema);
export const duo = GameDef.fromJson(duoJ as GameSchema);
