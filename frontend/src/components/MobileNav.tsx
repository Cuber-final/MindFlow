import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/daily-digest', label: 'Daily Digest', icon: 'auto_awesome' },
  { path: '/now', label: 'Now', icon: 'dashboard_customize' },
  { path: '/interests', label: 'Interests', icon: 'label_important' },
  { path: '/sources', label: 'Sources', icon: 'rss_feed' },
  { path: '/settings', label: 'Settings', icon: 'settings_suggest' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-outline-variant/10 px-6 py-3 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`
              flex flex-col items-center gap-1 transition-colors
              ${isActive ? 'text-primary' : 'text-secondary'}
            `}
          >
            <span className={`
              material-symbols-outlined text-xl
              ${isActive ? 'font-variation-settings: \'FILL\' 1' : ''}
            `} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
              {item.icon}
            </span>
            <span className={`
              text-[9px] font-sans uppercase tracking-tighter
              ${isActive ? 'font-bold' : ''}
            `}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
