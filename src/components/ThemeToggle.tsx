// ============================================================================
// DARSCHYN (درس‌چین) - Theme Toggle Component
// ============================================================================

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'روشن', icon: <Sun className="w-4 h-4" /> },
    { mode: 'system', label: 'سیستم', icon: <Laptop className="w-4 h-4" /> },
    { mode: 'dark', label: 'تاریک', icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <div
      id="themeToggleGroup"
      className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg border border-slate-300/60 dark:border-slate-700"
    >
      {options.map((opt) => {
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            id={`themeBtn-${opt.mode}`}
            onClick={() => setTheme(opt.mode)}
            title={`حالت ${opt.label}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
