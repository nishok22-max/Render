import { LucideIcon, Space, LayoutDashboard, LibraryBig, Cpu, Share2, Settings, HelpCircle, User, Plus, Brain } from 'lucide-react';
import { motion } from 'motion/react';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

const NavItem = ({ icon: Icon, label, active }: NavItemProps) => (
  <motion.a
    href="#"
    whileHover={{ x: 6, opacity: 1 }}
    className={`flex items-center gap-4 py-2 px-1 font-sans transition-all duration-500 overflow-hidden ${
      active
        ? 'text-primary opacity-100 font-semibold'
        : 'text-white opacity-40 hover:opacity-100'
    }`}
  >
    <div className={`relative ${active ? 'animate-pulse-soft' : ''}`}>
      <Icon className={`w-4 h-4 ${active ? 'fill-primary/20' : ''}`} />
    </div>
    <span className="text-[11px] uppercase tracking-[0.2em]">{label}</span>
    {active && (
      <motion.div 
        layoutId="active-nav"
        className="w-1 h-3 bg-primary rounded-full ml-auto" 
      />
    )}
  </motion.a>
);

export const Sidebar = () => {
  return (
    <nav className="h-screen w-64 fixed left-0 top-0 bg-background border-r border-white/5 flex flex-col p-6 z-50">
      <div className="flex items-center gap-4 mb-14 px-1 pt-2">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
           <Brain className="w-5 h-5 text-text-primary" />
        </div>
        <div>
          <h1 className="font-sans text-xl font-bold text-text-primary tracking-tight">ThinkSync <span className="text-text-secondary font-medium">OS</span></h1>
          <p className="text-[10px] text-text-tertiary uppercase tracking-widest font-medium mt-0.5">Quantum Core</p>
        </div>
      </div>

      <button className="mb-10 w-full py-4 px-4 bg-primary text-background font-mono text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 hover:bg-white transition-all duration-500 shadow-2xl active:scale-95 group">
        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
        New Research
      </button>

      <div className="flex-1 flex flex-col gap-2">
        <NavItem icon={LayoutDashboard} label="Workspace" active />
        <NavItem icon={LibraryBig} label="Archive" />
        <NavItem icon={Cpu} label="Neural Engine" />
        <NavItem icon={Share2} label="Network" />
        <NavItem icon={Settings} label="Settings" />
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-white/5 pt-6">
        <NavItem icon={HelpCircle} label="Documentation" />
        <NavItem icon={User} label="Researcher" />
      </div>
    </nav>
  );
};
