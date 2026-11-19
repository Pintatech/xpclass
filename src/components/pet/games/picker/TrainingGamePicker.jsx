// Training game picker: the sheet that opens from the Train button on the pet card (PetDisplay).
// - Only looks here. What to show comes from PetDisplay (games switched on, competition game, energy, hours);
//   what a tap does stays in PetDisplay (startFromPicker: energy, the attempt row, the leaderboard, the game).
// - Looks: TrainingGamePicker.css (tgp- classes). The sheet shell (bottom sheet on phones, dialog on PC, scrolling,
//   Esc, focus) is the profile's Sheet, styled by Profile.css (pf- classes).
import { useState } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, Clock, Gamepad2, Loader2, Lock, Moon, Play, Trophy, Users, Utensils } from 'lucide-react'
import Sheet from '../../../profile/parts/Sheet'
import { assetUrl } from '../../../../hooks/useBranding'
import '../../../profile/Profile.css'
import './TrainingGamePicker.css'

// Every game the picker can show, in picker order. Adding a game = one line here (see games/NEW_GAME_CHECKLIST.md).
// key: the game_type saved in training_scores. art: picture path for assetUrl, or 'pet' for the student's own pet.
// tint: tile colour (a tgp-tint-* class in the CSS). fit 'cover': a square picture with its own background,
// shown as a rounded icon. zoom: enlarges art with a lot of empty space around it.
// Students see only the keys the admin switched on (pet_training_enabled_games); teachers and admins see all.
// Say It Right (sayitright) is left out on purpose: the game still runs in PvP, leaderboards and the admin toggle.
const TRAINING_GAMES = [
  { key: 'scramble', name: 'Word Scramble', art: '/image/dashboard/pet-scramble.jpg', tint: 'purple', fit: 'cover' },
  { key: 'whackmole', name: 'Whack-a-Mole', art: '/pet-game/whack/mole-normal.png', tint: 'green' },
  { key: 'astroblast', name: 'Astro Blast', art: '/image/inventory/spaceships/phantom-voyager.png', tint: 'red' },
  { key: 'flappy', name: 'Flappy Pet', art: '/image/dashboard/flap.png', tint: 'sky' },
  { key: 'matchgame', name: 'Match Up', art: '/image/dashboard/match1.png', tint: 'indigo' },
  { key: 'wordtype', name: 'Word Type', art: '/image/dashboard/pet-type.webp', tint: 'cyan' },
  { key: 'bombparty', name: 'Bomb Defuse', art: '/pet-game/bomb/bomb.png', tint: 'purple' },
  { key: 'quizrush', name: 'Quiz Rush', art: '/pet-display/game-logo/quiz.png', tint: 'violet', zoom: 1.3 },
  { key: 'bossbattle', name: 'Boss Battle', art: '/pet-game/boss/boss1.png', tint: 'red' },
  { key: 'angrypet', name: 'Angry Pet', art: '/pet-game/angry/Slingshot.png', tint: 'orange' },
  { key: 'catch', name: 'Hungry Pet', art: '/image/pet/catch-game.png', tint: 'teal' },
  { key: 'fishing', name: 'Fishing Frenzy', art: '/pet-display/game-logo/fish.png', tint: 'cyan' },
  { key: 'petdash', name: 'Pet Dash', art: 'pet', tint: 'amber' },
]

const ENERGY_ICON = '/image/dashboard/energy.svg'
// Names use non-breaking hyphens (U+2011): "Whack-a-Mole" wraps as a whole, never as "Whack-" / "a-Mole".
const NB_HYPHEN = String.fromCharCode(0x2011)

/** A game's picture. A picture that fails to load turns into a gamepad icon instead of a broken image. */
const GameArt = ({ game, petImage, className }) => {
  const [broken, setBroken] = useState(false)
  const src = game.art === 'pet' ? petImage : assetUrl(game.art)
  if (!src || broken) return <Gamepad2 className={`${className} tgp-art-missing`} aria-hidden="true" />
  return (
    <img
      src={src}
      alt=""
      draggable="false"
      decoding="async"
      className={`${className}${game.fit === 'cover' ? ' is-cover' : ''}`}
      style={game.zoom ? { '--zoom': game.zoom } : undefined}
      onError={() => setBroken(true)}
    />
  )
}

