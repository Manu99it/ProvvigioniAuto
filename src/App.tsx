/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  TrendingUp, 
  TrendingDown,
  Award, 
  FileText, 
  MoreHorizontal, 
  Plus, 
  Download, 
  Upload as UploadIcon,
  CheckCircle2,
  Calculator,
  Info,
  History,
  Settings as SettingsIcon,
  Home as HomeIcon,
  Zap,
  ArrowUpRight,
  Clock,
  Sparkles,
  Percent,
  User,
  Pencil,
  RotateCcw,
  Trash2,
  Calendar,
  LineChart as LineChartIcon,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { parseCommissionPDF, DDTRecord } from './services/pdfService';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@capgo/capacitor-navigation-bar';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import packageJson from '../package.json';

type Screen = 'home' | 'analysis' | 'charts' | 'history' | 'settings';

// Helper to trigger download or share (better for mobile and APK wrappers)
const triggerDownload = async (blob: Blob, filename: string) => {
  const userAgent = navigator.userAgent || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  // Use Capacitor Share for native Android/iOS
  if (isMobile && Capacitor.isNativePlatform()) {
    try {
      // Use a more robust way to convert Blob to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });

      // Save to temporary file in the cache directory
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });

      // Share the file natively
      await Share.share({
        title: filename,
        text: `Esportazione ${filename}`,
        url: savedFile.uri,
      });
      return;
    } catch (error) {
      console.error("Native sharing failed:", error);
    }
  }

  // Attempt to use the Web Share API (if available and not on native Capacitor)
  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      
      // Verify if sharing files is specifically supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `Esportazione ${filename}`
        });
        return; // Success
      }
    } catch (error) {
      console.warn("Web Share API failed:", error);
    }
  }

  // Standard download fallback
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    link.setAttribute('target', '_blank'); // Helps in some WebView environments
    
    document.body.appendChild(link);
    link.click();
    
    // Slight delay before cleanup for better browser compatibility
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error("Fallback download failed:", err);
  }
};

interface AppSettings {
  commissionRate: number;
  deductionRate: number;
  italianKeywords: string[];
}

interface HistoryEntry {
  id: string;
  monthName: string;
  year: number;
  fileName: string;
  records: DDTRecord[];
  totalItalian: number;
  commission: number;
  timestamp: number;
}

const ITALIAN_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

function extractMonthFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  for (const month of ITALIAN_MONTHS) {
    if (lower.includes(month)) {
      return month.charAt(0).toUpperCase() + month.slice(1);
    }
  }
  return "N/A";
}

const DEFAULT_SETTINGS: AppSettings = {
  commissionRate: 5,
  deductionRate: 2.7,
  italianKeywords: ['37.2.1', '37.2.2', '37.1.3', 'allevato in italia']
};

const scrollPositionsCache: Record<string, number> = {};

