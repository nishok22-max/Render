import { useUIStore } from '../../store/uiStore';

export const Header = () => {
  const { sidebarCollapsed } = useUIStore();

  return (
    <header
      className="fixed top-0 right-0 h-14 bg-background border-b border-border flex justify-end items-center px-6 z-40 transition-all duration-200"
      style={{ width: `calc(100% - ${sidebarCollapsed ? 72 : 256}px)` }}
    >
    </header>
  );
};