GameArt.propTypes = {
  game: PropTypes.shape({ art: PropTypes.string, fit: PropTypes.string, zoom: PropTypes.number }).isRequired,
  petImage: PropTypes.string,
  className: PropTypes.string,
}

const TrainingGamePicker = ({
  enabledGames = [],
  showAll = false,
  competitionGame = null,
  petImage = '',
  closedReason = '',
  energy = 100,
  energyCost = 10,
  tired = false,
  pvpWaiting = 0,
  starting = null,
  failed = false,
  onPlay,
  onQuickMatch,
  onFeed,
  onClose,
}) => {
  // Bumped when a locked game is tapped: the energy bar shakes to show why.
  const [nudge, setNudge] = useState(0)

  const games = TRAINING_GAMES.filter((g) => showAll || enabledGames.includes(g.key))
  const featured = games.find((g) => g.key === competitionGame) || null
  const grid = featured ? games.filter((g) => g !== featured) : games
  const busy = starting != null

  const tap = (key) => {
    if (tired) setNudge((n) => n + 1)
    else onPlay(key)
  }

  const lockChip = (
    <span className="tgp-lock">
      <Lock aria-hidden="true" />
      <img src={assetUrl(ENERGY_ICON)} alt="" />
      {energyCost}
    </span>
  )

  const competitionCard = featured && (
    <button
      type="button"
      className="tgp-hero"
      onClick={() => tap(featured.key)}
      disabled={busy && starting !== featured.key}
      aria-disabled={tired || undefined}
      aria-busy={starting === featured.key || undefined}
      aria-label={`${featured.name} – competition`}
      title="Competition"
    >
      <span className="tgp-hero-shine" aria-hidden="true" />
      <span className="tgp-cup" aria-hidden="true">
        <Trophy />
      </span>
      <span className="tgp-hero-text">
        <span className="tgp-hero-name">{featured.name}</span>
        <span className="tgp-hero-go" aria-hidden="true">
          {starting === featured.key ? <Loader2 className="animate-spin" /> : tired ? lockChip : <Play />}
        </span>
      </span>
      <GameArt game={featured} petImage={petImage} className="tgp-hero-art" />
    </button>
  )

  const quickMatchCard = (
    <button
      type="button"
      className="tgp-qm"
      onClick={onQuickMatch}
      disabled={busy && starting !== 'quickmatch'}
      aria-busy={starting === 'quickmatch' || undefined}
      aria-label={`Quick Match – live${pvpWaiting > 0 ? `, ${pvpWaiting} waiting` : ''}`}
    >
      <span className="tgp-qm-icon" aria-hidden="true">
        <img src={assetUrl('/icon/dashboard/pvp.png')} alt="" />
      </span>
      <span className="tgp-qm-text">
        <span className="tgp-qm-name">Quick Match</span>
        <span className="tgp-qm-meta" aria-hidden="true">
          <span className="tgp-live">
            <span className="tgp-live-dot" />
            LIVE
          </span>
          {pvpWaiting > 0 && (
            <span className="tgp-wait" title={`${pvpWaiting} waiting`}>
              <Users />
              {pvpWaiting}
            </span>
          )}
        </span>
      </span>
      <span className="tgp-qm-go" aria-hidden="true">
        {starting === 'quickmatch' ? <Loader2 className="animate-spin" /> : <Play />}
      </span>
    </button>
  )

  const tile = (game) => (
    <button
      key={game.key}
      type="button"
      className={`tgp-tile tgp-tint-${game.tint}`}
      onClick={() => tap(game.key)}
      disabled={busy && starting !== game.key}
      aria-disabled={tired || undefined}
      aria-busy={starting === game.key || undefined}
      title={tired ? `Needs ${energyCost} energy` : game.name}
    >
      <span className={`tgp-art${game.art === 'pet' ? ' is-pet' : ''}`}>
        <GameArt game={game} petImage={petImage} className="tgp-img" />
        {tired && lockChip}
        {starting === game.key && (
          <span className="tgp-spin">
            <Loader2 className="animate-spin" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="tgp-name">{game.name.replace(/-/g, NB_HYPHEN)}</span>
    </button>
  )

  return (
    <Sheet
      title="Training"
      size="lg"
      onClose={onClose}
      lead={
        <span className="tgp-lead" aria-hidden="true">
          <img src={assetUrl('/image/dashboard/pet-train.svg')} alt="" />
        </span>
      }
      sub={
        !closedReason && (
          <span className="tgp-xp" title="Earn +5 XP on success">
            <img src={assetUrl('/image/study/xp.png')} alt="" />
            +5 XP
          </span>
        )
      }
    >
      {closedReason ? (
        <div className="tgp-closed">
          <span className="tgp-closed-icon" aria-hidden="true">
            <Clock />
          </span>
          <p>{closedReason}</p>
          <button type="button" className="tgp-ok" onClick={onClose}>
            OK
          </button>
        </div>
      ) : (
        <div className={`tgp-body${busy ? ' is-busy' : ''}`}>
          {tired && (
            <div key={nudge} className={`tgp-tired${nudge ? ' tgp-nudge' : ''}`} role="status">
              <span className="tgp-tired-pet" aria-hidden="true">
                {petImage && <img src={petImage} alt="" />}
                <span className="tgp-zz">
                  <Moon />
                </span>
              </span>
              <span className="tgp-energy" aria-label={`Energy ${energy} of ${energyCost}`}>
                <img src={assetUrl(ENERGY_ICON)} alt="" />
                <b>{energy}</b>
                <span>/{energyCost}</span>
              </span>
              <button type="button" className="tgp-feed" onClick={onFeed}>
                <Utensils aria-hidden="true" />
                Feed
              </button>
            </div>
          )}

          {failed && (
            <p className="tgp-note" role="alert">
              <AlertCircle aria-hidden="true" />
              Oops! Try again.
            </p>
          )}

          {/* The entrance rises two blocks, not every card: 13 separate animations cost a slow phone ~0.2 s. */}
          <div className={`tgp-top tgp-rise${featured ? ' has-hero' : ''}`}>
            {competitionCard}
            {quickMatchCard}
          </div>

          {grid.length > 0 ? (
            <div className="tgp-grid tgp-rise" style={{ '--i': 3 }}>
              {grid.map(tile)}
            </div>
          ) : (
            !featured && <p className="tgp-empty">No games yet</p>
          )}
        </div>
      )}
    </Sheet>
  )
}

TrainingGamePicker.propTypes = {
  /** Game keys the admin switched on for students (site setting pet_training_enabled_games). */
  enabledGames: PropTypes.arrayOf(PropTypes.string),
  /** Teachers and admins: every game in the list, switched on or not. */
  showAll: PropTypes.bool,
  /** Key of the game with a running competition: shown as the big card on top. */
  competitionGame: PropTypes.string,
  /** The active pet's picture: Pet Dash's art and the tired pet. */
  petImage: PropTypes.string,
  /** Set when training is closed right now (hours or switched off): the sheet only shows this text. */
  closedReason: PropTypes.string,
  energy: PropTypes.number,
  /** Energy one game costs. */
  energyCost: PropTypes.number,
  /** Not enough energy for a game: games are locked and the Feed bar shows. Quick Match stays open. */
  tired: PropTypes.bool,
  /** Players waiting for Quick Match. */
  pvpWaiting: PropTypes.number,
  /** Key of the game being started (spinner on it, other games wait), or null. */
  starting: PropTypes.string,
  /** The last start failed (network): a short "try again" line. */
  failed: PropTypes.bool,
  onPlay: PropTypes.func.isRequired,
  onQuickMatch: PropTypes.func.isRequired,
  onFeed: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default TrainingGamePicker
