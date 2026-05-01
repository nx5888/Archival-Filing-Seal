// src/App.tsx
// 电子档案归档章印制工具 - 主界面

import { useEffect, useState } from 'react';
import TemplateManager from './components/TemplateManager';
import SealManager from './components/SealManager';

function App() {
  const [greeting, setGreeting] = useState<string>('正在启动...');

  useEffect(() => {
    // 调用后端命令测试连接
    async function init() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('list_templates');
        setGreeting('电子档案归档章印制工具 - 已连接后端');
      } catch {
        setGreeting('电子档案归档章印制工具 - 前端独立模式');
      }
    }
    init();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>电子档案归档章印制工具</h1>
      <p>{greeting}</p>
      <hr />
      <TemplateManager />
      <SealManager />
    </div>
  );
}

export default App;
