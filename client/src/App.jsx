import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Planner from './pages/Planner';
import Admin from './pages/Admin';
import ChangePassword from './pages/ChangePassword';

// Tiny hash router (#/, #/tasks, #/planner, #/login, #/register).
function useRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const { user, loading } = useAuth();
  const route = useRoute();

  if (loading) return <div className="center-screen">Loading…</div>;

  if (!user) {
    return <AuthPage mode={route === '/register' ? 'register' : 'login'} />;
  }

  if (user.must_change_password) return <ChangePassword />;

  let page = <Dashboard />;
  if (route === '/tasks') page = <Tasks />;
  else if (route === '/planner') page = <Planner />;
  else if (route === '/admin' && user.role === 'admin') page = <Admin />;

  return (
    <>
      <Navbar route={route} />
      <main className="container">{page}</main>
    </>
  );
}
