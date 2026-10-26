import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

/** Always-visible mode control on desktop and small RTL mobile headers. */
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'روز', icon: <Sun aria-hidden="true" className="h-4 w-4" /> },
    { mode: 'system', label: 'خودکار', icon: <Monitor aria-hidden="true" className="h-4 w-4" /> },
    { mode: 'dark', label: 'شب', icon: <Moon aria-hidden="true" className="h-4 w-4" /> },
  ];
  return (
    <>
      {/* Compact 44px native picker: the previous 116px control pushed the
          login CTA out of 320px mobile headers. The entire icon is tappable. */}
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-blue-700 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 sm:hidden">
        <span className="pointer-events-none" aria-hidden="true">
          {theme === 'dark' ? <Moon className="h-5 w-5" /> : theme === 'light' ? <Sun className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </span>
        <select
          aria-label="انتخاب حالت نمایش"
          title={`حالت نمایش: ${options.find(option => option.mode === theme)?.label || 'خودکار'}`}
          value={theme}
          onChange={event => setTheme(event.target.value as ThemeMode)}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl opacity-0"
        >
          <option value="light">روز</option>
          <option value="system">خودکار</option>
          <option value="dark">شب</option>
        </select>
      </div>
      <div role="group" aria-label="انتخاب حالت نمایش" className="hidden items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-inner shadow-slate-950/5 dark:border-slate-700 dark:bg-slate-800 sm:inline-flex">
        {options.map(option => (
          <button
            key={option.mode}
            type="button"
            id={`themeBtn-${option.mode}`}
            title={`حالت ${option.label}`}
            aria-label={`حالت ${option.label}`}
            aria-pressed={theme === option.mode}
            onClick={() => setTheme(option.mode)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${theme === option.mode
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
          >
            {option.icon}
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};
