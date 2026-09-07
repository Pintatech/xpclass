/**
 * Event hero characters.
 *
 * Every sheet is a horizontal strip on a uniform grid, so a character is fully
 * described by its frame box plus a frame count per animation. Frame widths
 * were read off the sheets' transparent gutters rather than guessed from the
 * file width — knight sheets divide evenly by 50 but are actually 100 wide,
 * and a wrong stride silently splits the figure across two frames.
 *
 * content: the rows the figure actually occupies inside the frame box. The
 * sheets carry a lot of empty space, so this is what lets a character stand on
 * a bottom edge instead of floating above it.
 *
 * body: the same idea horizontally — the columns the figure occupies in its
 * IDLE stance, which is what brings two fighters into melee range. Frame boxes
 * are far wider than the figures in them (the red knight is 52px of art in a
 * 192px box), so closing the gap between the boxes leaves the sprites standing
 * a long way apart. Measured from idle rather than unioned over every
 * animation, because attack frames reach 30-100px further out with the weapon
 * — that reach is what should cross the gap, so it must not be built into the
 * stopping distance. Both numbers were read off the sheets' alpha channel.
 *
 * scale: relative render size. The frame boxes range from 64px to 128px tall,
 * so without this the knight would tower over the warriors. Tuned so every
 * character reads about the same height on screen.
 *
 * /event/sprite-lab renders all of this live and reports what it detects.
 */
