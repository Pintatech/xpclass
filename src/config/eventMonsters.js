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
 *
 * THERE ARE NO STATS IN THIS FILE, AND THAT IS THE POINT. A monster is art: its
 * sheets, its frame box, how big it is drawn and what it is called.
 *
 * How hard it is belongs to the DAY it is met on — monsterHpFor in
 * eventLadder.js, ten on day one and one more each day. Stats used to live here
 * per creature and had to be kept in step with a list in another file by hand;
 * they drifted, and day four came out easier than day one. Now reordering the
 * week reorders the difficulty with it, because the difficulty was never the
 * animal's.
 *
 * There is no xpReward either: a monster is worth a level the first time it goes
 * down and nothing after that, so the bounty it used to carry had nothing left
 * to pay.
 */
const bg = (file) => `${import.meta.env.BASE_URL}event/bg/${file}`
// The cutscenes live in the 'event' storage bucket rather than in public/,
// because `npm run deploy` pushes dist to a git branch and these are megabytes
// each. Its own bucket, not the ui-assets one assetUrl points at.
const VIDEO_BASE = 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/video'
const clip = (file) => `${VIDEO_BASE}/${file}`

export const EVENT_MONSTERS = {
  // Golems_Free_Version / Golem_1 / Blue, the White_Swoosh_VFX variant — the
  // swoosh is drawn into the attack frames, which is why that sheet's gutters
  // fragment. Every animation stays planted on the frame's bottom row, and the
  // last frame of `die` is empty, so it crumbles away to nothing.
  // Luneblade - Little Axion. The pack draws a 24x22 creature in the middle of a
  // 144x144 canvas, so every sheet was cropped to the same 71x25 window with
  // scripts/pack-sprite-sheet.mjs — the window is the union of all five
  // animations, so the axe swing and the death both reach its edges exactly.
  // Cropping identically for every animation is what keeps them aligned.
  axion: {
    id: 'axion',
    name: 'Grimhood',
    basePath: '/event/monsters/axion',
    background: bg('bg1.jpg'),
    // Day 4 of the ladder, which is what the file is numbered for.
    intro: '4.mp4',
    frameWidth: 71,
    frameHeight: 25,
    content: { top: 3, bottom: 24 },
    body: { left: 12, right: 35 },
    // Little, and it stays little: the smallest thing on the ladder, whichever
    // day it is met on. Its stats are day four's all the same — small is a
    // silhouette here, not a difficulty, and it hits well above its size.
    scale: 1.35,
    animations: {
      idle:   { file: 'idle.png',   frames: 7,  fps: 10 },
      run:    { file: 'run.png',    frames: 8,  fps: 12 },
      attack: { file: 'attack.png', frames: 10, fps: 14 },
      hit:    { file: 'hit.png',    frames: 3,  fps: 12 },
      die:    { file: 'die.png',    frames: 18, fps: 14 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  },

  golem: {
    id: 'golem',
    name: 'Blue Golem',
    basePath: '/event/monsters/golem',
    background: bg('bg2.jpg'),
    // Day 2 of the ladder, which is what the file is numbered for.
    intro: '2.mp4',
    frameWidth: 90,
    frameHeight: 64,
    content: { top: 19, bottom: 63 },
    body: { left: 26, right: 64 },
    scale: 0.8,
    // Armoured: the thickest guard on the ladder outside the boss, so day two is
    // chipped down rather than burst. Its swing was once the softest here (atk 6)
    // and that made it harmless — atk was once grown by a share of its base,
    // so the softest hitter fell furthest behind a levelling hero and ended up
    // unable to kill ANY character at any level. A monster needs a big enough
    // base to stay dangerous once multiplied. eventStats scales these with the
    // hero level and turns them into damage.
    animations: {
      idle:   { file: 'idle.png',   frames: 8,  fps: 8 },
      walk:   { file: 'walk.png',   frames: 10, fps: 10 },
      attack: { file: 'attack.png', frames: 11, fps: 12 },
      hit:    { file: 'hit.png',    frames: 4,  fps: 12 },
      die:    { file: 'die.png',    frames: 13, fps: 12 }
    },
    attackChain: ['hit']
  },

  // SATYR_sprite_sheet, cut out of the pack's single 10x11 grid of 32x32 cells:
  // row 0 idle, row 1 run, row 3 the slash, row 8 the hurt, row 6 the death.
  // What is left in the source grid — two more idle variants, a landing, and a
  // twenty-frame shadow cast that runs across the last two rows — is not cut
  // until something needs it, since every sheet listed here is fetched when a
  // battle opens.
  satyr: {
    id: 'satyr',
    name: 'Cindrix',
    basePath: '/event/monsters/satyr',
    background: bg('bg3.jpg'),
    // Day 6 of the ladder, which is what the file is numbered for.
    intro: '6.mp4',
    frameWidth: 32,
    frameHeight: 32,
    // Its feet are on row 26 in idle, so that is the floor. The slash reaches two
    // rows past it, which lands the lunge just over the floor line rather than
    // leaving the creature hovering for every other frame it plays.
    content: { top: 5, bottom: 26 },
    body: { left: 5, right: 22 },
    // 32x32 art next to the golem's 90x64: it needs the larger multiplier to
    // stand the same height in the arena.
    scale: 1.5,
    // Day six: everything the skeleton has and a thicker guard on top, which is
    // what the last step before the boss should be.
    animations: {
      idle:   { file: 'idle.png',   frames: 6,  fps: 8 },
      run:    { file: 'run.png',    frames: 8,  fps: 12 },
      attack: { file: 'attack.png', frames: 7,  fps: 12 },
      hit:    { file: 'hit.png',    frames: 6,  fps: 12 },
      die:    { file: 'die.png',    frames: 10, fps: 10 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  },

  // Bat with VFX, from the 1autumn enemy pack. Shipped already packed as 64x64
  // strips, one per animation, so nothing had to be cropped or rescaled.
  //
  // It flies, which is why `content.bottom` sits below the art rather than on
  // it: the seven rows between the lowest wing pixel and 56 are the hover. Its
  // dive and its death both reach down to that line, so nothing clips through
  // the floor.
  bat: {
    id: 'bat',
    name: 'Evil Bat',
    basePath: '/event/monsters/bat',
    background: bg('bg4.jpg'),
    // Day 1 of the ladder, which is what the file is numbered for.
    intro: '1.mp4',
    frameWidth: 64,
    frameHeight: 64,
    content: { top: 9, bottom: 56 },
    // The creature, not its swing: attack frames reach out to x=5 and the second
    // attack sheet further still, but this is where a charging fighter stops.
    body: { left: 15, right: 48 },
    scale: 1,
    // Fast and frail, and day one: it hits harder than anything else this early
    // but folds quickest, so the opening fight can teach that a wrong answer
    // costs real health without ever being the fight that stops a student.
    // The pack draws its own entrance, so the dashboard plays that forwards
    // rather than rewinding the death sheet the way the golem has to.
    arrival: { animation: 'wakeup', reverse: false },
    animations: {
      idle:   { file: 'idle.png',   frames: 9,  fps: 12 },
      run:    { file: 'run.png',    frames: 8,  fps: 14 },
      attack: { file: 'attack.png', frames: 8,  fps: 12 },
      hit:    { file: 'hit.png',    frames: 5,  fps: 12 },
      die:    { file: 'die.png',    frames: 12, fps: 12 },
      wakeup: { file: 'wakeup.png', frames: 16, fps: 14 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  },

  // SkeletonPack_ByPhewcumber, the sword-armed variant. The pack draws its
  // skeleton facing LEFT — everything else here faces right and is mirrored by
  // the battle to face the hero — so the sheets were flipped once at pack time
  // (scripts/pack-sprite-sheet.mjs --flip) rather than teaching the renderer
  // about handedness.
  //
  // The pack has no death sheet and no idle-to-life sheet, so this is the one
  // monster that fades out when killed and fades in on the dashboard instead of
  // crumbling and reassembling.
  skeleton: {
    id: 'skeleton',
    name: 'Skeletonix',
    basePath: '/event/monsters/skeleton',
    background: bg('bg5.jpg'),
    // Day 5 of the ladder, which is what the file is numbered for.
    intro: '5.mp4',
    frameWidth: 64,
    frameHeight: 64,
    content: { top: 18, bottom: 47 },
    body: { left: 21, right: 51 },
    // Its art is only 30 rows tall, and 1.65 was blowing that up to 50 — level
    // with the boss, and half again the size of the creatures either side of it
    // on the ladder. 1.2 puts it just above them, which is what day five is.
    scale: 1.2,
    // Day five, squarely mid-ladder: no gimmick, just more of everything.
    animations: {
      idle:   { file: 'idle.png',   frames: 6, fps: 8 },
      run:    { file: 'run.png',    frames: 6, fps: 12 },
      attack: { file: 'attack.png', frames: 6, fps: 12 },
      // Two frames is all the pack gives the flinch; slower so it registers.
      hit:    { file: 'hit.png',    frames: 2, fps: 8 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  },

  // Flying Demon 2D Pixel Art, the outline-free variant: one strip per animation
  // at 79x69, repacked mirrored (--flip) so it faces the same way as every other
  // monster here. The last death frame is empty, which is the entrance run
  // backwards.
  demon: {
    id: 'demon',
    name: 'Dreadkin',
    basePath: '/event/monsters/demon',
    background: bg('bg6.jpg'),
    // Day 3 of the ladder, which is what the file is numbered for.
    intro: '3.mp4',
    frameWidth: 79,
    frameHeight: 69,
    // The art fills its frame to the last row, so there is no room below it to
    // hover in — hence the offsets below rather than a gap here.
    content: { top: 4, bottom: 68 },
    // Its wings span the whole frame and its tail trails past the body, so this
    // is the torso rather than the silhouette: a charging fighter should stop at
    // the demon, not at the tip of its tail. Mirrored coordinates — the sheets
    // were flipped at pack time, which puts the tail on the right and the torso
    // at 20-70.
    body: { left: 20, right: 70 },
    scale: 0.75,
    // Day three, and the first monster that out-damages what a student is
    // likely to have levelled into by then: the week's first real loss.
    animations: {
      // It flies. Every sheet is lifted by the same ten rows so it hovers over
      // the floor line instead of standing on its claws — including the death,
      // which would otherwise drop it a foot the instant it was killed.
      idle:   { file: 'idle.png',   frames: 4, fps: 8,  offset: { y: -10 } },
      run:    { file: 'run.png',    frames: 4, fps: 12, offset: { y: -10 } },
      attack: { file: 'attack.png', frames: 8, fps: 12, offset: { y: -10 } },
      hit:    { file: 'hit.png',    frames: 4, fps: 12, offset: { y: -10 } },
      die:    { file: 'die.png',    frames: 7, fps: 10, offset: { y: -10 } }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  },

  // Pixel_DarkNinja_32px, packed from its per-frame folders with
  // scripts/pack-sprite-sheet.mjs. Its attacks are drawn on a 96x64 canvas
  // while everything else is 64x64, so every sheet is normalised onto the wider
  // box: the body sits at the same x in all six (10-49 at rest), and the extra
  // 32 columns are the blade's reach on the right.
  //
  // The pack has no death sheet, but it has two teleports — one that ends on an
  // empty frame and one that begins on one. Those are the death and the
  // entrance: he burns away in a magenta pillar and steps back out of it.
  ninja: {
    id: 'ninja',
    name: 'Onikage',
    basePath: '/event/monsters/ninja',
    background: bg('bg7.jpg'),
    // Day 7 of the ladder, which is what the file is numbered for.
    intro: '7.mp4',
    frameWidth: 96,
    frameHeight: 64,
    content: { top: 15, bottom: 55 },
    body: { left: 10, right: 49 },
    // The tallest thing on the ladder, as the last day should be.
    scale: 1.25,
    // A boss that kills faster than it survives: it out-hits everything else on
    // the ladder, but its guard is no thicker than the golem's, so a fighter who
    // spent points on ATK is rewarded.
    arrival: { animation: 'arrival', reverse: false },
    animations: {
      idle:    { file: 'idle.png',    frames: 8,  fps: 10 },
      run:     { file: 'run.png',     frames: 8,  fps: 12 },
      attack:  { file: 'attack.png',  frames: 6,  fps: 12 },
      hit:     { file: 'hit.png',     frames: 3,  fps: 12 },
      die:     { file: 'die.png',     frames: 16, fps: 14 },
      arrival: { file: 'arrival.png', frames: 14, fps: 14 }
    },
    // Clicking a monster should make it recoil, not swing at you.
    attackChain: ['hit']
  }
}

/**
 * The place a monster is met. The hero banner draws it behind the sprite, and
 * the battle is fought on it, so a day of the ladder is somewhere as well as
 * someone.
 *
 * The scene is on the monster rather than on the stage: eventLadder maps days
 * to monsters, so a day reordered there takes its place along with it — which
 * is why the file numbering no longer tracks the days. bgN is whichever
 * creature claimed it, not day N.
 */
export const DEFAULT_MONSTER_BG = bg('bg1.jpg')

export const monsterBackground = (config) => config?.background || DEFAULT_MONSTER_BG

/**
 * The clip that introduces a monster, played before the fight it opens.
 *
 * Optional. A monster with no `intro` goes straight to the arena, so this is a
 * slot to fill rather than a list to keep in step with anything.
 *
 * A bare filename is a clip in the event bucket's video/ folder; anything with a
 * scheme is used as given, for a clip hosted elsewhere:
 *
 *   intro: '1.mp4'
 *   intro: 'https://…/somewhere-else.mp4'
 *
 * The uploaded files are numbered by the LADDER DAY the monster is met on, not
 * by the monster — 1.mp4 opens day one, whichever creature day one holds. Recut
 * the week in eventLadder.js and these have to be renumbered with it, which is
 * the one thing here that does not follow on its own.
 *
 * EventCutscene plays whatever comes back and is skippable throughout, so a clip
 * is never in the way of a student who wants to fight — and one that fails to
 * load opens the fight rather than blocking it.
 */
export const monsterIntro = (config) => {
  const src = config?.intro
  if (!src) return null
  return /^(https?:)?\/\//.test(src) ? src : clip(src)
}

export const DEFAULT_MONSTER_ID = 'golem'

export const getMonster = (id) => EVENT_MONSTERS[id] || EVENT_MONSTERS[DEFAULT_MONSTER_ID]
