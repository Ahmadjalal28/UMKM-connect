import React, { useState, useEffect, useRef } from 'react';
import { 
  Store, User, Mail, Lock, LogOut, CheckCircle2, AlertCircle, Loader2, 
  LayoutDashboard, ShoppingBag, Briefcase, Calculator, PieChart, MessageSquare, 
  Search, FileText, Send, Plus, X, MapPin, DollarSign, Target, TrendingUp, Check, 
  Settings, Filter, Star
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// --- Konfigurasi Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'umkm-karir-app';
const apiKey = ""; // API Key Gemini

// --- UTILS ---
const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

export default function App() {
  const [systemUser, setSystemUser] = useState(null);
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  
  const [activeAccount, setActiveAccount] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // 1. Inisialisasi Auth Sistem (Wajib untuk Firebase Rules)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setSystemUser(u);
      setIsSystemLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Sesi Akun (Remember Me)
  useEffect(() => {
    if (!systemUser) return;
    const loadSession = async () => {
      try {
        setIsSessionLoading(true);
        const sessionRef = doc(db, 'artifacts', appId, 'users', systemUser.uid, 'auth_session', 'current');
        const sessionSnap = await getDoc(sessionRef);

        if (sessionSnap.exists() && sessionSnap.data().accountId) {
          const accountId = sessionSnap.data().accountId;
          const accountRef = doc(db, 'artifacts', appId, 'users', systemUser.uid, 'registered_accounts', accountId);
          const accountSnap = await getDoc(accountRef);
          if (accountSnap.exists()) {
            setActiveAccount({ id: accountSnap.id, ...accountSnap.data() });
          }
        }
      } catch (e) {
        console.error("Gagal load sesi:", e);
      } finally {
        setIsSessionLoading(false);
      }
    };
    loadSession();
  }, [systemUser]);

  const saveSession = async (accountId) => {
    if (!systemUser) return;
    const sessionRef = doc(db, 'artifacts', appId, 'users', systemUser.uid, 'auth_session', 'current');
    await setDoc(sessionRef, { accountId });
  };

  const handleLogout = async () => {
    if (!systemUser) return;
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'users', systemUser.uid, 'auth_session', 'current');
      await deleteDoc(sessionRef);
      setActiveAccount(null);
    } catch (e) {
      console.error("Gagal logout:", e);
    }
  };

  if (isSystemLoading || isSessionLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-indigo-600">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold">Menyiapkan Ruang Kerja...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {activeAccount ? (
        <MainDashboard 
          systemUser={systemUser}
          account={activeAccount} 
          setAccount={setActiveAccount}
          onLogout={handleLogout} 
        />
      ) : (
        <AuthScreen 
          systemUser={systemUser} 
          onLoginSuccess={(account) => {
            setActiveAccount(account);
            saveSession(account.id);
          }} 
        />
      )}
    </div>
  );
}


