import Phaser from 'phaser'

// ---- Tunables ----
const LEVEL = { width: 1280, height: 760 }
const GRAVITY = 1200
const MOVE_SPEED = 320
const JUMP_VELOCITY = -700
const COYOTE_MS = 90        // grace period to still jump just after leaving a ledge
const BUFFER_MS = 120       // remember a jump press made just before landing
const CUT_JUMP = 0.45       // release jump early -> shorter hop (variable height)
const SPAWN = { x: 640, y: 360 }

// [x, y, width, height] — centred rectangles. Quincunx: 1 centre + 4 around it.
const PLATFORMS = [
  [640, 430, 240, 30],   // centre (player start)
  [330, 250, 220, 30],   // top-left
  [950, 250, 220, 30],   // top-right
  [330, 590, 220, 30],   // bottom-left
  [950, 590, 220, 30],   // bottom-right
]

// One coin hovering above each platform.
const COINS = [
  [640, 345], [330, 195], [950, 195], [330, 535], [950, 535],
]

// Monster slots — one per outer platform: [x, y, patrolHalfRange]
const ENEMIES = [
  [330, 215, 70],   // top-left
  [950, 215, 70],   // top-right
  [330, 555, 70],   // bottom-left
  [950, 555, 70],   // bottom-right
]

// ---- Vocabulary (placeholder bank — swap for the real xpclass word bank later) ----
// Each round shows `word` up top; the 4 monsters carry meanings, one of which is correct.
const WORD_BANK = [
  { word: 'Happy', meaning: 'Joyful' },
  { word: 'Big', meaning: 'Large' },
  { word: 'Fast', meaning: 'Quick' },
  { word: 'Cold', meaning: 'Chilly' },
  { word: 'Angry', meaning: 'Mad' },
  { word: 'Smart', meaning: 'Clever' },
  { word: 'Begin', meaning: 'Start' },
  { word: 'Tired', meaning: 'Sleepy' },
  { word: 'Brave', meaning: 'Fearless' },
  { word: 'Tiny', meaning: 'Small' },
]
const MAX_ROUNDS = 8

