# Todo
- [ ] Gamemodes
	- [ ] Monomino
		- Inspiration:
			- [Tetris Attack](https://tetris.wiki/Tetris_Attack)?
			- [Bejeweled]()
		- [ ] Cursor that can swap pieces
		- [ ] Clears should generate new rows 
	- [ ] Domino
		- Inspiration:
			- [Dr. Mario](https://tetris.wiki/Dr._Mario)?
			- [Puyo Puyo]()
		- [ ] 
	- [ ] Tromino
		- Inspiration:
			- [Columns](https://tetris.wiki/Columns)
		- [ ] 
	- [ ] Tetromino
		- Inspiration:
			- [Tetris]()
		- [x] Guildline rules
			- [x] All Tetrominos
			- [x] Rotation: SRS
			- [x] Lock delay: 0.5s
			- [~] Piece preview
			- [~] Hold box
			- [x] Bag randomizer
			- [ ] Levels
			- [ ] Scoring
	- [ ] Pentomino
		- Inspiration:
			- [ ] 
		- [x] All non mirrored pentominos
		- [ ] Add a new rotation system based on SRS
			- [ ] Flipping? If so add rotation logic for this
			- [ ] Look into nullpomino's rotation system editor, because doing this by hand seems painful
		- [ ] Look into which pieces should give spin bonuses
	- [ ] Polyomino
		- Inspiration:
			- [Puyo Puyo Tetris: Party](https://tetris.wiki/Puyo_Puyo_Tetris#Party)
			- [Tetris Effect Conected: Zone](https://tetris.wiki/Tetris_Effect#Zone_mechanic)
			- [Pac-Attack](https://en.wikipedia.org/wiki/Pac-Attack)
		- [ ] Special Effects
			- These should **never** be able to be purchased with real money 
			- No lootboxes, etc.
			- [ ] Characters
				- Inspiration:
					- [TETR.IO](https://characters.osk.sh/) 
					- Puyo Puyo Characters
				- Things that change gameplay throughout the whole match
				- [ ] 
			- [ ] Active abilities
				- By pressing the [Ability] key, these will be activated
				- Generally these require a charge meter of some sort, the specific action required will depend 
				- [ ] Zone
				- [ ] Filling holes
				- [ ] Changes your hold box into a special mino
					- [ ] Fairies, removes n lines of garbage 
					- [ ] Bomb, removes all tiles in an area
					- [ ] Sword, clears all minos in a direction
				- [ ] Send garbage to opponent but ... to you
					- [ ] Double back?
					- [ ] Unclearable garbage?
		- [ ] Allows different players to play different gamemodes against each other, i.e. a duo and a tetra player
		- [ ] Players should be able to have loadouts of characters / active abilities
- [ ] Features
	- [ ] [Gravity Modes](https://tetris.wiki/Line_clear#Line_clear_gravity)
		- [x] Naive
		- [ ] Sticky
		- [ ] Cascade
	- [ ] Rotation Modes
		- [x] Normal
		- [ ] Cycle (See Tromino)
		- [ ] Flip (See Pentomino)
	- [ ] Removal Modes
		- [x] Width
		- [ ] Color match (See Monomino)
	- [ ] Scoring language
	- [ ] Actual menus 
		- [ ] Configurable preferences and keys
			- [ ] Controller support
		- [ ] i18n
	- [ ] Blackjack rewrite
	- [ ] Mulitplayer
		- [ ] Garbage
		- [ ] Rollback? Todo, research
		- [ ] Elo system
	- [x] Prefrences
		- [x] Soft drop factor
	- [ ] Game over
- [ ] Rewrite in assemblyscript
- [ ] Mobile and Desktop version
	- [ ] console????
