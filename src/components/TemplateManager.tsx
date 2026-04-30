// src/components/TemplateManager.tsx
// 档案类型模板管理（新建/编辑/删除/切换）——最小化可用版本

import { useEffect, useState } from 'react';

interface ArchiveTemplate {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_builtin: boolean;
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ArchiveTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTemplates() {
    try {
      const { invoke } = await import('@tauri-apps/api');
      const result = await invoke<ArchiveTemplate[]>('list_templates');
      setTemplates(result);
    } catch (e) {
      console.warn('加载模板失败（前端独立模式）', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  if (loading) return <p>加载模板中...</p>;

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>档案类型模板</h2>
      {templates.length === 0 ? (
        <p>暂无模板数据（后端未连接或数据库未初始化）</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>代码</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>名称</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>类型</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.code}</td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>{t.name}</td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>
                  {t.is_builtin ? '内置' : '自定义'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