const shuffle = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default class PlatformerScene extends Phaser.Scene {
  constructor() {
    super('Platformer')
  }

  preload() {
    // Character sprite strips live in public/game/1/ — each is a 42x42 frame grid.
    // BASE_URL keeps paths correct if the app is ever deployed under a subpath.
    const base = import.meta.env.BASE_URL
    const opts = { frameWidth: 42, frameHeight: 42 }
    this.load.spritesheet('idle', `${base}game/1/Idle.png`, opts)  // 4 frames
    this.load.spritesheet('walk', `${base}game/1/Walk.png`, opts)  // 6 frames
    this.load.spritesheet('jump', `${base}game/1/Jump.png`, opts)  // 8 frames
    this.load.spritesheet('attack', `${base}game/1/Attack1.png`, opts)  // 6 frames
  }

  create() {
    this.onStats = this.registry.get('onStats') || (() => {})

    this.physics.world.setBounds(0, 0, LEVEL.width, LEVEL.height)
    this.cameras.main.setBounds(0, 0, LEVEL.width, LEVEL.height)
    this.cameras.main.setBackgroundColor('#87ceeb')

    // Parallax-ish decorative hills (static, just for depth)
    const bg = this.add.graphics().setScrollFactor(0.3).setDepth(-10)
    bg.fillStyle(0x9fd8a0, 1)
    for (let i = 0; i < 8; i++) {
      bg.fillCircle(200 + i * 300, 820, 220)
    }

    // --- Platforms ---
    this.platforms = this.physics.add.staticGroup()
    PLATFORMS.forEach(([x, y, w, h]) => {
      const isGround = h >= 50
      const rect = this.add.rectangle(x, y, w, h, isGround ? 0x6b8e23 : 0x8b5a2b)
      rect.setStrokeStyle(3, 0x000000, 0.15)
      this.platforms.add(rect)
    })

    // --- Coins ---
    this.coinTotal = COINS.length
    this.coinsGot = 0
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true })
    COINS.forEach(([x, y]) => {
      const coin = this.add.circle(x, y, 12, 0xffd700)
      coin.setStrokeStyle(3, 0xd4a017, 1)
      this.coins.add(coin)
    })

    this.won = false

    // --- Monsters (filled each round with meaning options) ---
    this.enemies = this.physics.add.group({ allowGravity: false, immovable: true })

    // --- Quiz round state ---
    this.bank = this.buildBank()
    this.roundsTotal = Math.min(MAX_ROUNDS, this.bank.length)
    this.order = shuffle(this.bank).slice(0, this.roundsTotal)
    this.roundIndex = 0
    this.correct = 0
    this.wrong = 0
    this.resolving = false
    this.currentWord = null
    this.lastResult = null

    // --- Animations (one strip per state) ---
    this.anims.create({ key: 'a-idle', frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 3 }), frameRate: 6, repeat: -1 })
    this.anims.create({ key: 'a-walk', frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 5 }), frameRate: 10, repeat: -1 })
    this.anims.create({ key: 'a-jump', frames: this.anims.generateFrameNumbers('jump', { start: 0, end: 7 }), frameRate: 12, repeat: 0 })
    this.anims.create({ key: 'a-attack', frames: this.anims.generateFrameNumbers('attack', { start: 0, end: 5 }), frameRate: 16, repeat: 0 })

    // --- Player (animated sprite) ---
    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'idle')
    this.player.setScale(1.5)
    this.player.play('a-idle')
    this.player.body.setCollideWorldBounds(false)
    this.player.body.setMaxVelocity(MOVE_SPEED, 2000)
    // Collision box tighter than the 42x42 frame, feet aligned to the bottom.
    this.player.body.setSize(20, 32)
    this.player.body.setOffset(11, 10)
    this.facing = 1
    this.attacking = false
    this.attackUntil = 0

    this.physics.world.gravity.y = GRAVITY

    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this)
    this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this)

    // --- Camera ---
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
    this.cameras.main.setDeadzone(120, 200)

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys('W,A,D,SPACE')
    // Stop Space/arrows from scrolling the page behind the game.
    this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,W,A,S,D')
    this.lastGroundedAt = -9999
    this.lastJumpPressedAt = -9999
    this.jumpHeld = false

    // Tap anywhere = jump (mobile-friendly)
    this.input.on('pointerdown', () => { this.lastJumpPressedAt = this.time.now; this.jumpHeld = true })
    this.input.on('pointerup', () => { this.jumpHeld = false })

    this.deaths = 0
    this.startRound()
  }

  collectCoin(player, coin) {
    coin.destroy()
    this.coinsGot++
    this.emitStats()
  }

  hitEnemy(player, enemy) {
    // Touching is harmless — attacking the correct-meaning monster is what counts.
    if (this.attacking) this.resolveHit(enemy)
  }

  // Sweep a hitbox in front of the player; strike the monster caught in it.
  swingAttack() {
    const REACH = 64
    const V_TOLERANCE = 44
    let target = null
    this.enemies.children.iterate((e) => {
      if (!e || !e.body) return true
      const dx = (e.x - this.player.x) * this.facing   // >0 means in front
      const dy = Math.abs(e.y - this.player.y)
      if (dx > -12 && dx < REACH && dy < V_TOLERANCE) target = e
      return true
    })
    if (target) this.resolveHit(target)
  }

  resolveHit(enemy) {
    if (this.resolving || this.won) return
    this.resolving = true

    const correct = !!enemy.isCorrect
    if (correct) this.correct++
    else this.wrong++
    this.lastResult = correct ? 'correct' : 'wrong'

    // Round resolves: monsters clear, then the next word loads after a beat.
    this.clearMonsters()
    this.emitStats()

    this.roundIndex++
    this.time.delayedCall(700, () => {
      this.resolving = false
      if (this.roundIndex >= this.roundsTotal) {
        this.won = true
        this.player.body.setVelocity(0, 0)
        this.player.body.setAllowGravity(false)
        this.emitStats()
      } else {
        this.startRound()
      }
    })
  }

  clearMonsters() {
    this.enemies.children.iterate((e) => { if (e && e.label) e.label.destroy() })
    this.enemies.clear(true, true)
  }

  // Use the word bank passed in via the registry, else the built-in sample.
  // Accepts flexible entry shapes: {word|term|front, meaning|hint|definition|back}.
  buildBank() {
    const provided = this.registry.get('wordBank')
    const norm = (provided || [])
      .map((e) => ({
        word: e.word ?? e.term ?? e.front,
        meaning: e.meaning ?? e.hint ?? e.definition ?? e.back,
      }))
      .filter((e) => e.word && e.meaning)
    // Need at least 4 entries for 1 correct + 3 distractor meanings.
    return norm.length >= 4 ? norm : WORD_BANK
  }

  startRound() {
    const entry = this.order[this.roundIndex]
    this.currentWord = entry

    // Correct meaning + 3 distractor meanings from other words, then shuffle.
    const distractors = shuffle(this.bank.filter((w) => w.meaning !== entry.meaning))
      .slice(0, ENEMIES.length - 1)
      .map((w) => ({ text: w.meaning, isCorrect: false }))
    const options = shuffle([{ text: entry.meaning, isCorrect: true }, ...distractors])

    this.clearMonsters()
    options.forEach((opt, i) => {
      const [x, y, range] = ENEMIES[i]
      const e = this.add.rectangle(x, y, 40, 40, 0xdc2626)
      e.setStrokeStyle(3, 0x7f1d1d, 1)
      this.enemies.add(e)
      e.body.setVelocityX(80)
      e.originX = x
      e.range = range
      e.isCorrect = opt.isCorrect
      e.label = this.add.text(x, y - 40, opt.text, {
        fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(5)
    })

    this.lastResult = null
    this.emitStats()
  }

  respawn() {
    this.deaths++
    this.player.body.setVelocity(0, 0)
    this.player.setPosition(SPAWN.x, SPAWN.y)
    this.emitStats()
  }

  emitStats() {
    this.onStats({
      word: this.currentWord ? this.currentWord.word : '',
      round: Math.min(this.roundIndex + 1, this.roundsTotal),
      roundsTotal: this.roundsTotal,
      correct: this.correct,
      wrong: this.wrong,
      lastResult: this.lastResult,
      coins: this.coinsGot,
      coinTotal: this.coinTotal,
      deaths: this.deaths,
      won: this.won,
    })
  }

  update(time) {
    if (!this.player || !this.player.body) return

    // --- Monster patrol (labels follow) ---
    this.enemies.children.iterate((e) => {
      if (!e || !e.body) return true
      if (e.x > e.originX + e.range && e.body.velocity.x > 0) e.body.setVelocityX(-80)
      else if (e.x < e.originX - e.range && e.body.velocity.x < 0) e.body.setVelocityX(80)
      if (e.label) e.label.setPosition(e.x, e.y - 40)
      return true
    })

    if (this.won) {
      this.player.body.setVelocityX(0)
      return
    }

    const body = this.player.body
    const onGround = body.blocked.down || body.touching.down
    if (onGround) this.lastGroundedAt = time

    // --- Horizontal movement ---
    const left = this.cursors.left.isDown || this.keys.A.isDown
    const right = this.cursors.right.isDown || this.keys.D.isDown
    if (left && !right) body.setVelocityX(-MOVE_SPEED)
    else if (right && !left) body.setVelocityX(MOVE_SPEED)
    else body.setVelocityX(0)

    // --- Jump input (with buffer) — Space is attack now, so jump is W / Up / tap ---
    const jumpKey = this.cursors.up.isDown || this.keys.W.isDown
    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W)
    if (jumpJustPressed) this.lastJumpPressedAt = time
    this.jumpHeld = jumpKey || this.jumpHeld

    // Coyote time + jump buffer: jump if we pressed recently AND were grounded recently.
    const canCoyote = time - this.lastGroundedAt <= COYOTE_MS
    const bufferedJump = time - this.lastJumpPressedAt <= BUFFER_MS
    if (bufferedJump && canCoyote) {
      body.setVelocityY(JUMP_VELOCITY)
      this.lastJumpPressedAt = -9999
      this.lastGroundedAt = -9999
    }

    // Variable jump height: release early while rising -> cut the jump short.
    if (!jumpKey && !this.jumpHeld && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * CUT_JUMP)
    }
    if (!jumpKey) this.jumpHeld = false

    // --- Attack (Space) ---
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && !this.attacking) {
      this.attacking = true
      this.attackUntil = time + 375   // ~6 frames @ 16fps
      this.player.play('a-attack', true)
      this.swingAttack()
    }
    if (this.attacking && time >= this.attackUntil) this.attacking = false

    // --- Animation + facing ---
    if (left && !right) this.facing = -1
    else if (right && !left) this.facing = 1
    this.player.setFlipX(this.facing === -1)

    if (this.attacking) {
      // Attack animation owns the sprite until it finishes.
    } else if (!onGround) {
      if (this.player.anims.currentAnim?.key !== 'a-jump') this.player.play('a-jump', true)
    } else if (body.velocity.x !== 0) {
      this.player.play('a-walk', true)
    } else {
      this.player.play('a-idle', true)
    }

    // --- Fell off the world ---
    if (this.player.y > LEVEL.height + 100) this.respawn()
  }
}
