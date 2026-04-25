import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const navItems = [
    { path: '/daily-digest', label: t('nav.dailyDigest') },
    { path: '/now', label: t('nav.now') },
    { path: '/articles', label: t('nav.articles') },
    { path: '/interests', label: t('nav.interests') },
    { path: '/sources', label: t('nav.sources') },
    { path: '/settings', label: t('nav.settings') },
  ];

  useEffect(() => {
    if (location.pathname.startsWith('/articles')) {
      setSearchTerm(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      navigate('/articles');
      return;
    }

    const params = new URLSearchParams();
    params.set('q', trimmed);
    navigate(`/articles?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-transparent">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 xl:px-10">
        {/* Brand */}
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/" className="font-serif italic text-2xl text-on-surface hover:text-primary transition-colors lg:hidden">
            MindFlow
          </Link>
          <nav className="hidden md:flex gap-4 lg:gap-6">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    text-sm font-sans transition-colors
                    ${isActive
                      ? 'text-primary font-bold border-b-2 border-primary pb-1'
                      : 'text-secondary hover:text-primary'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
          {/* Search (hidden on mobile) */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:block relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="w-[clamp(11rem,23vw,16rem)] rounded-lg border-none bg-surface-container-lowest py-2 pl-10 pr-4 text-sm ring-1 ring-outline/10 transition-all outline-none focus:ring-primary/20"
            />
          </form>

          <div className="inline-flex items-center gap-1 rounded-full border border-[#c0c8cb]/20 bg-white/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setLocale('zh-CN')}
              className={`rounded-full px-2 py-1 transition-colors ${locale === 'zh-CN' ? 'bg-[#0d4656] text-white' : 'text-[#40484b]'}`}
              aria-label={t('common.chinese')}
              title={t('common.chinese')}
            >
              中
            </button>
            <button
              type="button"
              onClick={() => setLocale('en-US')}
              className={`rounded-full px-2 py-1 transition-colors ${locale === 'en-US' ? 'bg-[#0d4656] text-white' : 'text-[#40484b]'}`}
              aria-label={t('common.english')}
              title={t('common.english')}
            >
              EN
            </button>
          </div>

          {/* User avatar */}
          <button className="material-symbols-outlined text-primary text-3xl hover:scale-95 transition-transform">
            account_circle
          </button>
        </div>
      </div>
    </header>
  );
}
