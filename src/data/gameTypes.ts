import tetroJ from "./tetro.json";
import pentoJ from "./pento.json";
import { GameDef, GameSchema } from "../game/GameDef";
const tetro = GameDef.fromJson(tetroJ as any as GameSchema);
const pento = GameDef.fromJson(pentoJ as any as GameSchema);
export { tetro , pento };