function ScrollRestorer({ screenName }: { screenName: string }) {
  React.useLayoutEffect(() => {
    const pos = scrollPositionsCache[screenName] || 0;
    window.scrollTo({ top: pos, behavior: 'instant' });
  }, [screenName]);
  return null;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [progress, setProgress] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [ddtRecords, setDdtRecords] = useState<DDTRecord[]>([]);
  const [analyzingFiles, setAnalyzingFiles] = useState<File[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);
  const [showSkippedModal, setShowSkippedModal] = useState(false);

  // Theme states
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('app_dark_mode') === 'true';
  });
  const [useSystemTheme, setUseSystemTheme] = useState(() => {
    const saved = localStorage.getItem('app_use_system_theme');
    return saved === null ? true : saved === 'true';
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('app_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    return localStorage.getItem('app_profile_image');
  });

  const [personalInfo, setPersonalInfo] = useState(() => {
    const saved = localStorage.getItem('app_personal_info');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {
          name: "Utente",
          role: "Profilo",
          email: "utente@esempio.com"
        };
      }
    }
    return {
      name: "Utente",
      role: "Profilo",
      email: "utente@esempio.com"
    };
  });

  const [currentMonthDisplay, setCurrentMonthDisplay] = useState<string>('ultimo mese');
  const [currentYearDisplay, setCurrentYearDisplay] = useState<number>(new Date().getFullYear());
  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollY = useRef(0);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Return parsed settings merged with defaults (for new fields)
        // But do not re-add keywords if they are missing from saved list
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return { ...DEFAULT_SETTINGS };
      }
    }
    return { ...DEFAULT_SETTINGS };
  });

  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('app_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('app_personal_info', JSON.stringify(personalInfo));
  }, [personalInfo]);

  useEffect(() => {
    if (profileImage) {
      localStorage.setItem('app_profile_image', profileImage);
    } else {
      localStorage.removeItem('app_profile_image');
    }
  }, [profileImage]);

    // Dynamic Theme Color for Mobile
    useEffect(() => {
      const isHeaderColor = true; // Use header color for status bar consistency
      const themeColor = isDarkMode ? '#082f49' : '#f0f9ff';
      const headerColor = isDarkMode ? '#112b42' : '#ffffff'; // Match the header bg color (80% opacity in CSS, but solid here)

      // Update theme-color meta tag
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', headerColor);

      // Apple specific status bar style
      let appleStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!appleStyle) {
        appleStyle = document.createElement('meta');
        appleStyle.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(appleStyle);
      }
      appleStyle.setAttribute('content', isDarkMode ? 'black-translucent' : 'default');

      // Ensure the background color of body/html matches theme immediately for Android navigation bars
      document.documentElement.style.backgroundColor = themeColor;
      document.body.style.backgroundColor = themeColor;

      // Capacitor Native System Bars Update
      if (Capacitor.isNativePlatform()) {
        // Status Bar matches Header for continuity
        StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light }).catch(() => {});
        
        // Navigation Bar Update for contrast (Gesture Pill color) and Transparency
        NavigationBar.setNavigationBarColor({ color: 'transparent', darkButtons: !isDarkMode }).catch(() => {});
      }
    }, [isDarkMode]);

  // Load latest chronological month from history on mount if no current analysis
  useEffect(() => {
    if (ddtRecords.length === 0 && history.length > 0) {
      const sortedHistory = [...history].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const indexA = ITALIAN_MONTHS.indexOf(a.monthName.toLowerCase());
        const indexB = ITALIAN_MONTHS.indexOf(b.monthName.toLowerCase());
        return indexB - indexA; // Descending index
      });
      
      const latest = sortedHistory[0];
      if (latest) {
        setDdtRecords(latest.records);
        setCurrentMonthDisplay(latest.monthName);
        setCurrentYearDisplay(latest.year);
        setHasData(true);
      }
    }
  }, []); // Run once on startup

  // Theme states
  
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfileImage = () => {
    setProfileImage(null);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = '';
    }
  };

  const handlePDFFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAnalyzingFiles(Array.from(files));
      setCurrentScreen('analysis');
      // Reset input value so same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      // Handle FAB visibility
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setIsFabVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsFabVisible(false);
      } else {
        // Scrolling up
        setIsFabVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentScreen]);
  // Rimossa la vecchia logica useEffect per lo scroll restore (gestita da AnimatePresence)

  // Theme effect
  useEffect(() => {
    const applyTheme = (dark: boolean) => {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (useSystemTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = (e: MediaQueryListEvent | { matches: boolean }) => {
        applyTheme(e.matches);
        setIsDarkMode(e.matches);
      };
      
      updateTheme(mediaQuery);
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      applyTheme(isDarkMode);
    }
  }, [isDarkMode, useSystemTheme]);

  useEffect(() => {
    localStorage.setItem('app_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('app_use_system_theme', useSystemTheme.toString());
  }, [useSystemTheme]);

  // Hide Splash Screen manually after React mounts to prevent any white flash
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setTimeout(() => {
        SplashScreen.hide().catch(() => {});
      }, 150);
    }
  }, []);

  // Handle analysis when entering the analysis screen
  useEffect(() => {
    let isMounted = true;
    
    if (currentScreen === 'analysis' && analyzingFiles.length > 0) {
      const processBatch = async () => {
        let finalResults: DDTRecord[] = [];
        let allProcessedEntries: HistoryEntry[] = [];
        let currentSkipped: string[] = [];
        
        for (let i = 0; i < analyzingFiles.length; i++) {
          if (!isMounted) break;
          
          setCurrentFileIndex(i);
          const file = analyzingFiles[i];
          
          try {
            const results = await parseCommissionPDF(file, (p) => {
              if (isMounted) {
                setProgress(p);
                // Calculate overall progress
                const fileWeight = 100 / analyzingFiles.length;
                const completedWeight = i * fileWeight;
                const currentWeight = (p / 100) * fileWeight;
                setOverallProgress(completedWeight + currentWeight);
              }
            }, settings.italianKeywords);

            if (!isMounted) break;

            const totItaliano = results.reduce((acc, r) => acc + r.italianoTotal, 0);
            const afterDiscount = totItaliano * (1 - (settings.deductionRate / 100));
            const commission = afterDiscount * (settings.commissionRate / 100);
            
            let monthName = extractMonthFromFilename(file.name); 
            let year = new Date().getFullYear();
            
            if (results.length > 0 && results[0].date) {
              const dateParts = results[0].date.split(/[\/.-]/);
              if (dateParts.length >= 2) {
                const mIdx = parseInt(dateParts[1]) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                  const mName = ITALIAN_MONTHS[mIdx];
                  monthName = mName.charAt(0).toUpperCase() + mName.slice(1);
                }
              }
              if (dateParts.length === 3) {
                const parsedYear = parseInt(dateParts[2]);
                if (!isNaN(parsedYear)) year = parsedYear;
              }
            }

            const newEntry: HistoryEntry = {
              id: Math.random().toString(36).substring(2, 9),
              monthName,
              year,
              fileName: file.name,
              records: results,
              totalItalian: totItaliano,
              commission: commission,
              timestamp: Date.now()
            };

            allProcessedEntries.push(newEntry);
            
            // For the dashboard display, we'll use the last processed file's data
            finalResults = results;
            setCurrentMonthDisplay(monthName);
            setCurrentYearDisplay(year);
            
          } catch (err) {
            console.error(`Error processing file ${file.name}:`, err);
            if (err instanceof Error && (err.message === 'INVALID_DOCUMENT_FORMAT' || err.message === 'INVALID_FILE_TYPE')) {
              currentSkipped.push(file.name);
            }
          }
        }

        if (isMounted) {
          if (currentSkipped.length > 0) {
            setSkippedFiles(currentSkipped);
            setShowSkippedModal(true);
          } else {
            setSkippedFiles([]);
          }

          if (allProcessedEntries.length > 0) {
            setHistory(prev => {
              // We need to decide how to merge multiple entries for the same month in the same batch
              // and with existing history.
              // For now, let's just append them and then handle the "replace" logic correctly
              let updatedHistory = [...prev];
              
              allProcessedEntries.forEach(newEntry => {
                // Remove existing entry for same month/year before adding new one
                updatedHistory = updatedHistory.filter(h => !(h.monthName === newEntry.monthName && h.year === newEntry.year));
                updatedHistory = [newEntry, ...updatedHistory];
              });
              
              return updatedHistory;
            });
            
            setDdtRecords(finalResults);
            setHasData(true);
          }
          
          setOverallProgress(100);
          setProgress(100);

          setTimeout(() => {
            if (isMounted) {
              setAnalyzingFiles([]);
              setCurrentFileIndex(0);
              setCurrentScreen('home');
            }
          }, 800);
        }
      };

      processBatch();
    } else {
      setProgress(0);
      setOverallProgress(0);
      setCurrentFileIndex(0);
    }

    return () => {
      isMounted = false;
    };
  }, [currentScreen, analyzingFiles, settings.italianKeywords, settings.deductionRate, settings.commissionRate]);

  const loadHistoryEntry = (entry: HistoryEntry) => {
    setDdtRecords(entry.records);
    setCurrentMonthDisplay(entry.monthName);
    setCurrentYearDisplay(entry.year);
    setHasData(true);
    setCurrentScreen('home');
  };

  const resetEverything = () => {
    setShowResetModal(true);
  };

  const deleteHistoryEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const newHistory = prev.filter(entry => entry.id !== id);
      
      // If we are currently viewing the deleted record, go back to home or select latest
      if (ddtRecords.length > 0 && !newHistory.find(h => h.records === ddtRecords)) {
         if (newHistory.length > 0) {
           // Sort newHistory to find the absolute latest chronological entry
           const sorted = [...newHistory].sort((a, b) => {
             if (a.year !== b.year) return b.year - a.year;
             const indexA = ITALIAN_MONTHS.indexOf(a.monthName.toLowerCase());
             const indexB = ITALIAN_MONTHS.indexOf(b.monthName.toLowerCase());
             return indexB - indexA;
           });
           const latest = sorted[0];
           setDdtRecords(latest.records);
           setCurrentMonthDisplay(latest.monthName);
           setCurrentYearDisplay(latest.year);
         } else {
           setDdtRecords([]);
           setHasData(false);
           setCurrentScreen('home');
         }
      }
      return newHistory;
    });
  };

  const confirmReset = () => {
    setSettings(prev => ({
      ...prev,
      ...DEFAULT_SETTINGS
    }));
    setHistory([]);
    setDdtRecords([]);
    setPersonalInfo({
      name: "Utente",
      role: "Profilo",
      email: "utente@esempio.com"
    });
    setProfileImage(null);
    setHasData(false);
    setCurrentMonthDisplay('ultimo mese');
    setCurrentScreen('home');
    setUseSystemTheme(true);
    setShowResetModal(false);
  };

  return (
    <div className="min-h-screen bg-[#f0f9ff] dark:bg-sky-950 text-[#0c4a6e] dark:text-sky-100 pb-32 font-sans transition-colors duration-300">
      {/* Header */}
      <header 
        className="fixed top-0 w-full z-50 bg-white/80 dark:bg-sky-900/80 backdrop-blur-lg border-b border-sky-100/20 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg tracking-tight text-sky-700 dark:text-sky-400">Provvigioni</h1>
          </div>
          <div 
            onClick={() => setShowProfileModal(true)}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary ring-2 ring-primary/10 transition-all hover:ring-primary/30 cursor-pointer flex items-center justify-center bg-slate-50 dark:bg-slate-800"
          >
            {profileImage ? (
              <img 
                alt="User profile" 
                src={profileImage} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={20} className="text-primary" />
            )}
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-sky-900 rounded-3xl p-8 shadow-2xl overflow-hidden border dark:border-sky-800"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-sky-50 dark:border-sky-800 ring-4 ring-sky-500/10 dark:ring-sky-500/20 flex items-center justify-center bg-sky-50 dark:bg-sky-800">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-primary" />
                    )}
                  </div>
                  <button 
                    onClick={() => profileFileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg transition-transform hover:scale-110"
                  >
                    <Pencil size={14} />
                  </button>
                  {profileImage && (
                    <button 
                      onClick={handleRemoveProfileImage}
                      className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full shadow-lg transition-transform hover:scale-110"
                      title="Rimuovi foto"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={profileFileInputRef} 
                    onChange={handleProfileImageChange}
                    className="hidden" 
                    accept="image/*"
                  />
                </div>

                <div className="w-full space-y-4">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nome</label>
                    <input 
                      type="text"
                      value={personalInfo.name}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Didascalia</label>
                    <input 
                      type="text"
                      value={personalInfo.role}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label>
                    <input 
                      type="email"
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <button 
                    onClick={() => {
                      setCurrentScreen('settings');
                      setShowProfileModal(false);
                    }}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2"
                  >
                    <SettingsIcon size={18} />
                    Impostazioni
                  </button>

                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="w-full py-3 bg-slate-900 dark:bg-primary text-white rounded-2xl font-bold transition-all hover:bg-slate-800 dark:hover:bg-primary/90"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl overflow-hidden border dark:border-slate-800"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                  <RotateCcw size={32} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Ripristino App</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sei sicuro? Verranno ripristinate le provvigioni, le parole chiave e cancellato tutto lo storico.
                  </p>
                </div>

                <div className="w-full space-y-3 pt-2">
                  <button 
                    onClick={confirmReset}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-500/20 transition-all active:scale-95"
                  >
                    Sì, ripristina tutto
                  </button>
                  <button 
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Skipped Files Modal */}
      <AnimatePresence>
        {showSkippedModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSkippedModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl overflow-hidden border dark:border-slate-800"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Info size={32} />
                </div>

                <div className="space-y-2 w-full text-center">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">File non validi</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    I seguenti file sono stati scartati perché non sono in formato PDF o non contengono l'intestazione "CE.DI.MARCHE":
                  </p>
                  <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-left max-h-40 overflow-y-auto w-full border border-slate-100 dark:border-slate-800">
                    <ul className="space-y-1">
                      {skippedFiles.map((name, idx) => (
                        <li key={idx} className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                           <span className="text-amber-500 mt-0.5">•</span>
                           {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSkippedModal(false)}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  Ho capito
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`px-4 max-w-5xl mx-auto ${Capacitor.isNativePlatform() ? 'pt-6' : 'pt-20'}`}>
        <AnimatePresence mode="wait">
          {currentScreen === 'home' && (
            <HomeScreen 
              key="home" 
              hasData={hasData} 
              records={ddtRecords} 
              settings={settings} 
              history={history} 
              monthName={currentMonthDisplay}
              year={currentYearDisplay}
              onLoadEntry={loadHistoryEntry}
            />
          )}
          {currentScreen === 'charts' && (
            <ChartsScreen 
              key="charts"
              history={history}
              settings={settings}
            />
          )}
          {currentScreen === 'analysis' && (
            <AnalysisScreen 
              key="analysis" 
              progress={progress} 
              overallProgress={overallProgress}
              currentFile={currentFileIndex + 1}
              totalFiles={analyzingFiles.length}
              fileName={analyzingFiles[currentFileIndex]?.name || 'Documento'} 
            />
          )}
          {currentScreen === 'history' && (
             <HistoryScreen 
               key="history"
               history={history}
               onEntryClick={loadHistoryEntry}
               onDeleteEntry={deleteHistoryEntry}
               onClear={() => setHistory([])}
             />
          )}
          {currentScreen === 'settings' && (
             <SettingsScreen 
               key="settings"
               onBack={() => setCurrentScreen('home')}
               useSystemTheme={useSystemTheme}
               setUseSystemTheme={setUseSystemTheme}
               isDarkMode={isDarkMode}
               setIsDarkMode={setIsDarkMode}
               settings={settings}
               setSettings={setSettings}
               onReset={resetEverything}
             />
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      {currentScreen === 'home' && (
        <>
          <input 
            type="file" 
            ref={pdfFileInputRef} 
            onChange={handlePDFFileChange} 
            className="hidden" 
            accept=".pdf"
            multiple
          />
          <motion.button 
            initial={{ y: 100, opacity: 0 }}
            animate={{ 
              y: isFabVisible ? 0 : 100, 
              opacity: isFabVisible ? 1 : 0 
            }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => pdfFileInputRef.current?.click()}
            className="fixed right-5 px-4 h-12 rounded-xl bg-primary text-white shadow-2xl flex items-center gap-2 z-40 border border-white/20"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Plus size={18} />
            </div>
            <span className="font-bold text-xs whitespace-nowrap">CARICA PDF</span>
          </motion.button>
        </>
      )}

      {/* Bottom Navigation */}
      <nav 
        className="fixed z-50 left-1/2 -translate-x-1/2 flex justify-center gap-1 items-center p-1.5 bg-white/60 dark:bg-sky-950/80 backdrop-blur-xl border border-sky-100/30 dark:border-sky-800 shadow-[0_8px_30px_rgba(2,132,199,0.12)] rounded-full w-max"
        style={{ 
          bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <NavButton 
          active={currentScreen === 'home'} 
          onClick={() => {
            if (currentScreen !== 'home') {
              scrollPositionsCache[currentScreen] = window.scrollY;
              setCurrentScreen('home');
            }
          }} 
          icon={<HomeIcon size={24} />} 
          label="HOME" 
        />
        <NavButton 
          active={currentScreen === 'charts'} 
          onClick={() => {
            if (currentScreen !== 'charts') {
              scrollPositionsCache[currentScreen] = window.scrollY;
              setCurrentScreen('charts');
            }
          }} 
          icon={<LineChartIcon size={24} />} 
          label="GRAFICI" 
        />
        <NavButton 
          active={currentScreen === 'history'} 
          onClick={() => {
            if (currentScreen !== 'history') {
              scrollPositionsCache[currentScreen] = window.scrollY;
              setCurrentScreen('history');
            }
          }} 
          icon={<History size={24} />} 
          label="STORICO" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-300 rounded-full ${active ? 'bg-sky-100/80 dark:bg-sky-900/60 text-primary px-7 py-1.5' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-3 py-1.5'}`}
    >
      <div className="mb-0.5">{icon}</div>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
function ChartsScreen({ history, settings }: { history: HistoryEntry[]; settings: AppSettings; key?: React.Key }) {
  const chart1Ref = useRef<HTMLDivElement>(null);
  const chart2Ref = useRef<HTMLDivElement>(null);
  const chart3Ref = useRef<HTMLDivElement>(null);
  const chart4Ref = useRef<HTMLDivElement>(null);
  
  const hiddenChart1Ref = useRef<HTMLDivElement>(null);
  const hiddenChart2Ref = useRef<HTMLDivElement>(null);
  const hiddenChart3Ref = useRef<HTMLDivElement>(null);
  const hiddenChart4Ref = useRef<HTMLDivElement>(null);
  
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    // Give more time for the hidden charts to render properly
    setTimeout(async () => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        let currentY = 20;

        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229);
        doc.text("REPORT ANDAMENTO CDM", 105, currentY, { align: 'center' });
        currentY += 15;
        
        doc.setFontSize(14);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 105, currentY, { align: 'center' });
        currentY += 20;

        // Chart 1: FATTURATO ANNUO
        if (hiddenChart1Ref.current) {
          const dataUrl = await toPng(hiddenChart1Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text("FATTURATO ANNUO CDM", 105, currentY, { align: 'center' });
          currentY += 10;
          
          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          autoTable(doc, {
            startY: currentY,
            margin: { left: 105 - 32.5 },
            tableWidth: 65,
            head: [['Anno', 'Totale', 'Nostrano']],
            body: yearlyData.map(d => [d.year, `€${d.totale.toLocaleString('it-IT')}`, `€${d.nostrano.toLocaleString('it-IT')}`]),
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [2, 132, 199] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 4: PROVVIGIONI
        if (hiddenChart4Ref.current) {
          const dataUrl = await toPng(hiddenChart4Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO PROVVIGIONI", 105, currentY, { align: 'center' });
          currentY += 10;

          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const provvigioniRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: any[] = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyCommissionData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: provvigioniRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [139, 92, 246] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 2: NOSTRANO
        if (hiddenChart2Ref.current) {
          const dataUrl = await toPng(hiddenChart2Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO NOSTRANO CDM", 105, currentY, { align: 'center' });
          currentY += 10;
          
          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const nostranoRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: any[] = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyItalianData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: nostranoRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [13, 148, 136] }
          });
          
          doc.addPage();
          currentY = 20;
        }

        // Chart 3: VENDITA
        if (hiddenChart3Ref.current) {
          const dataUrl = await toPng(hiddenChart3Ref.current, { 
            backgroundColor: '#ffffff', 
            pixelRatio: 2,
          });
          doc.setFontSize(14);
          doc.text("ANDAMENTO VENDITA CDM", 105, currentY, { align: 'center' });
          currentY += 10;

          doc.addImage(dataUrl, 'JPEG', 10, currentY, 190, 107, undefined, 'FAST');
          currentY += 115;
          
          const venditaRows = ITALIAN_MONTHS.map((m, idx) => {
            const row: any[] = [m.toUpperCase()];
            years.forEach(y => {
              const val = monthlyTotalData[idx][y] || 0;
              row.push(`€${val.toLocaleString('it-IT')}`);
            });
            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [['Mese', ...years.map(String)]],
            body: venditaRows,
            styles: { fontSize: 7, cellPadding: 1, minCellHeight: 0 },
            headStyles: { fillColor: [2, 132, 199] }
          });
        }

        const pdfBlob = doc.output('blob');
        await triggerDownload(pdfBlob, `Report_Grafici_CDM_${new Date().getFullYear()}.pdf`);
      } catch (error) {
        console.error("Export error:", error);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  const ChartTooltip = ({ active, payload, label, title }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-2xl border border-sky-100 dark:border-sky-800 space-y-3 min-w-[200px] z-50">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b dark:border-slate-800 pb-2">{title}: {label}</p>
          <div className="grid gap-2 max-h-48 overflow-y-auto no-scrollbar">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate max-w-[100px]">
                    {entry.name}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-white numeric-data">
                  € {entry.value.toLocaleString('it-IT')}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // 1. Process data for Yearly Totals Chart
  const yearlyDataMap = new Map<number, { year: number; totale: number; nostrano: number }>();
  
  history.forEach(entry => {
    let year = entry.year;
    if (!year) {
      year = entry.timestamp ? new Date(entry.timestamp).getFullYear() : new Date().getFullYear();
      if (entry.monthName.toLowerCase() === 'dicembre' && entry.timestamp && new Date(entry.timestamp).getMonth() <= 1) {
        year -= 1;
      }
    }
    
    const existing = yearlyDataMap.get(year) || { year, totale: 0, nostrano: 0 };
    const records = entry.records || [];
    const total = records.reduce((acc, r) => acc + (r.imponibileTotal || 0), 0);
    const nostrano = records.reduce((acc, r) => acc + (r.italianoTotal || 0), 0);
    
    yearlyDataMap.set(year, {
      year,
      totale: existing.totale + total,
      nostrano: existing.nostrano + nostrano
    });
  });
  
  const yearlyData = Array.from(yearlyDataMap.values()).sort((a, b) => a.year - b.year);

  // 2. Process data for Monthly Multi-year Comparisons (Italiano & Totale)
  // Get all years, sorted descending
  const years = Array.from(yearlyDataMap.keys()).sort((a, b) => b - a).reverse();
  const colors = [
    '#0284c7', // Sky
    '#0d9488', // Teal
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#f97316', // Orange
    '#84cc16', // Lime
    '#0ea5e9', // Light Blue
    '#a855f7', // Purple
    '#14b8a6', // Light Teal
    '#ef4444', // Red
    '#eab308', // Yellow
    '#d946ef', // Fuchsia
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#be123c', // Dark Rose
    '#64748b'  // Slate
  ];

  const monthlyItalianData = ITALIAN_MONTHS.map((month, idx) => {
    const row: any = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const nostrano = (entry.records || []).reduce((acc, r) => acc + (r.italianoTotal || 0), 0);
        row[year] = Math.round(nostrano);
      } else {
        row[year] = 0; // Or null to have gaps
      }
    });
    return row;
  });

  const monthlyTotalData = ITALIAN_MONTHS.map((month, idx) => {
    const row: any = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const total = (entry.records || []).reduce((acc, r) => acc + (r.imponibileTotal || 0), 0);
        row[year] = Math.round(total);
      } else {
        row[year] = 0;
      }
    });
    return row;
  });

  const monthlyCommissionData = ITALIAN_MONTHS.map((month, idx) => {
    const row: any = { month: month.substring(0, 3).toUpperCase() };
    years.forEach(year => {
      const entry = history.find(e => {
        let eYear = e.year;
        if (!eYear) {
          eYear = e.timestamp ? new Date(e.timestamp).getFullYear() : new Date().getFullYear();
          if (e.monthName.toLowerCase() === 'dicembre' && e.timestamp && new Date(e.timestamp).getMonth() <= 1) eYear -= 1;
        }
        return eYear === year && e.monthName.toLowerCase() === month.toLowerCase();
      });
      
      if (entry) {
        const italianSumRaw = (entry.records || []).reduce((acc, r) => acc + (r.italianoTotal || 0), 0);
        const italianSum = Math.round(italianSumRaw * 100) / 100;
        const afterDiscountEntry = italianSum * (1 - (settings.deductionRate / 100));
        const commission = Math.round(afterDiscountEntry * (settings.commissionRate / 100) * 100) / 100;
        row[year] = Math.round(commission);
      } else {
        row[year] = 0;
      }
    });
    return row;
  });

  return (
    <>
      {/* Hidden Export Container - Rendered with fixed width only during export */}
      {isExporting && (
        <div 
          className="fixed left-[-9999px] top-0 bg-white"
          style={{ width: '1200px' }}
        >
          <div ref={hiddenChart1Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <BarChart width={1200} height={600} data={yearlyData} margin={{ top: 40, right: 40, left: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="year" tick={{ fontSize: 18, fontWeight: 700, fill: 'var(--chart-tick-color)' }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '20px', fontWeight: 'bold' }} />
              <Bar dataKey="totale" name="TOTALE" fill="#0284c7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="nostrano" name="NOSTRANO" fill="#0d9488" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </div>

          <div ref={hiddenChart2Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <LineChart width={1200} height={600} data={monthlyItalianData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Line 
                  key={year} 
                  type="monotone" 
                  dataKey={year} 
                  name={year.toString()} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={4}
                  dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>

          <div ref={hiddenChart3Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <LineChart width={1200} height={600} data={monthlyTotalData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Line 
                  key={year} 
                  type="monotone" 
                  dataKey={year} 
                  name={year.toString()} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={4}
                  dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </div>

          <div ref={hiddenChart4Ref} style={{ width: '1200px', height: '600px', background: '#fff', '--chart-tick-color': '#64748b' } as React.CSSProperties}>
            <BarChart width={1200} height={600} data={monthlyCommissionData} margin={{ top: 40, right: 40, left: 60, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }} />
              <YAxis 
                tick={{ fontSize: 16, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                tickFormatter={(val) => `€${(val/1000).toFixed(0)}k`} 
              />
              <Legend verticalAlign="top" align="center" height={80} wrapperStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
              {years.map((year, index) => (
                <Bar 
                  key={year} 
                  dataKey={year} 
                  name={year.toString()} 
                  fill={colors[index % colors.length]} 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </div>

        </div>
      )}


      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-24"
    >
      <ScrollRestorer screenName="charts" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sky-500 rounded-2xl shadow-lg shadow-sky-500/20 text-white">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Grafici d'Andamento</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Analisi comparativa pluriennale del fatturato</p>
          </div>
        </div>
        <button 
          onClick={exportPDF}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
        >
          {isExporting ? (
            <RotateCcw className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isExporting ? 'ESPORTAZIONE...' : 'ESPORTA REPORT PDF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yearly Totals Chart - Full Width */}
        <div ref={chart1Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800 lg:col-span-2">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase text-center tracking-wider">FATTURATO ANNUO CDM</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ left: -20, right: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--chart-tick-color)', fontWeight: 700 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  domain={[0, (dataMax: number) => Math.ceil(dataMax / 10000) * 10000]}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={<ChartTooltip title="ANNO" />}
                />
                <Legend verticalAlign="top" align="center" height={50} wrapperStyle={{ paddingBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}/>
                <Bar dataKey="totale" name="TOTALE" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="nostrano" name="NOSTRANO" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Commission Comparison Chart */}
        <div ref={chart4Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800 lg:col-span-2">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO PROVVIGIONI</h3>
          
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCommissionData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Bar 
                      key={year} 
                      dataKey={year} 
                      name={`${year}`} 
                      fill={colors[i % colors.length]} 
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Italian Comparison Chart */}
        <div ref={chart2Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO NOSTRANO CDM</h3>
          
          {/* Custom Static Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyItalianData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Line 
                      key={year} 
                      type="monotone" 
                      dataKey={year} 
                      name={`${year}`} 
                      stroke={colors[i % colors.length]} 
                      strokeWidth={2.5} 
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Total Comparison Chart */}
        <div ref={chart3Ref} className="bg-white dark:bg-sky-900 p-4 md:p-6 rounded-3xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 uppercase tracking-wider text-center">ANDAMENTO VENDITA CDM</h3>
          
          {/* Custom Static Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            {years.map((year, i) => (
              <div key={year} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{year}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[500px] h-[250px] lg:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTotalData} margin={{ left: -20, right: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={true} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 800, angle: -45, textAnchor: 'end', fill: 'var(--chart-tick-color)' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: 'var(--chart-tick-color)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    content={<ChartTooltip title="MESE" />}
                  />
                  {years.map((year, i) => (
                    <Line 
                      key={year} 
                      type="monotone" 
                      dataKey={year} 
                      name={`${year}`} 
                      stroke={colors[i % colors.length]} 
                      strokeWidth={2.5} 
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>



      </div>
    </motion.div>
  </>
);
}

function HomeScreen({ hasData, records, settings, history, monthName, year, onLoadEntry }: { 
  hasData: boolean; 
  records: DDTRecord[]; 
  settings: AppSettings; 
  history: HistoryEntry[]; 
  monthName: string; 
  year: number;
  onLoadEntry: (entry: HistoryEntry) => void;
  key?: React.Key 
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current && history.length > 0 && !hasScrolled) {
      const element = scrollContainerRef.current;
      const timeoutId = setTimeout(() => {
        const activeBar = element.querySelector('[data-active="true"]') as HTMLElement;
        if (activeBar) {
          // Calculate precise horizontal scroll to center the active bar within the container ONLY
          const containerWidth = element.offsetWidth;
          const barLeft = activeBar.offsetLeft;
          const barWidth = activeBar.offsetWidth;
          element.scrollLeft = barLeft - (containerWidth / 2) + (barWidth / 2);
        } else {
          element.scrollLeft = element.scrollWidth;
        }
        setHasScrolled(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [history.length, hasScrolled]);

  const totItalianoRaw = records.reduce((acc, r) => acc + r.italianoTotal, 0);
  const totItaliano = Math.round(totItalianoRaw * 100) / 100;
  
  const totGeneraleRaw = records.reduce((acc, r) => acc + (r.imponibileTotal || 0), 0);
  const totGenerale = Math.round(totGeneraleRaw * 100) / 100;
  
  // Logic: (Sum Italian - Deduction%) * Commission%
  const afterDiscount = totItaliano * (1 - (settings.deductionRate / 100));
  const monthlyCommission = Math.round(afterDiscount * (settings.commissionRate / 100) * 100) / 100;

  // Prepare History Chart Data (Bar Chart)
  const historyChartData = history
    .map(entry => {
      let entryYear = entry.year;
      
      // Better year inference if missing
      if (!entryYear) {
        const date = entry.timestamp ? new Date(entry.timestamp) : new Date();
        entryYear = date.getFullYear();
        
        // If it's Dicembre but recorded in Jan/Feb, it's likely previous year
        if (entry.monthName.toLowerCase() === 'dicembre' && date.getMonth() <= 1) {
          entryYear -= 1;
        }
      }
      
      // Recalculate commission based on CURRENT settings if records exist, otherwise use saved commission
      let recalculatedCommission = entry.commission || 0;
      if (entry.records && entry.records.length > 0) {
        const italianSumRaw = entry.records.reduce((acc, r) => acc + r.italianoTotal, 0);
        const italianSum = Math.round(italianSumRaw * 100) / 100;
        const afterDiscountEntry = italianSum * (1 - (settings.deductionRate / 100));
        recalculatedCommission = Math.round(afterDiscountEntry * (settings.commissionRate / 100) * 100) / 100;
      }
      
      return {
        name: `${entry.monthName.substring(0, 3).toUpperCase()} '${entryYear.toString().slice(-2)}`,
        fullName: entry.monthName,
        value: recalculatedCommission,
        monthIndex: ITALIAN_MONTHS.indexOf(entry.monthName.toLowerCase()),
        year: entryYear,
        entry: entry
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      // If monthIndex is -1 (N/A), sort it to the end of the year
      const idxA = a.monthIndex === -1 ? 12 : a.monthIndex;
      const idxB = b.monthIndex === -1 ? 12 : b.monthIndex;
      return idxA - idxB;
    });

  // Calculate Trend
  let trendValue = 0;
  let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  
  // Find index of current monthName in chronological history
  const currentIndex = historyChartData.findIndex(d => d.fullName.toLowerCase() === monthName.toLowerCase() && d.year === year);
  
  // Only calculate trend if we found the current month and there is a previous entry
  if (currentIndex > 0) {
    const currentVal = monthlyCommission; // Use the actual displayed commission
    const prevVal = historyChartData[currentIndex - 1].value;
    
    if (prevVal > 0) {
      trendValue = ((currentVal - prevVal) / prevVal) * 100;
      // Allow even small trends to be visible unless it's within the 0.5% tolerance
      if (Math.abs(trendValue) < 0.5) {
        trendDirection = 'neutral';
      } else {
        trendDirection = trendValue > 0 ? 'up' : 'down';
      }
    } else if (prevVal === 0 && currentVal > 0) {
        trendValue = 100;
        trendDirection = 'up';
    } else if (prevVal > 0 && currentVal === 0) {
        trendValue = -100;
        trendDirection = 'down';
    }
  } else if (currentIndex === 0 && historyChartData.length > 1) {
    // If it's the oldest entry, we could potentially show trend relative to the NEXT month
    // but usually trend is backward-looking. For now, keep it neutral or don't show.
  }

  // Chart data: trend of italianoTotal and totale per DDT
  const chartData = records.map(r => ({
    name: r.number,
    nostrano: r.italianoTotal,
    totale: r.imponibileTotal,
    date: r.date
  })); 

  const handleExportPDF = async () => {
    if (!hasData || records.length === 0) return;
    
    const doc = new jsPDF();
    const afterDiscount = totItaliano * (1 - (settings.deductionRate / 100));
    const finalAfterDiscount = Math.round(afterDiscount * 100) / 100;
    const scorporoValue = Math.round((totItaliano - finalAfterDiscount) * 100) / 100;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(2, 132, 199); // Sky-600 Marine Blue
    doc.setFont("helvetica", "bold");
    doc.text(`Riepilogo Provvigioni`, 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.setFont("helvetica", "normal");
    doc.text(`${monthName} ${year}`, 14, 32);
    
    // Line separator
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 38, 196, 38);

    // Summary Details
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Imponibile Totale Generale:`, 14, 48);
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 48);
    
    doc.setTextColor(100);
    doc.text(`Imponibile Prodotti Nostrani:`, 14, 54);
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${totItaliano.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 54);

    doc.setTextColor(100);
    doc.text(`Scorporo (${settings.deductionRate}%):`, 14, 60);
    doc.setTextColor(180, 0, 0); // Red for deduction
    doc.text(`- € ${scorporoValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 60);

    doc.setTextColor(100);
    doc.text(`Imponibile Netto Provvigionale:`, 14, 66);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text(`€ ${finalAfterDiscount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 66);
    
    // Highlighted Commission Box
    doc.setFillColor(240, 249, 255); // Sky-50
    doc.roundedRect(14, 74, 182, 18, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setTextColor(2, 132, 199);
    doc.text(`PROVVIGIONE TOTALE (${settings.commissionRate}%):`, 18, 85);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`€ ${monthlyCommission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 130, 85);
    
    const tableData = records.map(r => [
      r.number,
      r.date,
      `€ ${r.imponibileTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      `€ ${r.italianoTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    ]);
    
    autoTable(doc, {
      startY: 100,
      head: [['N. D.D.T.', 'Data', 'Imponibile', 'Imp. Nostrano']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [2, 132, 199], halign: 'center', fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      styles: { fontSize: 9, cellPadding: 2, minCellHeight: 0 }
    });
    
    const pdfBlob = doc.output('blob');
    await triggerDownload(pdfBlob, `Provvigioni_${monthName}_${year}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!hasData || records.length === 0) return;
    
    // Create the main data rows
    const data = records.map(r => {
      // Remove dots (thousands separators) from the number if it's a string
      const cleanNumber = r.number.replace(/\./g, '');
      return {
        'N. D.D.T.': isNaN(Number(cleanNumber)) ? cleanNumber : Number(cleanNumber),
        'Data': r.date,
        'Imponibile': r.imponibileTotal,
        'Imponibile Nostrano': r.italianoTotal
      };
    });
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const lastRow = data.length + 1; // +1 for header
    
    // Add Summary rows with formulas
    const summaryStartRow = lastRow + 2;
    
    // Totals title
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['RIEPILOGO FINALE', '', '', ''],
      ['TOTALE GENERALE', '', { f: `SUM(C2:C${lastRow})` }, { f: `SUM(D2:D${lastRow})` }],
      [`SCORPORO (${settings.deductionRate}%)`, '', '', { f: `D${summaryStartRow + 1} * ${settings.deductionRate / 100}` }],
      ['IMPONIBILE NETTO', '', '', { f: `D${summaryStartRow + 1} - D${summaryStartRow + 2}` }],
      [`PROVVIGIONE (${settings.commissionRate}%)`, '', '', { f: `D${summaryStartRow + 3} * ${settings.commissionRate / 100}` }]
    ], { origin: `A${summaryStartRow}` });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registro Vendite");
    
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const excelBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await triggerDownload(excelBlob, `Registro_Vendite_${monthName}_${year}.xlsx`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length >= 2) {
      return (
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-2xl border border-sky-100 dark:border-sky-800 space-y-3 min-w-[180px]">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b dark:border-sky-800 pb-2">DDT n. {label}</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-sky-500" />
                <span className="text-[10px] font-bold text-sky-500 uppercase">Nostrano</span>
              </div>
              <span className="text-sm font-black text-sky-600 dark:text-sky-400">
                € {payload[1].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Totale</span>
              </div>
              <span className="text-sm font-black text-slate-600 dark:text-slate-300">
                € {payload[0].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <ScrollRestorer screenName="home" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Commission Highlight Card */}
          <div className="bg-gradient-to-br from-sky-600 to-sky-800 rounded-3xl p-6 text-white shadow-2xl shadow-sky-500/30 relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-sky-900/40 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sky-100/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">Provvigione {monthName} {year}</p>
                  <h2 className="text-4xl font-black tracking-tight">
                    € {monthlyCommission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                </div>
                <div className={`px-3 py-2 rounded-xl backdrop-blur-md flex items-center gap-1.5 border border-white/10 ${trendDirection === 'up' ? 'bg-emerald-500/20 text-emerald-300' : trendDirection === 'down' ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/60'}`}>
                  {trendDirection === 'up' && <TrendingUp size={18} className="text-emerald-400" />}
                  {trendDirection === 'down' && <TrendingDown size={18} className="text-rose-400" />}
                  {trendDirection === 'neutral' && <MoreHorizontal size={18} />}
                  
                  <span className="text-[10px] font-black tracking-wider">
                    {trendDirection === 'neutral' ? '0.0%' : `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-4 items-center mb-8">
                <div className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                  <Percent size={12} className="text-sky-200" />
                  <span className="text-[10px] font-black">{settings.commissionRate}% PREMIO</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <p className="text-[10px] text-sky-100/60 font-medium leading-tight">
                  Calcolato su Totale Nostrano <br /> al netto del {settings.deductionRate}%
                </p>
              </div>
            </div>

            {/* History Bar Chart Mini Component */}
            {historyChartData.length > 0 && (
              <div ref={scrollContainerRef} className="relative z-10 w-full overflow-x-auto no-scrollbar scroll-smooth">
                <div className="flex items-end h-24 gap-[4px] px-1 min-w-full pb-1">
                  {historyChartData.map((data) => {
                    // Find max to scale relatively
                    const maxVal = Math.max(...historyChartData.map(d => d.value));
                    const percentage = (data.value / maxVal) * 100;
                    const isSelected = data.fullName.toLowerCase() === monthName.toLowerCase() && data.year === year;
                    
                    return (
                      <button 
                        key={`${data.fullName}-${data.year}`} 
                        data-active={isSelected ? "true" : "false"}
                        onClick={(e) => {
                          const container = e.currentTarget.closest('.overflow-x-auto');
                          if (container) {
                            const scrollLeft = e.currentTarget.offsetLeft - (container.clientWidth / 2) + (e.currentTarget.clientWidth / 2);
                            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                          }
                          onLoadEntry(data.entry);
                        }}
                        className="flex-1 min-w-[44px] flex flex-col items-center gap-1.5 group cursor-pointer border-none bg-transparent p-0 outline-none"
                      >
                        <div className="w-full relative flex items-end justify-center h-16">
                           <motion.div 
                             initial={{ height: 0 }}
                             animate={{ height: `${percentage}%` }}
                             className={`w-full max-w-[44px] rounded-t-[3px] transition-all duration-300 ${isSelected ? 'bg-white origin-bottom' : 'bg-white/20 hover:bg-white/40'}`}
                           />
                        </div>
                        <span className={`text-[9px] font-bold transition-colors ${isSelected ? 'text-white' : 'text-sky-200/50 hover:text-white'}`}>
                          {data.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          {/* Analytics Chart */}
          <div className="bg-white dark:bg-sky-900 rounded-2xl p-5 shadow-sm border border-sky-100/50 dark:border-sky-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Andamento vendite giornaliero</h3>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">Trend</span>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length > 0 ? chartData : [{ name: '', nostrano: 0, totale: 0, date: '' }]}>
                  <defs>
                    <linearGradient id="colorNostrano" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTotale" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    hide 
                  />
                  <YAxis 
                    hide 
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="totale" 
                    stroke="#0284c7" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTotale)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="nostrano" 
                    stroke="#0d9488" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorNostrano)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>


      {/* Commission Table */}
      <div className="bg-white dark:bg-sky-900 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-4 justify-between items-start border-b border-sky-50 dark:border-sky-800">
          <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 tracking-tight flex-1 min-w-[120px]">Registro Vendite</h3>
          <div className="flex gap-2 flex-shrink-0">
            <button 
              disabled={!hasData}
              onClick={handleExportPDF}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${hasData ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 shadow-sm active:scale-95' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'}`}
              title="Esporta PDF"
            >
              <FileText size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">PDF</span>
            </button>
            <button 
              disabled={!hasData}
              onClick={handleExportExcel}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${hasData ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm active:scale-95' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'}`}
              title="Esporta Excel"
            >
              <Zap size={14} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wider">EXCEL</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar min-h-[400px]">
          {hasData ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">N. D.D.T.</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Data</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Imponibile</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-primary text-right whitespace-nowrap">Imp. nostrano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {records.map((row) => (
                   <tr key={row.number} className="hover:bg-sky-50/20 dark:hover:bg-sky-900/10 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {row.number}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 text-xs text-right numeric-data font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      € {row.imponibileTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold numeric-data inline-block">
                        € {row.italianoTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-slate-300 dark:text-slate-600" size={32} />
              </div>
              <p className="text-slate-400 dark:text-slate-400 font-medium text-sm">Nessun dato analizzato</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-500 uppercase tracking-widest mt-1">Carica un PDF per iniziare</p>
            </div>
          )}
        </div>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-slate-500">Imponibile totale</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            € {totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-sky-900 p-4 rounded-2xl shadow-sm border border-sky-100/50 dark:border-sky-800">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Imponibile nostrano totale</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            € {totItaliano.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </motion.div>

  );
}

function AnalysisScreen({ 
  progress, 
  overallProgress,
  currentFile,
  totalFiles,
  fileName 
}: { 
  progress: number; 
  overallProgress: number;
  currentFile: number;
  totalFiles: number;
  fileName: string; 
  key?: React.Key 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-6"
    >
      <ScrollRestorer screenName="analysis" />
      <div className="relative mb-8">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-sky-50 dark:text-sky-800"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 70}
            strokeDashoffset={2 * Math.PI * 70 * (1 - overallProgress / 100)}
            strokeLinecap="round"
            className="text-primary transition-all duration-300"
          />
          
          <circle
            cx="80"
            cy="80"
            r="55"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-sky-50/50 dark:text-sky-800/50"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="55"
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={2 * Math.PI * 55}
            strokeDashoffset={2 * Math.PI * 55 * (1 - progress / 100)}
            strokeLinecap="round"
            className="text-secondary transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white dark:bg-sky-900 w-24 h-24 rounded-full shadow-2xl flex flex-col items-center justify-center border border-sky-50 dark:border-sky-800">
             <Sparkles className="text-primary mb-0.5" size={20} />
             <span className="text-xl font-black text-slate-800 dark:text-white">{Math.round(overallProgress)}%</span>
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Totale</span>
          </div>
        </div>
      </div>

      <div className="text-center space-y-3 mb-10">
        <h2 className="text-2xl font-black tracking-tight dark:text-white">
          Analisi Multipla in Corso
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm px-10 leading-relaxed">
          File <span className="font-bold text-primary">{currentFile}</span> di <span className="font-bold text-slate-900 dark:text-slate-200">{totalFiles}</span>. 
          Stiamo elaborando i dati estratti per massimizzare la precisione.
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-sky-900 p-5 rounded-3xl border border-sky-100/50 dark:border-sky-800 flex flex-col gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-primary">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">FILE CORRENTE</p>
            <p className="text-xs font-bold truncate dark:text-white">{fileName}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-sky-900 p-5 rounded-3xl border border-sky-100/50 dark:border-sky-800 flex flex-col gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-secondary">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STIMA TOTALE</p>
            <p className="text-xs font-bold dark:text-white">~ {totalFiles * 3} secondi</p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-6 px-1">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>PROGRESSO FILE ({currentFile}/{totalFiles})</span>
            <span className="text-secondary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <span>PROGRESSO TOTALE</span>
            <span className="text-primary">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full p-1 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsScreen({ 
  onBack, 
  useSystemTheme, 
  setUseSystemTheme, 
  isDarkMode, 
  setIsDarkMode,
  settings,
  setSettings,
  onReset
}: { 
  onBack: () => void;
  useSystemTheme: boolean;
  setUseSystemTheme: (v: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onReset: () => void;
  key?: React.Key;
}) {
  const [keywordInput, setKeywordInput] = useState('');

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.italianKeywords.includes(keywordInput.trim())) {
      setSettings(prev => ({
        ...prev,
        italianKeywords: [...prev.italianKeywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setSettings(prev => ({
      ...prev,
      italianKeywords: prev.italianKeywords.filter(k => k !== kw)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6 py-4 pb-12"
    >
      <ScrollRestorer screenName="settings" />
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white dark:bg-sky-900 rounded-xl shadow-sm border dark:border-sky-800 text-sky-600 dark:text-sky-400">
            <HomeIcon size={20} />
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Impostazioni</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commission Calculation Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="text-primary" size={18} />
              Calcolo Provvigioni
            </h3>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, commissionRate: DEFAULT_SETTINGS.commissionRate, deductionRate: DEFAULT_SETTINGS.deductionRate }))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
            >
              <RotateCcw size={14} />
              Ripristina
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Percentuale Provvigione (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.commissionRate}
                    onChange={(e) => setSettings(prev => ({ ...prev, commissionRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Scorporo dal Totale (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    value={settings.deductionRate}
                    onChange={(e) => setSettings(prev => ({ ...prev, deductionRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                  <TrendingDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keywords Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm h-full">
          <div className="p-4 border-b dark:border-slate-800 flex justify-between items-start">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-tertiary" size={18} />
                Parole chiave nostrano
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Ricarica il pdf per i nuovi calcoli. Non ha effetto sullo storico.
              </p>
            </div>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, italianKeywords: [...DEFAULT_SETTINGS.italianKeywords] }))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors whitespace-nowrap"
            >
              <RotateCcw size={14} />
              Ripristina
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Aggiungi parola chiave..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button 
                onClick={addKeyword}
                className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.italianKeywords.map(kw => (
                <span 
                  key={kw} 
                  className="bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-100 dark:border-sky-900/50 flex items-center gap-2 animate-in fade-in zoom-in"
                >
                  {kw}
                  <button 
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                </span>
              ))}
              {settings.italianKeywords.length === 0 && (
                <p className="text-xs text-slate-400 italic">Nessuna parola chiave impostata</p>
              )}
            </div>
          </div>
        </div>
      </div>


      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="text-secondary" size={20} />
            Grafica
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* System Theme Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Usa tema di sistema</p>
              <p className="text-xs text-slate-500">Adatta l'aspetto dell'app alle impostazioni del dispositivo</p>
            </div>
            <button 
              onClick={() => setUseSystemTheme(!useSystemTheme)}
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${useSystemTheme ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <motion.div 
                animate={{ x: useSystemTheme ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-md"
              />
            </button>
          </div>

          {/* Manual Theme Toggle */}
          <div className={`flex items-center justify-between transition-all duration-300 ${useSystemTheme ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Modalità scura</p>
              <p className="text-xs text-slate-500">Passa manualmente tra tema chiaro e scuro</p>
            </div>
            <button 
              disabled={useSystemTheme}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`shrink-0 w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${isDarkMode ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <motion.div 
                animate={{ x: isDarkMode ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-md"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={onReset}
          className="group flex items-center gap-3 px-8 py-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-sm border border-red-100 dark:border-red-900/50"
        >
          <RotateCcw size={16} className="group-hover:rotate-[-45deg] transition-transform" />
          Ripristina Applicazione
        </button>
      </div>

      <div className="bg-sky-50/30 dark:bg-sky-800/30 p-6 rounded-3xl text-center space-y-2 border border-dashed border-sky-100 dark:border-sky-800">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">App Version</p>
        <p className="text-sm font-black text-sky-400">v{packageJson.version}</p>
      </div>
    </motion.div>
  );
}

function HistoryScreen({ 
  history, 
  onEntryClick, 
  onDeleteEntry,
  onClear 
}: { 
  history: HistoryEntry[]; 
  onEntryClick: (entry: HistoryEntry) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  onClear: () => void;
  key?: React.Key;
}) {
  // Group history by year
  const groupedHistory = history.reduce((acc, entry) => {
    const year = entry.year || new Date(entry.timestamp).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {} as Record<number, HistoryEntry[]>);

  // Sort years descending
  const sortedYears = Object.keys(groupedHistory)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 py-4"
    >
      <ScrollRestorer screenName="history" />
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white lowercase first-letter:uppercase">Storico</h2>
          <p className="text-xs text-slate-500 font-medium lowercase first-letter:uppercase">Tutte le tue analisi salvate</p>
        </div>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-xl transition-colors hover:bg-red-100"
          >
            Svuota tutto
          </button>
        )}
      </div>

      <div className="space-y-8 py-3">
        {sortedYears.length > 0 ? (
          sortedYears.map((year) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-4 px-2">
                <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{year}</h3>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedHistory[year]
                  .sort((a, b) => {
                    const idxA = ITALIAN_MONTHS.indexOf(a.monthName.toLowerCase());
                    const idxB = ITALIAN_MONTHS.indexOf(b.monthName.toLowerCase());
                    return idxB - idxA;
                  })
                  .map((entry) => (
                    <motion.div 
                      key={entry.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onEntryClick(entry)}
                      className="group relative cursor-pointer bg-white dark:bg-sky-900 p-4 rounded-2xl border border-sky-100/50 dark:border-sky-800 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white capitalize">{entry.monthName}</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[80px] md:max-w-[120px]">{entry.fileName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">€ {entry.commission.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Nostrano: € {entry.totalItalian.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        </div>
                        <button 
                          onClick={(e) => onDeleteEntry(entry.id, e)}
                          className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white active:scale-90 z-10 shadow-sm border border-red-100 dark:border-red-500/20"
                          title="Elimina analisi"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <History size={32} />
            </div>
            <p className="text-sm font-bold text-slate-500">Nessuna analisi salvata</p>
            <p className="text-[10px] uppercase tracking-widest mt-1">Carica un PDF per iniziare lo storico</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="p-6 bg-sky-50/30 dark:bg-sky-800/20 rounded-3xl border border-sky-100/50 dark:border-sky-800/50">
          <div className="flex items-start gap-3">
            <Info className="text-primary mt-0.5" size={16} />
            <p className="text-[11px] text-sky-900/60 dark:text-sky-300/60 font-medium leading-relaxed">
              I dati sono salvati localmente sul tuo dispositivo. Se cancelli la cache dell'app, lo storico andrà perso.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
