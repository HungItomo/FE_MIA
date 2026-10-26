import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import App from './App.jsx';
import 'antd/dist/reset.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#375d50',
          colorInfo: '#375d50',
          colorText: '#26312f',
          colorTextSecondary: '#87928b',
          colorBgLayout: '#f5f1e9',
          colorBgContainer: '#fffdf9',
          borderRadius: 12,
          fontFamily: 'DM Sans, sans-serif',
        },
        components: {
          Card: { headerBg: 'transparent' },
          Button: { controlHeightLG: 46 },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
