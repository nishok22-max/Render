import { Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Header } from '../components/navbar/Header';
import { ToastContainer } from '../components/shared/ToastContainer';
import { useUIStore } from '../store/uiStore';

export const MainLayout = () => {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 selection:text-primary">
      <Sidebar />

      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex flex-col relative z-10 min-h-screen"
      >
        <Header />

        <main className="mt-16 flex-1">
          <Outlet />
        </main>
      </motion.div>

      <ToastContainer />
    </div>
  );
};
