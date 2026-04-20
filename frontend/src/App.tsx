import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import MobileNav from './components/MobileNav';
import Sources from './pages/Sources';
import Settings from './pages/Settings';
import Newsletter from './pages/Newsletter';
import InterestSettings from './pages/InterestSettings';
import Now from './pages/Now';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="lg:ml-64">
          {/* Top Navigation */}
          <TopNav />

          {/* Page Content */}
          <main className="max-w-screen-2xl mx-auto w-full px-8 py-12">
            <Routes>
              <Route path="/" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/newsletter" element={<Navigate to="/daily-digest" replace />} />
              <Route path="/daily-digest" element={<Newsletter />} />
              <Route path="/now" element={<Now />} />
              <Route path="/now/:anchorId" element={<Now />} />
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
