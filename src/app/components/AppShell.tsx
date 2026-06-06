import { useState, useEffect } from 'react';
import { getActivePeriod, type ActivePeriodDto } from '../lib/api/document-upload';
import { ProfileSettings } from './ProfileSettings';
import { Badge } from './ui/badge';
import {
  Bell,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  FileText,
  List,
  Eye,
  Settings,
  BarChart3,
  Menu,
  X,
  User as UserIcon,
  RefreshCw,
  Check,
  Info,
  AlertTriangle,
  CheckCircle,
  Inbox
} from 'lucide-react';
import type { User, UserRole } from '../App';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

const MOCK_NOTIFICATIONS: Record<UserRole, Notification[]> = {
  Student: [
    { id: '1', title: 'Başvuru Güncellendi', message: 'Yatay geçiş başvurunuz ön inceleme aşamasına geçti.', time: '5 dk önce', read: false, type: 'info' },
    { id: '2', title: 'Belge Onaylandı', message: 'Yüklediğiniz transkript belgesi onaylandı.', time: '2 saat önce', read: false, type: 'success' },
    { id: '3', title: 'Eksik Belge', message: 'Başvurunuz için dil yeterlilik belgesi gereklidir.', time: '1 gün önce', read: true, type: 'warning' },
  ],
  OIDB: [
    { id: '1', title: 'Yeni Başvuru', message: '3 yeni yatay geçiş başvurusu inceleme bekliyor.', time: '10 dk önce', read: false, type: 'info' },
    { id: '2', title: 'İtiraz Alındı', message: 'Ahmet Yılmaz başvuru sonucuna itiraz etti.', time: '1 saat önce', read: false, type: 'warning' },
    { id: '3', title: 'Dönem Hatırlatma', message: 'Başvuru değerlendirme süresi 3 gün sonra sona eriyor.', time: '3 saat önce', read: true, type: 'warning' },
  ],
  YDYO: [
    { id: '1', title: 'Dil Değerlendirmesi', message: '2 yeni dil yeterlilik değerlendirmesi bekliyor.', time: '15 dk önce', read: false, type: 'info' },
    { id: '2', title: 'Değerlendirme Tamamlandı', message: 'Fatma Şahin dil değerlendirmesi tamamlandı.', time: '4 saat önce', read: true, type: 'success' },
  ],
  YGK: [
    { id: '1', title: 'Yeni Paket', message: 'OIDB\'den 5 başvuruluk yeni değerlendirme paketi geldi.', time: '30 dk önce', read: false, type: 'info' },
    { id: '2', title: 'İntibak Onayı', message: 'Bilgisayar Mühendisliği intibak tablosu onaylandı.', time: '2 saat önce', read: false, type: 'success' },
    { id: '3', title: 'Sıralama Güncellendi', message: 'Elektrik-Elektronik bölümü sıralaması güncellendi.', time: '1 gün önce', read: true, type: 'info' },
  ],
  Dean: [
    { id: '1', title: 'Onay Bekliyor', message: '2 aday paketi dekanlık onayı bekliyor.', time: '1 saat önce', read: false, type: 'info' },
    { id: '2', title: 'Kurul Bildirimi', message: 'Yönetim kurulu toplantısı 15 Ocak\'ta planlandı.', time: '5 saat önce', read: true, type: 'info' },
  ],
  Board: [
    { id: '1', title: 'Nihai Onay', message: '1 aday paketi nihai kurul onayı bekliyor.', time: '2 saat önce', read: false, type: 'info' },
    { id: '2', title: 'Karar Kaydedildi', message: 'Önceki toplantı kararları sisteme işlendi.', time: '1 gün önce', read: true, type: 'success' },
  ],
  Admin: [
    { id: '1', title: 'Sistem Uyarısı', message: 'YÖKSİS entegrasyonunda bağlantı zaman aşımı tespit edildi.', time: '5 dk önce', read: false, type: 'warning' },
    { id: '2', title: 'Yeni Kullanıcı', message: '2 yeni personel hesabı oluşturuldu.', time: '3 saat önce', read: false, type: 'info' },
    { id: '3', title: 'Yedekleme Tamamlandı', message: 'Günlük veritabanı yedeği başarıyla alındı.', time: '6 saat önce', read: true, type: 'success' },
  ],
};

interface AppShellProps {
  user: User;
  currentRole: UserRole;
  onLogout: () => void;
  onSwitchRole?: () => void;
  children: React.ReactNode;
  currentSection?: string;
  onNavigate?: (section: string) => void;
}

