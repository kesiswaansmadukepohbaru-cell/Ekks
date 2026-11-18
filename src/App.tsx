import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  X,
} from 'lucide-react';
import { apiFetch, getAuthToken, setAuthToken } from './lib/api';
import {
  ROLE_LABELS,
  type Announcement,
  type AuthUser,
  type GalleryItem,
  type GtkStaff,
  type SchoolProfile,
} from './types';
import { SchoolProfileView } from './components/SchoolProfileView';
import { LoginModal } from './components/LoginModal';
import { DashboardHome } from './components/DashboardHome';
import { AcademicModule } from './components/AcademicModule';
import { ArchiveModule } from './components/ArchiveModule';
import { SupervisionModule } from './components/SupervisionModule';
import { AdminModule } from './components/AdminModule';
import { MediaManagerModule } from './components/MediaManagerModule';

type PortalTab = 'dashboard' | 'academic' | 'archive' | 'supervision' | 'media' | 'admin';

export default function App() {
  const [view, setView] = useState<'public' | 'portal'>('public');
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [publicGtk, setPublicGtk] = useState<GtkStaff[]>([]);
  const [publicAnnouncements, setPublicAnnouncements] = useState<Announcement[]>([]);
  const [publicGallery, setPublicGallery] = useState<GalleryItem[]>([]);
  const [publicStats, setPublicStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalStaff: 0,
    totalClasses: 0,
  });

  const loadPublicProfile = useCallback(async () => {
    try {
      const res = await apiFetch<{
        profile: SchoolProfile;
        gtk: GtkStaff[];
        announcements: Announcement[];
        gallery: GalleryItem[];
        stats: { totalStudents: number; totalTeachers: number; totalStaff: number; totalClasses: number };
      }>('/api/public/profile');
      setProfile(res.profile);
      setPublicGtk(res.gtk);
      setPublicAnnouncements(res.announcements);
      setPublicGallery(res.gallery);
      setPublicStats(res.stats);
    } catch {
      // ignore initial error
    }
  }, []);

  useEffect(() => {
    loadPublicProfile();
    const token = getAuthToken();
    if (token) {
      apiFetch<{ user: AuthUser }>('/api/auth/me')
        .then((res) => {
          setCurrentUser(res.user);
        })
        .catch(() => {
          setAuthToken(null);
        });
    }
  }, [loadPublicProfile]);

  const navItems = useMemo(() => {
    if (!currentUser) return [];
    const items: { id: PortalTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      {
        id: 'academic',
        label: currentUser.role === 'ORANG_TUA' ? 'Akademik Anak' : 'Akademik & Siswa',
        icon: GraduationCap,
      },
    ];
    if (currentUser.role !== 'ORANG_TUA') {
      items.push({ id: 'archive', label: 'Arsip Digital', icon: Archive });
      items.push({ id: 'supervision', label: 'Supervisi Digital', icon: ClipboardCheck });
    }
    if (
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'KEPALA_SEKOLAH' ||
      currentUser.role === 'STAF'
    ) {
      items.push({ id: 'media', label: 'Kelola Gambar', icon: ImageIcon });
    }
    if (currentUser.role === 'ADMIN' || currentUser.role === 'KEPALA_SEKOLAH') {
      items.push({ id: 'admin', label: 'Admin & Keamanan', icon: Shield });
    }
    return items;
  }, [currentUser]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setView('portal');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setView('public');
    setMobileMenuOpen(false);
  };

  if (view === 'public' || !currentUser) {
    return (
      <>
        <SchoolProfileView
          profile={profile}
          gtk={publicGtk}
          announcements={publicAnnouncements}
          gallery={publicGallery}
          stats={publicStats}
          currentUser={currentUser}
          onOpenLogin={() => setLoginModalOpen(true)}
          onEnterPortal={() => {
            setActiveTab('dashboard');
            setView('portal');
          }}
        />
        <LoginModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onSuccess={handleLoginSuccess}
        />
      </>
    );
  }

  const currentTabLabel = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <span className="text-sm font-bold text-slate-900 font-display tracking-tight truncate">
            SIMS SMA Darul Ulum
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-900 truncate">{currentUser.fullName}</p>
            <p className="text-xs text-emerald-700 font-medium">{ROLE_LABELS[currentUser.role]}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('public')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Globe className="w-3.5 h-3.5" /> Web Sekolah
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900 font-display">SIMS SMA Darul Ulum</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-900">{currentUser.fullName}</p>
                <p className="text-xs text-emerald-700">{ROLE_LABELS[currentUser.role]}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('public');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 text-xs font-medium border border-slate-200 rounded-lg"
                >
                  Web Sekolah
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg"
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate">
              <span>SMA Darul Ulum Kepohbaru</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="font-semibold text-slate-900">{currentTabLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setView('public')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5" /> Profil Sekolah
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardHome
              user={currentUser}
              onNavigate={(tab) => setActiveTab(tab as PortalTab)}
            />
          )}
          {activeTab === 'academic' && <AcademicModule user={currentUser} />}
          {activeTab === 'archive' && currentUser.role !== 'ORANG_TUA' && (
            <ArchiveModule user={currentUser} />
          )}
          {activeTab === 'supervision' && currentUser.role !== 'ORANG_TUA' && (
            <SupervisionModule user={currentUser} />
          )}
          {activeTab === 'media' &&
            (currentUser.role === 'ADMIN' ||
              currentUser.role === 'KEPALA_SEKOLAH' ||
              currentUser.role === 'STAF') && (
              <MediaManagerModule onRefreshPublicProfile={loadPublicProfile} />
            )}
          {activeTab === 'admin' &&
            (currentUser.role === 'ADMIN' || currentUser.role === 'KEPALA_SEKOLAH') && (
              <AdminModule user={currentUser} onRefreshPublicProfile={loadPublicProfile} />
            )}
        </main>
      </div>
    </div>
  );
}
