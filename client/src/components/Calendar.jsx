import { fromISO, monthKey, toISO, todayISO } from '../utils/dates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Builds the grid cells (Monday first) for a month.
function buildCells(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(toISO(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function cellClass(date, info, today, selected) {
  const dow = fromISO(date).getDay();
  const classes = ['day'];
  if (info?.type === 'holiday') classes.push('day-holiday');
  else if (info?.type === 'leave') classes.push('day-leave');
  else if (info?.count > 0) classes.push('day-done');
  else if (dow === 0 || (dow === 6 && info?.type !== 'working_saturday')) classes.push('day-off');
  if (date === today) classes.push('day-today');
  if (date === selected) classes.push('day-selected');
  return classes.join(' ');
}

export default function Calendar({ year, month, days, selected, onSelect, onPrev, onNext, onToday }) {
  const today = todayISO();
  const cells = buildCells(year, month);
  const title = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="card calendar">
      <div className="calendar-head">
        <button className="btn btn-ghost" onClick={onPrev} aria-label="Previous month">‹</button>
        <h2>{title}</h2>
        <button className="btn btn-ghost" onClick={onNext} aria-label="Next month">›</button>
        <button className="btn btn-small" onClick={onToday}>Today</button>
      </div>

      <div className="calendar-grid" data-month={monthKey(year, month)}>
        {WEEKDAYS.map((w) => <div key={w} className="weekday">{w}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} className="day day-blank" />;
          const info = days[date];
          const tip = [
            info?.count ? `${info.count} task${info.count === 1 ? '' : 's'} done` : '',
            info?.type === 'holiday' ? `Holiday${info.note ? `: ${info.note}` : ''}` : '',
            info?.type === 'leave' ? `Leave${info.note ? `: ${info.note}` : ''}` : '',
            info?.type === 'working_saturday' ? 'Working Saturday' : '',
            info?.overdue ? 'Overdue planned items' : '',
          ].filter(Boolean).join(' • ');
          const markers = info?.type === 'holiday' || info?.type === 'leave';
          return (
            <button
              key={date}
              className={cellClass(date, info, today, selected)}
              onClick={() => onSelect(date)}
              title={tip || undefined}
            >
              <span className="day-num">{Number(date.slice(8))}</span>
              {info?.type === 'working_saturday' && <span className="badge-w">W</span>}
              <span className="dots">
                {markers && info.count > 0 && <i className="dot dot-green" />}
                {info?.overdue && <i className="dot dot-red" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span><i className="swatch sw-done" /> Tasks completed</span>
        <span><i className="swatch sw-holiday" /> Holiday</span>
        <span><i className="swatch sw-leave" /> Leave</span>
        <span><i className="swatch sw-off" /> Weekend off</span>
        <span><b className="badge-w static">W</b> Working Saturday</span>
        <span><i className="dot dot-red" /> Overdue planned</span>
      </div>
    </div>
  );
}
