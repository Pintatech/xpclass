import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Clock, Crown, HelpCircle, RefreshCw, Sparkles, Star, Target, Trophy } from 'lucide-react';
import { assetUrl } from '../../../hooks/useBranding';

// The board on Pet Dash's ready screen: the player's records, the weekly and all-time leaderboards, how to play,
// and the score to beat. Data comes from useTrainingRecords (passed in as `records`).

const fmt = n => (Number.isFinite(n) ? n.toLocaleString('en-US') : '—');

// "Nguyễn Thị Minh Anh" -> "Minh Anh": a Vietnamese name ends with the given name, the part classmates use.
const shortName = name => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Student';
  return words.length >= 3 ? words.slice(-2).join(' ') : words.join(' ');
};

const untilReset = ms => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const EMOJI = /\p{Extended_Pictographic}/u;

const RowAvatar = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const isImage = Boolean(src) && (/^https?:\/\//.test(src) || src.startsWith('/'));
  if (isImage && !failed) {
    return <img className="pd-row-avatar" src={src.startsWith('/') ? assetUrl(src) : src} alt="" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} />;
  }
  // An avatar can also be an emoji (see AvatarWithFrame); otherwise the first letter of the name.
  const glyph = !isImage && src && EMOJI.test(src) ? src : (String(name || '?').trim().charAt(0).toUpperCase() || '?');
  return <span className="pd-row-avatar" aria-hidden="true">{glyph}</span>;
};
RowAvatar.propTypes = { src: PropTypes.string, name: PropTypes.string };

const entryShape = PropTypes.shape({
  id: PropTypes.string,
  rank: PropTypes.number,
  score: PropTypes.number,
  name: PropTypes.string,
  avatar: PropTypes.string,
  isMe: PropTypes.bool,
});

const BoardRow = ({ entry }) => (
  <li className="pd-row" data-me={entry.isMe || undefined} data-podium={entry.rank && entry.rank <= 3 ? entry.rank : undefined}>
    <span className="pd-row-rank">{entry.rank ?? '–'}</span>
    <RowAvatar src={entry.avatar} name={entry.name} />
    <span className="pd-row-name"><span>{entry.name}</span>{entry.isMe && <em>YOU</em>}</span>
    <strong className="pd-row-score">{fmt(entry.score)}</strong>
  </li>
);
BoardRow.propTypes = { entry: entryShape.isRequired };

const SkeletonRows = ({ count }) => Array.from({ length: count }, (_, i) => (
  <li key={i} className="pd-row pd-row-skeleton" aria-hidden="true">
    <span className="pd-row-rank" />
    <span className="pd-row-avatar" />
    <span className="pd-sk-bar" style={{ width: `${68 - i * 9}%` }} />
    <span className="pd-sk-bar pd-sk-score" />
  </li>
));

const boardShape = PropTypes.shape({
  entries: PropTypes.arrayOf(entryShape).isRequired,
  me: entryShape,
  total: PropTypes.number,
});

// Height of the fade at the bottom of a scrolling list (see .pd-board-list in PetDash.css).
const LIST_FADE = 18;

// The top of the board, with the player's own row pinned underneath when they are further down.
const BoardList = ({ board, label, emptyText }) => {
  const listRef = useRef(null);
  // When the player's own row is below the fold, scroll just enough to show it above the fade, so the list
  // keeps as many of the top runners as possible. Only the list scrolls, never the page around it.
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector('[data-me]');
    if (!list || !row) return;
    const bottom = row.offsetTop + row.offsetHeight + LIST_FADE - list.clientHeight;
    list.scrollTop = Math.max(0, bottom);
  }, [board]);

  if (!board.entries.length) {
    return <div className="pd-board-empty"><Sparkles size={22} /><span>{emptyText}</span></div>;
  }
  const pinned = board.me && !board.entries.some(entry => entry.isMe) ? board.me : null;
  return (
    <>
      <ol className="pd-board-list" ref={listRef} aria-label={label}>
        {board.entries.map(entry => <BoardRow key={entry.id} entry={entry} />)}
      </ol>
      {pinned && <ol className="pd-board-me" aria-label="Your place"><BoardRow entry={pinned} /></ol>}
    </>
  );
};
BoardList.propTypes = { board: boardShape.isRequired, label: PropTypes.string.isRequired, emptyText: PropTypes.string.isRequired };

const RecordTiles = ({ data, loading }) => {
  const best = data?.best;
  const week = data?.week;
  const record = data?.record;
  let bestNote = 'No runs yet';
  if (best) bestNote = best.scope === 'week' ? 'this week' : best.rank ? `#${best.rank} all time` : 'all time';
  let weekNote = 'Run to join';
  if (data && !data.ranked) weekNote = 'Not ranked';
  else if (week?.me) weekNote = `of ${week.total}${week.complete ? '' : '+'}`;
  return (
    <div className="pd-records" data-loading={loading || undefined}>
      <div className="pd-record" data-kind="best">
        <span><Star size={10} fill="currentColor" />YOUR BEST</span>
        <strong>{best ? fmt(best.score) : '—'}</strong>
        <small>{loading ? ' ' : bestNote}</small>
      </div>
      <div className="pd-record" data-kind="week">
        <span><Trophy size={10} />THIS WEEK</span>
        <strong>{week?.me?.rank ? `#${week.me.rank}` : '—'}</strong>
        <small>{loading ? ' ' : weekNote}</small>
      </div>
      <div className="pd-record" data-kind="record">
        <span><Crown size={10} />{record?.scope === 'week' ? 'WEEK RECORD' : 'GAME RECORD'}</span>
        <strong>{record ? fmt(record.score) : '—'}</strong>
        <small>{loading ? ' ' : !record ? 'Be the first!' : record.isMe ? 'That’s you!' : shortName(record.name)}</small>
      </div>
    </div>
  );
};
RecordTiles.propTypes = { data: PropTypes.object, loading: PropTypes.bool };

