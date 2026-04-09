import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Article from './pages/Article';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import Newsletter from './pages/Newsletter';
import InterestSettings from './pages/InterestSettings';

function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '资讯流', icon: '📰' },
    { path: '/newsletter', label: '简报', icon: '📮' },
    { path: '/interests', label: '兴趣', icon: '🎯' },
    { path: '/sources', label: '新闻源', icon: '📡' },
    { path: '/settings', label: '设置', icon: '⚙️' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-semibold text-primary-600">AI News Aggregator</h1>
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/article/:id" element={<Article />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/interests" element={<InterestSettings />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
