import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function Sidebar() {
  const location = useLocation();
  const { t } = useI18n();
  const navItems = [
    { path: '/daily-digest', label: t('nav.dailyDigest'), icon: 'auto_awesome' },
    { path: '/now', label: t('nav.now'), icon: 'dashboard_customize' },
    { path: '/articles', label: t('nav.articles'), icon: 'article' },
    { path: '/interests', label: t('nav.interests'), icon: 'label_important' },
    { path: '/sources', label: t('nav.sources'), icon: 'rss_feed' },
    { path: '/settings', label: t('nav.settings'), icon: 'settings_suggest' },
  ];

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 border-r border-outline-variant/15 bg-surface-container-low py-8 px-4 fixed left-0 top-0 overflow-y-auto">
      {/* Logo */}
      <div className="mb-12 px-2">
        <Link to="/" className="block">
          <h1 className="font-serif italic text-xl text-on-surface hover:text-primary transition-colors">{t('common.logo')}</h1>
          <p className="text-[11px] font-sans uppercase tracking-widest text-secondary mt-1">{t('nav.curatedBrief')}</p>
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

      {/* Footer */}
      <div className="mt-8 pt-8 border-t border-outline-variant/10 flex flex-col gap-2">
        <Link
          to="/help"
          className="flex items-center gap-3 px-3 py-1 text-secondary text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">help_outline</span>
          {t('nav.help')}
        </Link>
        <Link
          to="/privacy"
          className="flex items-center gap-3 px-3 py-1 text-secondary text-[11px] uppercase tracking-widest hover:translate-x-1 transition-transform"
        >
          <span className="material-symbols-outlined text-sm">policy</span>
          {t('nav.privacy')}
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 mt-4">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-sm">person</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate">{t('nav.user')}</p>
            <p className="text-[10px] text-secondary truncate">{t('nav.curatorTier')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