// One line above the start button: who to beat next on this week's board.
const TargetLine = ({ data }) => {
  if (!data) return <p className="pd-target" aria-hidden="true" />;
  const { week, ranked } = data;
  if (!ranked) {
    return week.target
      ? <p className="pd-target"><Trophy size={14} /><span>Top this week: <strong>{fmt(week.target.score)}</strong> · {shortName(week.target.name)}</span></p>
      : <p className="pd-target"><Trophy size={14} /><span>No runs yet this week</span></p>;
  }
  if (week.me?.rank === 1) {
    let text = <>You’re <strong>#1</strong> this week. Defend it!</>;
    if (week.lead > 0) text = <>You lead the week by <strong>{fmt(week.lead)}</strong></>;
    else if (week.lead === 0) text = <>Tied for <strong>#1</strong>. One more point takes it!</>;
    return <p className="pd-target" data-tone="lead"><Crown size={14} /><span>{text}</span></p>;
  }
  if (week.target) {
    return (
      <p className="pd-target">
        <Target size={14} />
        <span>Score to beat: <strong>{fmt(week.target.score)}</strong> · {shortName(week.target.name)} <b>#{week.target.rank}</b></span>
      </p>
    );
  }
  return <p className="pd-target"><Sparkles size={14} /><span>Be the first runner this week!</span></p>;
};
TargetLine.propTypes = { data: PropTypes.object };

const TABS = [
  { id: 'week', label: 'This week', Icon: Trophy },
  { id: 'all', label: 'All time', Icon: Crown },
  { id: 'rules', label: 'How to play', Icon: HelpCircle },
];

const PetDashLobby = ({ records, rules }) => {
  const { status, data, reload } = records;
  const loading = !data && status !== 'error';
  // Before the board loads the All time tab is assumed; it goes away when the records table is not there yet.
  const tabs = TABS.filter(tab => tab.id !== 'all' || !data || data.allTime);
  const [tab, setTab] = useState(() => (data?.newPlayer ? 'rules' : 'week'));
  const touchedRef = useRef(false);
  const decidedRef = useRef(Boolean(data));

  // A player who has never finished a run starts on How to play, unless they already picked a tab.
  useEffect(() => {
    if (decidedRef.current || !data) return;
    decidedRef.current = true;
    if (!touchedRef.current && data.newPlayer) setTab('rules');
  }, [data]);
  const current = tabs.some(t => t.id === tab) ? tab : 'week';

  const pick = id => {
    touchedRef.current = true;
    setTab(id);
  };
  const onTabKey = event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = tabs.findIndex(t => t.id === current);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    pick(next.id);
    event.currentTarget.querySelector(`#pd-tab-${next.id}`)?.focus();
  };

  let panel;
  if (current === 'rules') panel = <div className="pd-board-rules">{rules}</div>;
  else if (!data && status === 'error') {
    panel = (
      <div className="pd-board-empty" role="alert">
        <span>Couldn’t load the leaderboard.</span>
        <button type="button" className="pd-board-retry" onClick={reload}><RefreshCw size={14} />Try again</button>
      </div>
    );
  } else if (!data) panel = <ol className="pd-board-list" aria-busy="true" aria-label="Loading the leaderboard"><SkeletonRows count={4} /></ol>;
  else if (current === 'all') panel = <BoardList board={data.allTime} label="All-time records" emptyText="No records yet. Set the first one!" />;
  else panel = <BoardList board={data.week} label="Top runners this week" emptyText="No runs this week yet. Be the first on the board!" />;

  const week = data?.week;
  let foot = null;
  if (current === 'week' && week) {
    foot = (
      <p className="pd-board-foot">
        <Clock size={11} />New week in {untilReset(week.resetsAt - Date.now())}
        {week.total > 0 && <> · {week.total}{week.complete ? '' : '+'} {week.total === 1 ? 'runner' : 'runners'}</>}
      </p>
    );
  } else if (current === 'all' && data?.allTime?.total > 0) {
    foot = <p className="pd-board-foot"><Crown size={11} />Best run of each student, ever · {data.allTime.total} {data.allTime.total === 1 ? 'student' : 'students'}</p>;
  }

  return (
    <div className="pd-lobby">
      <RecordTiles data={data} loading={loading} />
      <div className="pd-tabs" role="tablist" aria-label="Pet Dash board" onKeyDown={onTabKey}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`pd-tab-${id}`}
            type="button"
            role="tab"
            className="pd-tab"
            aria-selected={current === id}
            aria-controls="pd-board-panel"
            tabIndex={current === id ? 0 : -1}
            onClick={() => pick(id)}
          ><Icon size={13} />{label}</button>
        ))}
      </div>
      <div className="pd-board-panel" id="pd-board-panel" role="tabpanel" aria-labelledby={`pd-tab-${current}`} data-tab={current}>
        {panel}
        {foot}
      </div>
      <TargetLine data={data} />
    </div>
  );
};

PetDashLobby.propTypes = {
  records: PropTypes.shape({
    status: PropTypes.string.isRequired,
    data: PropTypes.object,
    reload: PropTypes.func.isRequired,
  }).isRequired,
  rules: PropTypes.node.isRequired,
};

export default PetDashLobby;
