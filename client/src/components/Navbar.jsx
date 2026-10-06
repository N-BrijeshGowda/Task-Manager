import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Calendar' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/planner', label: 'Planner' },
];

export default function Navbar({ route }) {
  const { user, stats, logout, toggleTheme } = useAuth();
  const dark = user?.theme === 'dark';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a className="brand" href="#/">Daily Task Tracker</a>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <a key={l.to} href={`#${l.to}`} className={route === l.to ? 'active' : ''}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-right">
          {stats && (
            <span className="streak" title="Consecutive days with a completed task">
              🔥 {stats.streak} day{stats.streak === 1 ? '' : 's'}
            </span>
          )}
          <button className="btn btn-ghost" onClick={toggleTheme} aria-label="Toggle dark mode">
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
          <span className="user-name">{user?.name}</span>
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
