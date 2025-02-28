import tetroJ from "./tetro.jsonc";
import pentoJ from "./pento.jsonc";
import { GameDef, GameSchema } from "../game/GameDef";
const tetro = GameDef.fromJson(tetroJ as GameSchema);
const pento = GameDef.fromJson(pentoJ as GameSchema);
export { tetro , pento };