const NAVIGATION_ITEMS: Record<UserRole, { icon: React.ElementType; label: string; section: string }[]> = {
  Student: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' }
  ],
  OIDB: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' },
    { icon: List, label: 'Süreç Takibi', section: 'pipeline' },
    { icon: Eye, label: 'İtirazlar', section: 'appeals' }
  ],
  YDYO: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' }
  ],
  YGK: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' },
    { icon: Inbox, label: 'İnceleme Kuyruğu', section: 'queue' },
    { icon: BarChart3, label: 'Sıralama', section: 'rankings' },
    { icon: FileText, label: 'İntibak', section: 'intibak' }
  ],
  Dean: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' },
    { icon: Inbox, label: 'İnceleme Kuyruğu', section: 'queue' },
  ],
  Board: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' }
  ],
  Admin: [
    { icon: LayoutDashboard, label: 'Panel', section: 'dashboard' },
    { icon: Eye, label: 'Entegrasyonlar', section: 'integrations' }
  ]
};

export function AppShell({ 
  user, 
  currentRole, 
  onLogout, 
  onSwitchRole, 
  children,
  currentSection = 'dashboard',
  onNavigate
}: AppShellProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS[currentRole] || []);
  const [activePeriod, setActivePeriod] = useState<ActivePeriodDto | null>(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(`${user.name} ${user.surname}`);
  const [localEmail, setLocalEmail] = useState(user.email);

  useEffect(() => {
    getActivePeriod().then(setActivePeriod).catch(() => {});
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const navigationItems = NAVIGATION_ITEMS[currentRole] || [];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden z-40`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 shadow-md transform -rotate-3"
            style={{ backgroundColor: '#C00000' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-bold text-gray-900 truncate uppercase tracking-tighter">Transfer Portal</div>
              <div className="text-[10px] font-bold text-[#C00000] uppercase tracking-widest leading-none">{currentRole}</div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 overflow-y-auto space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.section;
            return (
              <button
                key={item.section}
                onClick={() => onNavigate?.(item.section)}
                className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-all group ${
                  isActive 
                    ? 'bg-red-50 text-[#C00000] border-r-4 border-[#C00000]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? '' : 'text-gray-400 group-hover:text-[#C00000]'}`} />
                {sidebarOpen && <span className="ml-3 truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Period Info */}
        {sidebarOpen && (
          <div className="p-4 m-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aktif Dönem</div>
            {activePeriod ? (
              <>
                <div className="text-xs font-bold text-gray-900">{activePeriod.name}</div>
                <div className="text-[10px] text-red-600 font-medium mt-1">
                  Bitiş: {new Date(activePeriod.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-400">Dönem bilgisi yüklenemedi</div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 sticky top-0 z-30">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          {/* Quick Stats or Search could go here */}

          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                className="relative p-2 text-gray-400 hover:text-[#C00000] hover:bg-red-50 rounded-lg transition-all"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C00000] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-900">Bildirimler</div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[10px] font-bold text-[#C00000] hover:text-[#900000] uppercase tracking-wider transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Tümünü Oku
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-400">Bildirim bulunmuyor.</div>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => markAsRead(notif.id)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${
                              !notif.read ? 'bg-red-50/40' : ''
                            }`}
                          >
                            <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold truncate ${!notif.read ? 'text-gray-900' : 'text-gray-500'}`}>{notif.title}</span>
                                {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-[#C00000] shrink-0" />}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[10px] text-gray-400 mt-1 block">{notif.time}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-1.5 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md transform rotate-3" style={{ backgroundColor: '#C00000' }}>
                  {localDisplayName[0]?.toUpperCase()}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-gray-900 leading-none">{localDisplayName}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{currentRole}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-bold text-gray-900">{localDisplayName}</div>
                      <div className="text-xs font-medium text-gray-500 truncate">{localEmail}</div>
                      <Badge className="mt-2 text-[10px] font-bold uppercase tracking-wider border-none bg-red-50 text-[#C00000]">
                        {currentRole}
                      </Badge>
                    </div>

                    <div className="p-1">
                      {onSwitchRole && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onSwitchRole();
                          }}
                          className="w-full text-left px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-[#C00000] rounded-lg transition-colors flex items-center"
                        >
                          <RefreshCw className="w-4 h-4 mr-2 opacity-70" />
                          Rol Değiştir
                        </button>
                      )}
                      <button
                        onClick={() => { setShowUserMenu(false); setShowProfileSettings(true); }}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center"
                      >
                        <UserIcon className="w-4 h-4 mr-2 opacity-70" />
                        Profil Ayarları
                      </button>
                    </div>

                    <div className="p-1 mt-1 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Güvenli Çıkış
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {showProfileSettings && (
        <ProfileSettings
          user={user}
          onClose={() => setShowProfileSettings(false)}
          onProfileUpdated={(name, email) => {
            setLocalDisplayName(name);
            setLocalEmail(email);
          }}
        />
      )}
    </div>
  );
}