function AuthScreen({ systemUser, onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'seeker', storeName: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!systemUser) return;
    setIsLoading(true); setErrorMsg('');

    try {
      const accountsRef = collection(db, 'artifacts', appId, 'users', systemUser.uid, 'registered_accounts');
      const accountsSnap = await getDocs(accountsRef);
      const allAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (mode === 'register') {
        if (allAccounts.find(acc => acc.email === formData.email)) {
          setErrorMsg('Email sudah terdaftar.'); setIsLoading(false); return;
        }

        const newAccountData = {
          name: formData.name, email: formData.email, password: formData.password, 
          role: formData.role, storeName: formData.role === 'umkm' ? formData.storeName : null,
          createdAt: new Date().toISOString(),
          bio: '', location: '', skills: '' // Default profile fields
        };

        const docRef = await addDoc(accountsRef, newAccountData);
        const account = { id: docRef.id, ...newAccountData };
        
      
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_directory', docRef.id), {
          id: docRef.id, name: formData.name, role: formData.role, storeName: newAccountData.storeName
        });

        onLoginSuccess(account);
      } else {
        const matchedAccount = allAccounts.find(acc => acc.email === formData.email && acc.password === formData.password);
        if (matchedAccount) onLoginSuccess(matchedAccount);
        else setErrorMsg('Email atau kata sandi salah!');
      }
    } catch (e) {
      console.error(e); setErrorMsg('Terjadi kesalahan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 flex-col justify-center items-center p-12 relative overflow-hidden text-white">
        <div className="absolute w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-50 -top-20 -left-20"></div>
        <div className="relative z-10 max-w-lg">
          <Store className="w-16 h-16 mb-8 text-indigo-200" />
          <h1 className="text-4xl font-bold mb-4 leading-tight">Hubungkan Talenta dengan UMKM Lokal</h1>
          <p className="text-lg text-indigo-100 mb-8 leading-relaxed">Satu platform untuk mengelola operasional bisnis, menghitung profit dengan AI, dan menemukan pekerjaan terbaik yang sesuai dengan minat Anda.</p>
          <div className="space-y-4">
            <div className="flex items-center"><CheckCircle2 className="mr-3 text-indigo-300"/> Fitur Akuntansi AI UMKM</div>
            <div className="flex items-center"><CheckCircle2 className="mr-3 text-indigo-300"/> Pembuatan Lowongan Instan</div>
            <div className="flex items-center"><CheckCircle2 className="mr-3 text-indigo-300"/> Chat Langsung Pencari Kerja & Bos</div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-800">{mode === 'login' ? 'Masuk ke Akun' : 'Buat Akun Baru'}</h2>
            <p className="text-slate-500 mt-2">{mode === 'login' ? 'Lanjutkan perjalanan karir atau bisnis Anda' : 'Pilih peran Anda dan mulai sekarang'}</p>
          </div>

          {errorMsg && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center text-sm"><AlertCircle className="w-5 h-5 mr-2 shrink-0"/>{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button type="button" onClick={() => setFormData({...formData, role: 'seeker'})} className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${formData.role === 'seeker' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
                  <User className="mb-2"/> <span className="text-sm font-bold">Pencari Kerja</span>
                </button>
                <button type="button" onClick={() => setFormData({...formData, role: 'umkm'})} className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${formData.role === 'umkm' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
                  <Store className="mb-2"/> <span className="text-sm font-bold">Pemilik UMKM</span>
                </button>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Budi Santoso" />
                </div>
                {formData.role === 'umkm' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nama Usaha / Toko</label>
                    <input type="text" name="storeName" required value={formData.storeName} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Toko Kue Budi" />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="email@contoh.com" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kata Sandi</label>
              <input type="password" name="password" required minLength={6} value={formData.password} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center shadow-lg shadow-indigo-200 disabled:opacity-50">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (mode === 'login' ? 'Masuk' : 'Daftar Sekarang')}
            </button>
          </form>

          <p className="text-center mt-8 text-slate-600">
            {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrorMsg(''); }} className="font-bold text-indigo-600 hover:underline">
              {mode === 'login' ? 'Daftar di sini' : 'Masuk'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}


function MainDashboard({ systemUser, account, setAccount, onLogout }) {
  const [currentView, setCurrentView] = useState('dashboard');
  const isUMKM = account.role === 'umkm';

  const menuItemsUMKM = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
    { id: 'strategy', label: 'Kalkulator Bisnis', icon: <Target /> },
    { id: 'accounting', label: 'Akuntansi AI', icon: <PieChart /> },
    { id: 'jobs', label: 'Kelola Lowongan', icon: <Briefcase /> },
    { id: 'chat', label: 'Pesan', icon: <MessageSquare /> },
    { id: 'profile', label: 'Profil UMKM', icon: <Store /> },
  ];

  const menuItemsSeeker = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
    { id: 'find_jobs', label: 'Cari Lowongan', icon: <Search /> },
    { id: 'applications', label: 'Lamaran Saya', icon: <FileText /> },
    { id: 'chat', label: 'Pesan', icon: <MessageSquare /> },
    { id: 'profile', label: 'Profil Pribadi', icon: <User /> },
  ];

  const menu = isUMKM ? menuItemsUMKM : menuItemsSeeker;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-black text-indigo-600 tracking-tight flex items-center">
            <Briefcase className="mr-2"/> JobConnect
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menu.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all font-medium ${
                currentView === item.id 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={`mr-3 ${currentView === item.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                {React.cloneElement(item.icon, { size: 20 })}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={onLogout} className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-bold">
            <LogOut size={20} className="mr-3" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-800 capitalize">
            {menu.find(m => m.id === currentView)?.label || 'Aplikasi'}
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{account.name}</p>
              <p className="text-xs text-slate-500 font-medium">{isUMKM ? account.storeName : 'Pencari Kerja'}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg border-2 border-indigo-200">
              {account.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {currentView === 'dashboard' && <HomeDashboard account={account} isUMKM={isUMKM} setView={setCurrentView} />}
            
            {/* Fitur UMKM */}
            {currentView === 'strategy' && isUMKM && <UMKMStrategy />}
            {currentView === 'accounting' && isUMKM && <UMKMAccounting systemUser={systemUser} account={account} />}
            {currentView === 'jobs' && isUMKM && <UMKMJobManagement systemUser={systemUser} account={account} />}
            {currentView === 'profile' && isUMKM && <ProfileManager systemUser={systemUser} account={account} setAccount={setAccount} />}

            {/* Fitur Seeker */}
            {currentView === 'find_jobs' && !isUMKM && <SeekerJobSearch systemUser={systemUser} account={account} setView={setCurrentView} />}
            {currentView === 'applications' && !isUMKM && <SeekerApplications account={account} />}
            {currentView === 'profile' && !isUMKM && <ProfileManager systemUser={systemUser} account={account} setAccount={setAccount} />}

            {/* Fitur Shared */}
            {currentView === 'chat' && <ChatSystem account={account} />}
          </div>
        </div>
      </main>
    </div>
  );
}


const HomeDashboard = ({ account, isUMKM, setView }) => (
  <div className="space-y-6">
    <div className={`p-8 rounded-3xl text-white shadow-lg bg-gradient-to-br ${isUMKM ? 'from-indigo-600 to-purple-700' : 'from-emerald-500 to-teal-600'}`}>
      <h1 className="text-3xl font-bold mb-2">Selamat datang, {account.name}! 👋</h1>
      <p className="text-lg opacity-90 max-w-2xl">
        {isUMKM 
          ? `Kelola operasional toko "${account.storeName}", hitung profit dengan AI, dan temukan kandidat terbaik untuk bisnis Anda.`
          : 'Lengkapi profil Anda, temukan pekerjaan impian di UMKM lokal, dan kembangkan karir Anda hari ini.'}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {isUMKM ? (
        <>
          <DashboardCard title="Kalkulator Bisnis" icon={<Target/>} color="text-purple-600" bg="bg-purple-50" onClick={() => setView('strategy')} />
          <DashboardCard title="Kelola Lowongan" icon={<Briefcase/>} color="text-indigo-600" bg="bg-indigo-50" onClick={() => setView('jobs')} />
          <DashboardCard title="Buku Kas & AI" icon={<PieChart/>} color="text-emerald-600" bg="bg-emerald-50" onClick={() => setView('accounting')} />
        </>
      ) : (
        <>
          <DashboardCard title="Cari Pekerjaan" icon={<Search/>} color="text-blue-600" bg="bg-blue-50" onClick={() => setView('find_jobs')} />
          <DashboardCard title="Status Lamaran" icon={<FileText/>} color="text-amber-600" bg="bg-amber-50" onClick={() => setView('applications')} />
          <DashboardCard title="Lengkapi Profil" icon={<User/>} color="text-indigo-600" bg="bg-indigo-50" onClick={() => setView('profile')} />
        </>
      )}
    </div>
  </div>
);

const DashboardCard = ({ title, icon, color, bg, onClick }) => (
  <div onClick={onClick} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-center group">
    <div className={`p-4 rounded-xl ${bg} ${color} mr-4 group-hover:scale-110 transition-transform`}>
      {React.cloneElement(icon, { size: 28 })}
    </div>
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
  </div>
);

const ProfileManager = ({ systemUser, account, setAccount }) => {
  const [formData, setFormData] = useState({ 
    bio: account.bio || '', 
    location: account.location || '', 
    skills: account.skills || '',
    storeName: account.storeName || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update private account doc
      const accountRef = doc(db, 'artifacts', appId, 'users', systemUser.uid, 'registered_accounts', account.id);
      await updateDoc(accountRef, formData);
      
      // Update public directory
      const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_directory', account.id);
      await updateDoc(publicRef, { storeName: formData.storeName, skills: formData.skills, location: formData.location });

      setAccount({ ...account, ...formData });
      alert("Profil berhasil disimpan!");
    } catch (e) {
      console.error(e); alert("Gagal menyimpan profil.");
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-2xl">
      <div className="flex items-center mb-8 pb-6 border-b border-slate-100">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-3xl mr-6">
          {account.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{account.name}</h2>
          <p className="text-slate-500 font-medium">{account.email}</p>
        </div>
      </div>

      <div className="space-y-5">
        {account.role === 'umkm' && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Nama Usaha / Toko</label>
            <input type="text" value={formData.storeName} onChange={e=>setFormData({...formData, storeName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Lokasi (Kota)</label>
          <input type="text" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} placeholder="Cth: Jakarta Selatan" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            {account.role === 'umkm' ? 'Deskripsi Singkat Usaha' : 'Tentang Saya (Minat & Bakat)'}
          </label>
          <textarea rows="4" value={formData.bio} onChange={e=>setFormData({...formData, bio: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ceritakan detail..."></textarea>
        </div>
        {account.role === 'seeker' && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Keahlian Utama (Pisahkan dengan koma)</label>
            <input type="text" value={formData.skills} onChange={e=>setFormData({...formData, skills: e.target.value})} placeholder="Cth: Kasir, Barista, Desain Grafis" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        )}
        <button onClick={handleSave} disabled={saving} className="mt-4 bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  );
};


const UMKMStrategy = () => {
  const [inputs, setInputs] = useState({ modal: '', hpp: '', harga: '', targetBulan: '' });
  const [result, setResult] = useState(null);
  const [aiAdvice, setAiAdvice] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const calculate = () => {
    const modal = parseFloat(inputs.modal) || 0;
    const hpp = parseFloat(inputs.hpp) || 0; // Harga Pokok Produksi per unit
    const harga = parseFloat(inputs.harga) || 0; // Harga Jual per unit
    const target = parseFloat(inputs.targetBulan) || 0; // Target Penjualan (unit)

    const omzet = harga * target;
    const totalHpp = hpp * target;
    const profitKotor = omzet - totalHpp;
    const profitBersih = profitKotor; // Sederhana
    const margin = harga > 0 ? ((harga - hpp) / harga * 100).toFixed(1) : 0;
    
    setResult({ omzet, totalHpp, profitBersih, margin });
  };

  const getAIAdvice = async () => {
    if (!result) return;
    setLoadingAi(true); setAiAdvice('');
    const prompt = `Saya pelaku UMKM. Modal awal Rp${inputs.modal}, Biaya Produksi per unit Rp${inputs.hpp}, Harga Jual per unit Rp${inputs.harga}. Target jualan bulan ini ${inputs.targetBulan} unit. Estimasi profit saya Rp${result.profitBersih}. Berikan 3 poin strategi pemasaran yang praktis agar target tercapai, maksimal 100 kata.`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      setAiAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan saran AI.");
    } catch (e) {
      setAiAdvice("Terjadi kesalahan jaringan.");
    } finally { setLoadingAi(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold mb-6 flex items-center"><Calculator className="mr-2 text-indigo-600"/> Input Data Usaha</h3>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Modal Awal / Budget (Rp)</label><input type="number" value={inputs.modal} onChange={e=>setInputs({...inputs, modal: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Biaya Produksi 1 Produk (Rp)</label><input type="number" value={inputs.hpp} onChange={e=>setInputs({...inputs, hpp: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Harga Jual 1 Produk (Rp)</label><input type="number" value={inputs.harga} onChange={e=>setInputs({...inputs, harga: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Target Penjualan Bulan Ini (Unit)</label><input type="number" value={inputs.targetBulan} onChange={e=>setInputs({...inputs, targetBulan: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" /></div>
          <button onClick={calculate} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 mt-2">Kalkulasi Profit</button>
        </div>
      </div>

      <div className="space-y-6">
        {result && (
          <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-md">
            <h3 className="text-lg font-bold mb-4 opacity-90">Estimasi Hasil Bulanan</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><p className="text-xs font-bold uppercase tracking-wider opacity-70">Omzet</p><p className="text-xl font-black">{formatRupiah(result.omzet)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider opacity-70">Profit Bersih</p><p className="text-xl font-black text-emerald-300">{formatRupiah(result.profitBersih)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider opacity-70">Margin Profit</p><p className="text-xl font-black">{result.margin}%</p></div>
            </div>
            <button onClick={getAIAdvice} disabled={loadingAi} className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors">
              {loadingAi ? 'Menganalisis...' : 'Minta Strategi Pemasaran AI'}
            </button>
          </div>
        )}

        {aiAdvice && (
          <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
            <h4 className="font-bold text-purple-800 mb-3 flex items-center"><Target className="mr-2" size={18}/> Saran Strategi AI</h4>
            <div className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{aiAdvice}</div>
          </div>
        )}
      </div>
    </div>
  );
};


const UMKMAccounting = ({ systemUser, account }) => {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ date: '', desc: '', type: 'income', amount: '' });
  const [aiReport, setAiReport] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    
    const accRef = collection(db, 'artifacts', appId, 'public', 'data', 'accounting');
    const unsubscribe = onSnapshot(accRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.accountId === account.id);
      data.sort((a,b) => new Date(b.date) - new Date(a.date));
      setEntries(data);
    });
    return () => unsubscribe();
  }, [account.id]);

  const addEntry = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'accounting'), {
        ...form, accountId: account.id, amount: parseFloat(form.amount), timestamp: Date.now()
      });
      setForm({ date: '', desc: '', type: 'income', amount: '' });
    } catch(err) { console.error(err); }
  };

  const getAIReport = async () => {
    if (entries.length === 0) return;
    setLoadingAi(true); setAiReport('');
    const totalIn = entries.filter(e=>e.type==='income').reduce((a,b)=>a+b.amount,0);
    const totalOut = entries.filter(e=>e.type==='expense').reduce((a,b)=>a+b.amount,0);
    const prompt = `Sebagai konsultan keuangan UMKM. Data bulan ini: Pemasukan Rp${totalIn}, Pengeluaran Rp${totalOut}. Saldo Rp${totalIn-totalOut}. Berikan analisis 3 kalimat mengenai kesehatan keuangan dan 1 saran penghematan.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      setAiReport(data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal.");
    } catch(e) {} finally { setLoadingAi(false); }
  };

  const totalIn = entries.filter(e=>e.type==='income').reduce((a,b)=>a+b.amount,0);
  const totalOut = entries.filter(e=>e.type==='expense').reduce((a,b)=>a+b.amount,0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex gap-4 text-center">
          <div className="flex-1 bg-emerald-50 p-4 rounded-2xl"><p className="text-xs font-bold text-emerald-700 uppercase">Pemasukan</p><p className="text-xl font-bold text-emerald-700">{formatRupiah(totalIn)}</p></div>
          <div className="flex-1 bg-red-50 p-4 rounded-2xl"><p className="text-xs font-bold text-red-700 uppercase">Pengeluaran</p><p className="text-xl font-bold text-red-700">{formatRupiah(totalOut)}</p></div>
          <div className="flex-1 bg-indigo-50 p-4 rounded-2xl"><p className="text-xs font-bold text-indigo-700 uppercase">Saldo</p><p className="text-xl font-bold text-indigo-700">{formatRupiah(totalIn-totalOut)}</p></div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <form onSubmit={addEntry} className="bg-slate-50 p-6 border-b border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
             <div><label className="block text-xs font-bold text-slate-500 mb-1">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date:e.target.value})} className="w-full p-2 rounded-lg border outline-none"/></div>
             <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Keterangan</label><input type="text" required value={form.desc} onChange={e=>setForm({...form, desc:e.target.value})} className="w-full p-2 rounded-lg border outline-none" placeholder="Beli bahan baku..."/></div>
             <div><label className="block text-xs font-bold text-slate-500 mb-1">Tipe</label><select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-2 rounded-lg border outline-none"><option value="income">Masuk</option><option value="expense">Keluar</option></select></div>
             <div><label className="block text-xs font-bold text-slate-500 mb-1">Nominal</label><input type="number" required value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="w-full p-2 rounded-lg border outline-none" placeholder="100000"/></div>
             <button type="submit" className="md:col-span-5 bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700">Tambah Catatan</button>
          </form>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b"><tr className="text-slate-500"><th className="p-4">Tanggal</th><th className="p-4">Keterangan</th><th className="p-4 text-right">Nominal</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-4">{e.date}</td><td className="p-4 font-medium">{e.desc}</td><td className={`p-4 text-right font-bold ${e.type==='income'?'text-emerald-600':'text-red-600'}`}>{e.type==='income'?'+':'-'} {formatRupiah(e.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div>
        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-lg mb-2 flex items-center"><PieChart className="mr-2"/> Laporan Keuangan AI</h3>
          <p className="text-indigo-100 text-sm mb-4">Minta AI untuk menganalisis catatan keuangan Anda bulan ini.</p>
          <button onClick={getAIReport} disabled={loadingAi || entries.length===0} className="w-full bg-white text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors">
            {loadingAi ? 'Menganalisis...' : 'Hasilkan Laporan'}
          </button>
          {aiReport && (
             <div className="mt-4 bg-indigo-700/50 p-4 rounded-2xl border border-indigo-500 text-sm leading-relaxed whitespace-pre-wrap">
               {aiReport}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};


const UMKMJobManagement = ({ systemUser, account }) => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState({ title: '', desc: '', location: '', salary: '', reqs: '' });

  useEffect(() => {
    const jobsRef = collection(db, 'artifacts', appId, 'public', 'data', 'jobs');
    const appsRef = collection(db, 'artifacts', appId, 'public', 'data', 'applications');
    
    const unJob = onSnapshot(jobsRef, snap => setJobs(snap.docs.map(d=>({id:d.id, ...d.data()})).filter(j=>j.umkmId===account.id)));
    const unApp = onSnapshot(appsRef, snap => setApplications(snap.docs.map(d=>({id:d.id, ...d.data()})).filter(a=>a.umkmId===account.id)));
    
    return () => { unJob(); unApp(); };
  }, [account.id]);

  const addJob = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'jobs'), {
        ...form, umkmId: account.id, storeName: account.storeName, status: 'open', createdAt: Date.now()
      });
      setForm({ title: '', desc: '', location: '', salary: '', reqs: '' });
      alert("Lowongan diposting!");
    } catch(err) {}
  };

  const updateAppStatus = async (appIdToUpdate, newStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'applications', appIdToUpdate), { status: newStatus });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <h3 className="font-bold text-lg mb-4 flex items-center"><Plus className="mr-2"/> Buat Lowongan Baru</h3>
          <form onSubmit={addJob} className="space-y-3">
            <input required placeholder="Posisi (cth: Barista)" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm"/>
            <textarea required placeholder="Deskripsi Pekerjaan..." value={form.desc} onChange={e=>setForm({...form, desc:e.target.value})} rows="2" className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm"></textarea>
            <input required placeholder="Kualifikasi (cth: Rajin, Jujur)" value={form.reqs} onChange={e=>setForm({...form, reqs:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm"/>
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Lokasi (cth: Tebet)" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm"/>
              <input placeholder="Gaji (cth: Rp 2.000.000)" value={form.salary} onChange={e=>setForm({...form, salary:e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl outline-none text-sm"/>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700">Posting Lowongan</button>
          </form>
        </div>

        <h3 className="font-bold text-lg mb-4">Lowongan Aktif ({jobs.length})</h3>
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
              <div><h4 className="font-bold text-slate-800">{job.title}</h4><p className="text-xs text-slate-500 flex items-center"><MapPin size={12} className="mr-1"/> {job.location}</p></div>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">Aktif</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-lg mb-4">Daftar Pelamar ({applications.length})</h3>
        <div className="space-y-4">
          {applications.map(app => (
            <div key={app.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between mb-4 border-b pb-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{app.seekerName}</h4>
                  <p className="text-sm font-medium text-indigo-600">Melamar: {app.jobTitle}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${app.status==='pending'?'bg-amber-100 text-amber-700':app.status==='accepted'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                    {app.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl mb-4 text-sm text-slate-600">
                <p className="font-bold text-slate-700 mb-1">Pesan / Mini CV:</p>
                <p className="whitespace-pre-wrap">{app.cvText}</p>
              </div>
              {app.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={()=>updateAppStatus(app.id, 'accepted')} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl hover:bg-emerald-700">Terima</button>
                  <button onClick={()=>updateAppStatus(app.id, 'rejected')} className="flex-1 bg-red-100 text-red-700 font-bold py-2 rounded-xl hover:bg-red-200">Tolak</button>
                </div>
              )}
            </div>
          ))}
          {applications.length === 0 && <p className="text-slate-500 text-center py-10 bg-white rounded-3xl border border-slate-200">Belum ada pelamar.</p>}
        </div>
      </div>
    </div>
  );
};


const SeekerJobSearch = ({ systemUser, account, setView }) => {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [cvText, setCvText] = useState('');

  useEffect(() => {
    const jobsRef = collection(db, 'artifacts', appId, 'public', 'data', 'jobs');
    const unJob = onSnapshot(jobsRef, snap => setJobs(snap.docs.map(d=>({id:d.id, ...d.data()})).filter(j=>j.status==='open')));
    return () => unJob();
  }, []);

  const handleApply = async () => {
    if (!cvText.trim()) return alert("Tuliskan profil atau copy-paste CV Anda!");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'applications'), {
        jobId: selectedJob.id, jobTitle: selectedJob.title, umkmId: selectedJob.umkmId,
        seekerId: account.id, seekerName: account.name, cvText, status: 'pending', createdAt: Date.now()
      });
      alert("Lamaran berhasil dikirim!"); setSelectedJob(null); setCvText(''); setView('applications');
    } catch(err) { alert("Gagal mengirim lamaran."); }
  };

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(search.toLowerCase()) || 
    j.storeName?.toLowerCase().includes(search.toLowerCase()) ||
    j.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center">
        <Search className="text-slate-400 mx-3"/>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari posisi, nama toko, atau lokasi..." className="flex-1 p-2 outline-none text-slate-700 font-medium" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map(job => (
          <div key={job.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
            <div className="flex-1">
              <h3 className="font-bold text-xl text-slate-800 mb-1">{job.title}</h3>
              <p className="text-indigo-600 font-bold text-sm mb-4 flex items-center"><Store size={14} className="mr-1"/>{job.storeName}</p>
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-600 flex items-center"><MapPin size={14} className="mr-2 text-slate-400"/> {job.location}</p>
                <p className="text-xs text-slate-600 flex items-center"><DollarSign size={14} className="mr-2 text-slate-400"/> {job.salary || 'Sesuai kesepakatan'}</p>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3 mb-4 bg-slate-50 p-3 rounded-xl">{job.desc}</p>
            </div>
            <button onClick={()=>setSelectedJob(job)} className="w-full bg-indigo-50 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors">Lihat Detail & Lamar</button>
          </div>
        ))}
      </div>

      {/* Modal Lamaran */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 relative">
            <button onClick={()=>setSelectedJob(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"><X/></button>
            <h2 className="text-2xl font-bold mb-1">Lamar Posisi</h2>
            <h3 className="text-lg text-indigo-600 font-bold mb-6">{selectedJob.title} di {selectedJob.storeName}</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Pesan Singkat / Paste Teks CV Anda</label>
              <textarea value={cvText} onChange={e=>setCvText(e.target.value)} rows="6" placeholder="Halo, nama saya Budi. Saya memiliki pengalaman 2 tahun sebagai barista..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
              <p className="text-xs text-slate-500 mt-2 flex items-center"><AlertCircle size={12} className="mr-1"/> Data profil utama Anda (Keahlian & Kontak) akan otomatis terlampir.</p>
            </div>
            <button onClick={handleApply} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">Kirim Lamaran Sekarang</button>
          </div>
        </div>
      )}
    </div>
  );
};

const SeekerApplications = ({ account }) => {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    const appsRef = collection(db, 'artifacts', appId, 'public', 'data', 'applications');
    const unApp = onSnapshot(appsRef, snap => {
      setApps(snap.docs.map(d=>({id:d.id, ...d.data()})).filter(a=>a.seekerId===account.id));
    });
    return () => unApp();
  }, [account.id]);

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Status Lamaran Saya</h2>
      {apps.map(app => (
        <div key={app.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">{app.jobTitle}</h3>
            <p className="text-sm text-slate-500">Dikirim pada: {new Date(app.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
             <span className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center ${
               app.status==='pending' ? 'bg-amber-50 text-amber-700' :
               app.status==='accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
             }`}>
               {app.status === 'pending' && <Loader2 size={16} className="mr-2 animate-spin"/>}
               {app.status === 'accepted' && <Check size={16} className="mr-2"/>}
               {app.status === 'rejected' && <X size={16} className="mr-2"/>}
               {app.status === 'pending' ? 'Menunggu Review' : app.status === 'accepted' ? 'Diterima!' : 'Ditolak'}
             </span>
          </div>
        </div>
      ))}
      {apps.length === 0 && <p className="text-slate-500 bg-white p-8 rounded-3xl border text-center">Anda belum melamar pekerjaan apapun.</p>}
    </div>
  );
};


const ChatSystem = ({ account }) => {
  const [directory, setDirectory] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    // Ambil semua user di direktori publik
    const dirRef = collection(db, 'artifacts', appId, 'public', 'data', 'user_directory');
    const unDir = onSnapshot(dirRef, snap => {
      setDirectory(snap.docs.map(d=>d.data()).filter(u => u.id !== account.id));
    });
    return () => unDir();
  }, [account.id]);

  useEffect(() => {
    if (!activeChat) return;
    const roomId = [account.id, activeChat.id].sort().join('_');
    const msgRef = collection(db, 'artifacts', appId, 'public', 'data', `chat_${roomId}`);
    const unMsg = onSnapshot(msgRef, snap => {
      const msgs = snap.docs.map(d=>({id:d.id, ...d.data()}));
      msgs.sort((a,b)=>a.ts - b.ts);
      setMessages(msgs);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unMsg();
  }, [account.id, activeChat]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChat) return;
    const roomId = [account.id, activeChat.id].sort().join('_');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `chat_${roomId}`), {
        text: input, senderId: account.id, ts: Date.now()
      });
      setInput('');
    } catch(err){}
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Sidebar Kontak */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-5 border-b border-slate-200 bg-white">
          <h3 className="font-bold text-slate-800">Direktori Pesan</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {directory.map(u => (
            <div key={u.id} onClick={()=>setActiveChat(u)} className={`p-4 rounded-xl cursor-pointer mb-1 transition-colors flex items-center ${activeChat?.id === u.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-100 border border-transparent'}`}>
              <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold mr-3 shrink-0">{u.name.charAt(0)}</div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm text-slate-800 truncate">{u.name}</h4>
                <p className="text-xs text-slate-500 truncate">{u.role==='umkm' ? `Toko: ${u.storeName}` : 'Pencari Kerja'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Area Pesan */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {activeChat ? (
          <>
            <div className="p-5 border-b border-slate-200 bg-white flex items-center shadow-sm z-10">
               <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold mr-4">{activeChat.name.charAt(0)}</div>
               <div>
                 <h3 className="font-bold text-slate-800">{activeChat.name}</h3>
                 <p className="text-xs font-medium text-slate-500">{activeChat.role==='umkm' ? activeChat.storeName : 'Pencari Kerja'}</p>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === account.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-4 rounded-2xl text-sm shadow-sm ${m.senderId === account.id ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={sendMsg} className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Tulis pesan..." className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors"><Send size={20}/></button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare size={64} className="mb-4 opacity-20"/>
            <p className="font-medium">Pilih kontak untuk mulai berkirim pesan</p>
          </div>
        )}
      </div>
    </div>
  );
};
