import { Search, BellOff, Activity, Zap, User } from 'lucide-react';
import { motion } from 'motion/react';

export const Header = () => {
  return (
    <header className="fixed top-0 right-0 left-64 h-24 bg-background/50 backdrop-blur-md border-b border-white/5 shadow-sm flex justify-between items-center px-12 w-[calc(100%-16rem)] z-40">
      <nav className="flex gap-10">
        {['System', 'Network', 'Quantum', 'Journal'].map((link) => (
          <a
            key={link}
            className="font-sans text-[11px] uppercase tracking-[0.4em] text-white opacity-40 hover:opacity-100 hover:text-primary transition-all cursor-pointer font-semibold"
          >
            {link}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-10">
        <div className="relative w-72 bg-white/3 rounded-sm flex items-center px-4 py-2 halo-focus border border-white/5">
          <Search className="w-3.5 h-3.5 text-white/20 mr-3" />
          <input
            className="bg-transparent border-none outline-none w-full font-sans text-[11px] uppercase tracking-widest text-on-surface placeholder:text-white/10 p-0 focus:ring-0"
            placeholder="Search Neural Core..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-4">
          {[BellOff, Activity, Zap].map((Icon, i) => (
            <button
              key={i}
              className="h-10 w-10 flex items-center justify-center text-white/30 hover:text-primary transition-all cursor-pointer relative group"
            >
              {i === 1 && (
                <span className="absolute top-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 ml-2">
          <div className="w-8 h-[1px] bg-white/10" />
          <div className="h-8 w-8 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center cursor-pointer group hover:border-primary/40 transition-all">
             <User className="w-3.5 h-3.5 text-white/40 group-hover:text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
};
