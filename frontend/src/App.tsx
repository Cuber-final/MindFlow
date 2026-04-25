import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import MobileNav from './components/MobileNav';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import Newsletter from './pages/Newsletter';
import InterestSettings from './pages/InterestSettings';
import Now from './pages/Now';
import Articles from './pages/Articles';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="lg:ml-64">
          {/* Top Navigation */}
          <TopNav />

          {/* Page Content */}
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10">
            <Routes>
              <Route path="/" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/newsletter" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/daily-digest" element={<Newsletter />} />
              <Route path="/now" element={<Now />} />
              <Route path="/now/:anchorId" element={<Now />} />
              <Route path="/articles" element={<Articles />} />
              <Route path="/articles/:articleId" element={<Articles />} />
              <Route path="/interests" element={<InterestSettings />} />
              <Route path="/sources" element={<Sources />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </BrowserRouter>
  );
}
