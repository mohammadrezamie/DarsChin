import React from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
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
      <div className="relative flex h-11 w-[116px] shrink-0 items-center rounded-xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:hidden">
        <span className="pointer-events-none absolute right-2.5 flex items-center text-blue-600 dark:text-blue-300" aria-hidden="true">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </span>
        <select
          aria-label="انتخاب حالت نمایش"
          title="حالت روز، خودکار یا شب"
          value={theme}
          onChange={event => setTheme(event.target.value as ThemeMode)}
          className="h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent pr-9 pl-6 text-right text-xs font-extrabold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-100"
        >
          <option value="light">روز</option>
          <option value="system">خودکار</option>
          <option value="dark">شب</option>
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
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
            className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${theme === option.mode
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