export const EVENT_CHARACTERS = {
  'warrior-woman': {
    id: 'warrior-woman',
    name: 'Nữ Chiến Binh',
    basePath: '/event/warrior-woman',
    frameWidth: 80,
    frameHeight: 64,
    content: { top: 13, bottom: 47 },
    body: { left: 27, right: 52 },
    scale: 1,
    animations: {
      idle:    { file: 'idle.png',    frames: 8,  fps: 8 },
      walk:    { file: 'walk.png',    frames: 8,  fps: 10 },
      run:     { file: 'run.png',     frames: 8,  fps: 12 },
      attack1: { file: 'attack1.png', frames: 7,  fps: 14 },
      attack2: { file: 'attack2.png', frames: 5,  fps: 14 },
      attack3: { file: 'attack3.png', frames: 8,  fps: 14 },
      combo:   { file: 'combo.png',   frames: 20, fps: 14 },
      spell:   { file: 'spell.png',   frames: 16, fps: 14 },
      hit:     { file: 'hit.png',     frames: 2,  fps: 10 }
    },
    attackChain: ['attack1', 'attack2', 'attack3']
  },

  knight: {
    id: 'knight',
    name: 'Hiệp Sĩ',
    basePath: '/event/knight',
    frameWidth: 100,
    frameHeight: 64,
    content: { top: 3, bottom: 63 },
    body: { left: 33, right: 65 },
    scale: 0.48,
    animations: {
      idle:    { file: 'idle.png',    frames: 4,  fps: 6 },
      walk:    { file: 'walk.png',    frames: 7,  fps: 10 },
      run:     { file: 'run.png',     frames: 4,  fps: 12 },
      attack1: { file: 'attack1.png', frames: 6,  fps: 14 },
      attack2: { file: 'attack2.png', frames: 6,  fps: 14 },
      attack3: { file: 'attack3.png', frames: 5,  fps: 14 },
      spell:   { file: 'spell.png',   frames: 10, fps: 12 },
      hit:     { file: 'hit.png',     frames: 4,  fps: 10 }
    },
    attackChain: ['attack1', 'attack2', 'attack3']
  },

  'male-hero': {
    id: 'male-hero',
    name: 'Kiếm Khách',
    basePath: '/event/male-hero',
    frameWidth: 128,
    frameHeight: 128,
    content: { top: 36, bottom: 79 },
    body: { left: 41, right: 72 },
    scale: 0.81,
    animations: {
      idle:    { file: 'idle.png',    frames: 10, fps: 10 },
      walk:    { file: 'walk.png',    frames: 10, fps: 12 },
      run:     { file: 'run.png',     frames: 10, fps: 14 },
      // This sheet draws him a steady 15px right of where idle does, so without
      // the offset every click jumped him sideways and back.
      attack1: { file: 'attack1.png', frames: 3,  fps: 12, offset: { x: -15, y: 0 } },
      jump:    { file: 'jump.png',    frames: 6,  fps: 12 },
      // The tail of the combo, not a swing of its own — it only reads right
      // played straight after attack1, never on its own from idle.
      comboend: { file: 'comboend.png', frames: 4, fps: 12 }
    },
    // This pack ships one attack; the rest of its combo is behind the paywall.
    attackChain: ['attack1']
  },

  // The Adventurer pack ships one PNG per frame rather than strips, so these
  // sheets were composed from its 95 individual sprites to match the others.
  // It has no walk cycle — run doubles for both.
  adventurer: {
    id: 'adventurer',
    name: 'Nhà Thám Hiểm',
    basePath: '/event/adventurer',
    frameWidth: 50,
    frameHeight: 37,
    content: { top: 6, bottom: 35 },
    body: { left: 13, right: 33 },
    scale: 1,
    animations: {
      idle:    { file: 'idle.png',    frames: 4, fps: 8 },
      run:     { file: 'run.png',     frames: 6, fps: 12 },
      attack1: { file: 'attack1.png', frames: 5, fps: 14 },
      attack2: { file: 'attack2.png', frames: 6, fps: 14 },
      attack3: { file: 'attack3.png', frames: 6, fps: 14 },
      jump:    { file: 'jump.png',    frames: 4, fps: 12 },
      crouch:  { file: 'crouch.png',  frames: 4, fps: 10 },
      hit:     { file: 'hit.png',     frames: 3, fps: 10 },
      die:     { file: 'die.png',     frames: 7, fps: 10 }
    },
    attackChain: ['attack1', 'attack2', 'attack3']
  },

  // Hand-Combat is an expansion moveset for the same adventurer, so it shares
  // that pack's frame box and ground line. It ships no idle of its own and
  // borrows the sword pack's, whose frames are ~19px wide — a neutral stance
  // rather than a drawn weapon, so it reads correctly for a brawler. Its source
  // PNGs are palette-indexed where the sword pack's are RGBA.
  brawler: {
    id: 'brawler',
    name: 'Võ Sĩ',
    basePath: '/event/brawler',
    frameWidth: 50,
    frameHeight: 37,
    content: { top: 1, bottom: 35 },
    body: { left: 13, right: 33 },
    scale: 1,
    animations: {
      idle:      { file: 'idle.png',      frames: 4,  fps: 8 },
      walk:      { file: 'walk.png',      frames: 6,  fps: 10 },
      run:       { file: 'run.png',       frames: 6,  fps: 12 },
      attack1:   { file: 'attack1.png',   frames: 13, fps: 16 },
      attack2:   { file: 'attack2.png',   frames: 8,  fps: 14 },
      runattack: { file: 'runattack.png', frames: 7,  fps: 14 },
      crouch:    { file: 'crouch.png',    frames: 6,  fps: 10 },
      wallrun:   { file: 'wallrun.png',   frames: 6,  fps: 12 },
      hit:       { file: 'hit.png',       frames: 7,  fps: 10 },
      getup:     { file: 'getup.png',     frames: 7,  fps: 10 },
      // Airborne moves — their feet stop at y=30 and never reach the ground
      // line at 35, so they can't play from a standing idle without the
      // character hopping and snapping back. Kept for previewing only.
      dropkick:  { file: 'dropkick.png',  frames: 4,  fps: 14 }
    },
    // Punch and kick are the only two ground attacks this pack has.
    attackChain: ['attack1', 'attack2']
  },

  // Red Cape Knight (Jump_Button). Drawn far larger than the rest — the figure
  // is 99px tall against ~30px for the warriors — so it has to shrink rather
  // than grow. It is true pixel art (27 colours, no soft edges) but not chunky,
  // so there is no lossless way to shrink it: hence `smooth`, which interpolates
  // instead of dropping rows. `spin`, `jump` and `downattack` all leave the
  // ground mid-animation and so stay out of the click chain.
  'red-knight': {
    id: 'red-knight',
    name: 'Kỵ Sĩ Áo Đỏ',
    basePath: '/event/red-knight',
    frameWidth: 192,
    frameHeight: 128,
    content: { top: 14, bottom: 127 },
    body: { left: 68, right: 120 },
    scale: 0.3,
    smooth: true,
    animations: {
      idle:       { file: 'idle.png',       frames: 5,  fps: 8 },
      idlesword:  { file: 'idlesword.png',  frames: 5,  fps: 8 },
      walk:       { file: 'walk.png',       frames: 9,  fps: 10 },
      run:        { file: 'run.png',        frames: 9,  fps: 12 },
      attack1:    { file: 'attack1.png',    frames: 6,  fps: 14 },
      attack2:    { file: 'attack2.png',    frames: 6,  fps: 14 },
      dash:       { file: 'dash.png',       frames: 7,  fps: 14 },
      hit:        { file: 'hit.png',        frames: 5,  fps: 10 },
      die:        { file: 'die.png',        frames: 6,  fps: 10 },
      win:        { file: 'win.png',        frames: 5,  fps: 8 },
      // Drawn a constant 11px left of idle and lands 4px off the ground, but it
      // ends where it starts, so one offset squares both joins.
      spin:       { file: 'spin.png',       frames: 9,  fps: 14, offset: { x: 11, y: 3 } },
      jump:       { file: 'jump.png',       frames: 4,  fps: 12 },
      downattack: { file: 'downattack.png', frames: 11, fps: 14 },
      duck:       { file: 'duck.png',       frames: 4,  fps: 12 },
      duckidle:   { file: 'duckidle.png',   frames: 3,  fps: 8 },
      // A real third attack, and the only excluded one that is fully grounded.
      // It starts already crouched — 30px shorter than idle, with no transition
      // frames — so chaining it from a standing idle halves her height in one
      // frame. Playing `duck` into it and `duck` reversed back out would fix
      // that, but the player runs one animation per action.
      duckattack: { file: 'duckattack.png', frames: 6,  fps: 14 }
    },
    // dash is excluded on measurement, not on looks: its feet are planted the
    // whole way but travel 13px and stay there, so idle yanks her back.
    attackChain: ['attack1', 'attack2', 'spin']
  },

  // Knight 2D Pixel Art. Ships with_outline and without_outline variants at
  // identical sizes — the outlined one is used because the hero sits on a photo
  // background, where an unoutlined sprite loses its edges. Swapping is a
  // re-copy of the other folder, no config change.
  'pixel-knight': {
    id: 'pixel-knight',
    name: 'Kỵ Sĩ Thép',
    basePath: '/event/pixel-knight',
    frameWidth: 96,
    frameHeight: 84,
    content: { top: 16, bottom: 61 },
    body: { left: 28, right: 59 },
    scale: 0.81,
    animations: {
      idle:    { file: 'idle.png',    frames: 7,  fps: 8 },
      walk:    { file: 'walk.png',    frames: 8,  fps: 10 },
      run:     { file: 'run.png',     frames: 8,  fps: 12 },
      attack1: { file: 'attack1.png', frames: 6,  fps: 14 },
      attack2: { file: 'attack2.png', frames: 5,  fps: 14 },
      attack3: { file: 'attack3.png', frames: 6,  fps: 14 },
      defend:  { file: 'defend.png',  frames: 6,  fps: 10 },
      hit:     { file: 'hit.png',     frames: 4,  fps: 10 },
      jump:    { file: 'jump.png',    frames: 5,  fps: 12 },
      die:     { file: 'die.png',     frames: 12, fps: 10 }
    },
    attackChain: ['attack1', 'attack2', 'attack3']
  }
}

