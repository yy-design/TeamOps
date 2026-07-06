import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import { AppRouter } from './router/AppRouter';
import { usePreferencesStore } from './store/preferencesStore';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function TeamOpsProviders() {
  const { mode, primaryColor, compact } = usePreferencesStore();
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm, ...(compact ? [theme.compactAlgorithm] : [])],
        token: {
          colorPrimary: primaryColor,
          colorInfo: '#0f766e',
          borderRadius: 6,
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        },
        components: {
          Layout: { siderBg: '#0f172a', headerBg: '#ffffff' },
          Menu: { darkItemBg: '#0f172a', darkSubMenuItemBg: '#111827' }
        }
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AppRouter />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TeamOpsProviders />
  </React.StrictMode>
);
