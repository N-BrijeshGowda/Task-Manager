import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { monthKey, todayISO } from '../utils/dates';
import Calendar from '../components/Calendar';
import DayPanel from '../components/DayPanel';

export default function Dashboard() {
  const { stats, refreshStats } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [days, setDays] = useState({});
  const [selected, setSelected] = useState(todayISO());

  const loadMonth = useCallback(async () => {
    try {
      const { data } = await api.get('/calendar', { params: { month: monthKey(view.year, view.month) } });
      setDays(data.days);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [view, toast]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const changed = () => {
    loadMonth();
    refreshStats();
  };

  const shift = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const goToday = () => {
    const t = new Date();
    setView({ year: t.getFullYear(), month: t.getMonth() });
    setSelected(todayISO());
  };

  const select = (date) => {
    setSelected(date);
    const [y, m] = date.split('-').map(Number);
    if (y !== view.year || m - 1 !== view.month) setView({ year: y, month: m - 1 });
  };

  return (
    <>
      {stats && (
        <div className="stats">
          <div className="stat"><b>{stats.streak}</b><span>day streak</span></div>
          <div className="stat"><b>{stats.doneToday}</b><span>done today</span></div>
          <div className="stat"><b>{stats.doneThisWeek}</b><span>done this week</span></div>
          <a className={`stat ${stats.overdue ? 'stat-alert' : ''}`} href="#/planner">
            <b>{stats.overdue}</b><span>overdue planned</span>
          </a>
        </div>
      )}
      <div className="dashboard">
        <Calendar
          year={view.year}
          month={view.month}
          days={days}
          selected={selected}
          onSelect={select}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          onToday={goToday}
        />
        <DayPanel date={selected} info={days[selected]} onChanged={changed} />
      </div>
    </>
  );
}