export const EVENT_ENABLED = true
export const DEFAULT_CHARACTER_ID = 'warrior-woman'

export const CHARACTER_LIST = Object.values(EVENT_CHARACTERS)

export const getCharacter = (id) =>
  EVENT_CHARACTERS[id] || EVENT_CHARACTERS[DEFAULT_CHARACTER_ID]

export const animationSrc = (config, name) => {
  const anim = config?.animations?.[name]
  return anim ? `${config.basePath}/${anim.file}` : null
}

/**
 * Rendered gap between each side of the frame box and the drawn figure.
 *
 * A flip swaps them: the sprite is mirrored inside a box that keeps its width,
 * so the gutter facing the opponent is the one from the other side of the
 * config. Without that, a flipped monster stops as if its back were its front.
 */
export const bodyPad = (config, scale, flip = false) => {
  const renderScale = scale * (config.scale || 1)
  const body = config.body || { left: 0, right: config.frameWidth - 1 }
  const left = body.left * renderScale
  const right = (config.frameWidth - 1 - body.right) * renderScale
  return flip ? { left: right, right: left } : { left, right }
}

/**
 * Everything needed to place one animation on screen. Kept here rather than in
 * a component because the hero and the battle both draw these sprites and must
 * agree on where the ground is — a mismatch shows up as a character standing at
 * a different height in each place.
 */
export const spriteMetrics = (config, name, scale, flip = false) => {
  const anim = config.animations[name] || config.animations.idle
  const renderScale = scale * (config.scale || 1)
  const content = config.content || { top: 0, bottom: config.frameHeight - 1 }
  const offset = anim?.offset

  return {
    anim,
    src: animationSrc(config, name) || animationSrc(config, 'idle'),
    renderScale,
    // Empty rows below the feet, pulled out of the layout box so the sprite can
    // sit on a bottom edge and actually stand on it.
    footPad: (config.frameHeight - 1 - content.bottom) * renderScale,
    headTop: content.top * renderScale,
    // Cancels sheets drawn at a constant offset from the idle sheet.
    shiftX: (offset?.x || 0) * renderScale * (flip ? -1 : 1),
    shiftY: (offset?.y || 0) * renderScale
  }
}
