import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/daily-digest', label: 'Daily Digest', icon: 'auto_awesome' },
  { path: '/now', label: 'Now', icon: 'dashboard_customize' },
  { path: '/interests', label: 'Interests', icon: 'label_important' },
  { path: '/sources', label: 'Sources', icon: 'rss_feed' },
  { path: '/settings', label: 'Settings', icon: 'settings_suggest' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 border-r border-outline-variant/15 bg-surface-container-low py-8 px-4 fixed left-0 top-0 overflow-y-auto">
      {/* Logo */}
      <div className="mb-12 px-2">
        <Link to="/" className="block">
          <h1 className="font-serif italic text-xl text-on-surface hover:text-primary transition-colors">MindFlow</h1>
          <p className="text-[11px] font-sans uppercase tracking-widest text-secondary mt-1">Curated Daily Brief</p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg transition-transform nav-item
                ${isActive
                  ? 'bg-surface-container-highest text-primary font-bold'
                  : 'text-secondary hover:bg-surface-container-high hover:text-on-surface'
                }
              `}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[11px] font-sans uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New Insight Button */}
      <div className="mt-8 px-2">
        <button className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary py-3 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-sm">edit</span>
          New Insight
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-8 border-t border-outline-variant/10 flex flex-col gap-2">
        <Link
          to="/help"
          className="flex items-center gap-3 px-3 py-1 text-secondary text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">help_outline</span>
          Help
        </Link>
        <Link
          to="/privacy"
          className="flex items-center gap-3 px-3 py-1 text-secondary text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">policy</span>
          Privacy
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 mt-4">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-sm">person</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate">User</p>
            <p className="text-[10px] text-secondary truncate">Curator Tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
