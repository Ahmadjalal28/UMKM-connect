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
