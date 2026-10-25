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
      <select
        aria-label="انتخاب حالت نمایش"
        title="روز، خودکار یا شب"
        value={theme}
        onChange={event => setTheme(event.target.value as ThemeMode)}
        className="min-h-11 w-[104px] rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:hidden"
      >
        <option value="light">روز</option>
        <option value="system">خودکار</option>
        <option value="dark">شب</option>
      </select>
      <div role="group" aria-label="انتخاب حالت نمایش" className="hidden items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800 sm:inline-flex">
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
