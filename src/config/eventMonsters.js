/**
 * Event monsters. Same shape as EVENT_CHARACTERS so EventCharacter renders
 * them unchanged — a monster is just a config whose chain is a reaction rather
 * than a swing.
 *
 * The source art is 449x531 per frame, one PNG each, which is far too large for
 * a sprite strip. These sheets were cropped to a bounding box shared across
 * every frame (so the animation doesn't jitter) and box-filtered down 4x. They
 * live under public/event/ rather than public/game/ because only the former is
 * tracked by git.
 */
export const EVENT_MONSTERS = {
  // Golems_Free_Version / Golem_1 / Blue, the White_Swoosh_VFX variant — the
  // swoosh is drawn into the attack frames, which is why that sheet's gutters
  // fragment. Every animation stays planted on the frame's bottom row, and the
  // last frame of `die` is empty, so it crumbles away to nothing.
  golem: {
    id: 'golem',
    name: 'Golem Xanh',
    basePath: '/event/monsters/golem',
    frameWidth: 90,
    frameHeight: 64,
    content: { top: 19, bottom: 63 },
    body: { left: 26, right: 64 },
    scale: 0.8,
    // Slow and armoured: it soaks a beating and hits back hard, so a level-1
    // fighter only takes it down on a streak. eventStats scales these with the
    // hero level and turns them into damage.
    hp: 48,
    atk: 6,
    def: 4,
    xpReward: 70,
    animations: {
      idle:   { file: 'idle.png',   frames: 8,  fps: 8 },
      walk:   { file: 'walk.png',   frames: 10, fps: 10 },
      attack: { file: 'attack.png', frames: 11, fps: 12 },
      hit:    { file: 'hit.png',    frames: 4,  fps: 12 },
      die:    { file: 'die.png',    frames: 13, fps: 12 }
    },
    attackChain: ['hit']
  },

  zombie: {
    id: 'zombie',
    name: 'Zombie',
    basePath: '/event/monsters/zombie',
    frameWidth: 80,
    frameHeight: 94,
    content: { top: 0, bottom: 93 },
    body: { left: 3, right: 78 },
    scale: 0.4,
    smooth: true,
    // The softer of the two: hits harder than the golem but folds faster.
    hp: 40,
    atk: 7,
    def: 2,
    xpReward: 60,
    animations: {
      idle:   { file: 'idle.png',   frames: 12, fps: 10 },
      walk:   { file: 'walk.png',   frames: 12, fps: 10 },
      attack: { file: 'attack.png', frames: 8,  fps: 12 },
      hit:    { file: 'hit.png',    frames: 6,  fps: 12 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  }
}

export const DEFAULT_MONSTER_ID = 'golem'

export const getMonster = (id) => EVENT_MONSTERS[id] || EVENT_MONSTERS[DEFAULT_MONSTER_ID]
