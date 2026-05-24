/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  History,
  Home as HomeIcon,
  Info,
  LineChart as LineChartIcon,
  Pencil,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
  User
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@capgo/capacitor-navigation-bar';
import { parseCommissionPDF, type DDTRecord } from './services/pdfService';
import { DEFAULT_SETTINGS, ITALIAN_MONTHS, extractMonthFromFilename } from './constants';
import type { AppSettings, HistoryEntry, Screen } from './types';
import NavButton from './components/NavButton';
import { scrollPositionsCache } from './components/ScrollRestorer';
import AnalysisScreen from './screens/AnalysisScreen';
import ChartsScreen from './screens/ChartsScreen';
import HistoryScreen from './screens/HistoryScreen';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';

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
