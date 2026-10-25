import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'روز', icon: <Sun aria-hidden="true" className="h-4 w-4" /> },
    { mode: 'system', label: 'خودکار', icon: <Monitor aria-hidden="true" className="h-4 w-4" /> },
    { mode: 'dark', label: 'شب', icon: <Moon aria-hidden="true" className="h-4 w-4" /> },
  ];
  return (
    <div role="group" aria-label="انتخاب حالت نمایش" className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
      {options.map(option => (
        <button
          key={option.mode}
          type="button"
          id={`themeBtn-${option.mode}`}
          title={`حالت ${option.label}`}
          aria-label={`حالت ${option.label}`}
          aria-pressed={theme === option.mode}
          onClick={() => setTheme(option.mode)}
          className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-2.5 ${theme === option.mode
            ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
        >
          {option.icon}
          <span className="hidden lg:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
};
