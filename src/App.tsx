// src/App.tsx
// 电子档案归档章印制工具 - 主界面（完整版）
// 遵循方案 v3.1 架构

import { useState, useEffect, useCallback } from 'react';
import TemplateManager from './components/TemplateManager';
import StampSchemaEditor from './components/StampSchemaEditor';
import type { StampSchema } from './types/stamp';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'config' | 'stamp' | 'pagenum' | 'process'>('config');
  // 归档章 Schema（从模板加载或自定义编辑）
  const [stampSchema, setStampSchema] = useState<StampSchema | null>(null);

  // 测试后端连接
  useEffect(() => {
    async function init() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('list_templates');
        setConnected(true);
      } catch {
        setConnected(false);
      }
    }
    init();
  }, []);

  // 从 StampSchemaEditor 回调接收更新后的 Schema
  const handleStampSchemaChange = useCallback((schema: StampSchema) => {
    setStampSchema(schema);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: '-apple-system, "Microsoft YaHei", "SimSun", sans-serif',
      fontSize: 13,
      background: '#f0f2f5',
      color: '#333',
    }}>
      {/* ===== 顶部工具栏 ===== */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', background: '#fff', borderBottom: '1px solid #d9d9d9',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1890ff' }}>
            📋 电子档案归档章印制工具
          </h1>
          {connected !== null && (
            <span style={{
              padding: '2px 10px', borderRadius: 10, fontSize: 11,
              background: connected ? '#f6ffed' : '#fff2f0',
              color: connected ? '#52c41a' : '#ff4d4f',
              border: `1px solid ${connected ? '#b7eb8f' : '#ffccc7'}`,
            }}>
              {connected ? '● 后端已连接' : '○ 前端独立模式'}
            </span>
          )}
        </div>

        {/* 工具栏按钮组 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle}>📂 选择目录</button>
          <button style={btnStyle}>▶ 开始处理</button>
          <button style={{ ...btnStyle, opacity: 0.5 }} disabled>⚙ 设置</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ===== 左侧导航 ===== */}
        <aside style={{
          width: 180, background: '#fff', borderRight: '1px solid #e8e8e8',
          padding: '12px 0', display: 'flex', flexDirection: 'column',
        }}>
          <nav>
            {[
              { key: 'config' as const, icon: '📝', label: '配置面板 (A/B/C)' },
              { key: 'stamp' as const, icon: '🔲', label: '归档章编辑器' },
              { key: 'pagenum' as const, icon: '📄', label: '页码设置' },
              { key: 'process' as const, icon: '🚀', label: '批次与预览' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveMainTab(tab.key)}
                style={{
                  display: 'block', width: '100%', padding: '10px 20px',
                  border: 'none', background: activeMainTab === tab.key ? '#e6f7ff' : 'transparent',
                  color: activeMainTab === tab.key ? '#1890ff' : '#555',
                  cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  fontWeight: activeMainTab === tab.key ? 600 : 400,
                  borderLeft: activeMainTab === tab.key ? '3px solid #1890ff' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>

          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #f0f0f0' }}>
            <TemplateManager />
          </div>
        </aside>

        {/* ===== 主内容区 ===== */}
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeMainTab === 'config' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>配置面板</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* A 区：全局固化值 */}
                <section style={{
                  background: '#fff', borderRadius: 6, padding: 16,
                  border: '1px solid #e8e8e8',
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#1890ff' }}>
                    📌 A 区 — 全局固化值
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>
                    兜底数据——无法从文件名或路径解析时使用此处的值。
                  </p>
                  <ConfigField label="全宗号" placeholder="如 0226" defaultValue="" />
                  <ConfigField label="默认保管期限" type="select"
                    options={['永久', '30年', '10年', '3年']} defaultValue="永久" />
                  <ConfigField label="默认年度" type="number"
                    defaultValue={new Date().getFullYear().toString()} />
                  <ConfigField label="归档章 X 偏移(mm)" type="number" defaultValue="5" />
                  <ConfigField label="归档章 Y 偏移(mm)" type="number" defaultValue="5" />

                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button style={btnStyle}>💾 保存为配置方案</button>
                    <button style={{ ...btnStyle, background: '#fff', color: '#666', border: '1px solid #d9d9d9' }}>
                      📂 加载方案
                    </button>
                  </div>
                </section>

                {/* B + C 区 */}
                <section style={{
                  background: '#fff', borderRadius: 6, padding: 16,
                  border: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  {/* B 区：文件夹映射 */}
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#52c41a' }}>
                      📁 B 区 — 文件夹结构映射
                    </h3>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>
                      粘贴示例路径，自动拆分层级并映射字段含义
                    </p>
                    <input
                      style={inputStyle}
                      placeholder="粘贴完整文件路径，如 D:\档案加工\2024年\文书档案\永久\办公室\001号.pdf"
                    />
                    <FolderMappingHint />
                  </div>

                  {/* C 区：文件名解析 */}
                  <div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#faad14' }}>
                      🔍 C 区 — 文件名正则解析
                    </h3>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>
                      输入示例文件名，生成正则并实时预览解析结果
                    </p>
                    <input
                      style={inputStyle}
                      placeholder="输入示例文件名，如 0226-GL,2021-D30-0001.pdf"
                    />
                    <RegexPreviewHint />
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeMainTab === 'stamp' && (
            <StampSchemaEditor
              schema={stampSchema ?? undefined}
              onChange={handleStampSchemaChange}
            />
          )}

          {activeMainTab === 'pagenum' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>📄 页码设置</h2>
              <p style={{ color: '#888', marginBottom: 16 }}>
                页码功能完全遵循 §0 全自定义原则——范围、格式、位置、外观均可配置。
              </p>
              <PageNumberPlaceholder />
            </div>
          )}

          {activeMainTab === 'process' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>🚀 批次管理与文件预览</h2>
              <BatchPlaceholder />
              <FilePreviewPlaceholder />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============ 小型辅助组件（后续替换为独立组件） ============

interface ConfigFieldProps {
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
}

function ConfigField({ label, type = 'text', options, defaultValue = '', placeholder }: ConfigFieldProps) {
  return (
    <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 13 }}>{label}</label>
      {type === 'select' ? (
        <select style={inputStyle} defaultValue={defaultValue}>
          {(options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input type={type} style={inputStyle} defaultValue={defaultValue} placeholder={placeholder} />
      )}
    </div>
  );
}

function FolderMappingHint() {
  return (
    <div style={{
      marginTop: 8, padding: 8, background: '#f6ffed', borderRadius: 4,
      border: '1px solid #b7eb8f', fontSize: 11, color: '#389e0d',
    }}>
      💡 提示：程序会自动检测文件夹层级规律并建议默认映射。支持的字段含义：
      年度 / 全宗号 / 保管期限 / 机构或问题 / 忽略此级
    </div>
  );
}

function RegexPreviewHint() {
  return (
    <div style={{
      marginTop: 8, padding: 8, background: '#fffbe6', borderRadius: 4,
      border: '1px solid #ffe58f', fontSize: 11, color: '#d48806',
    }}>
      💡 提示：正则生成后允许手动微调。下方实时显示解析结果预览。
      支持中文匹配：`(?&lt;name&gt;[\w\u4e00-\u9fff]+)`
    </div>
  );
}

function PageNumberPlaceholder() {
  const items = [
    { label: '适用范围', values: ['全部文件', '仅已盖章文件', '指定文件'] },
    { label: '添加页面', values: ['全部页面', '跳过首页', '仅奇数页', '仅偶数页', '指定范围'] },
    { label: '编号规则', values: ['逐件重排', '连续编号', '起始号可调'] },
    { label: '显示格式', values: ['{current}', '第{current}页', '{current}/{total}', '自定义模板'] },
    { label: '位置', values: ['页眉/页脚', '左/中/右', '双面打印奇偶镜像'] },
    { label: '字体外观', values: ['字号/粗体/斜体', '颜色', '透明度 0-100%'] },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {items.map(item => (
        <div key={item.label} style={{
          padding: 14, background: '#fff', borderRadius: 6,
          border: '1px solid #e8e8e8',
        }}>
          <strong style={{ fontSize: 13, color: '#1890ff' }}>{item.label}</strong>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {item.values.map(v => (
              <span key={v} style={{
                padding: '2px 8px', fontSize: 11, background: '#f0f0f0',
                borderRadius: 3, color: '#666',
              }}>{v}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BatchPlaceholder() {
  return (
    <div style={{
      padding: 40, textAlign: 'center', background: '#fff',
      borderRadius: 6, border: '2px dashed #d9d9d9', marginBottom: 16,
    }}>
      <p style={{ fontSize: 32, margin: '0 0 8px' }}>📂</p>
      <p style={{ margin: 0, color: '#888' }}>选择根目录开始扫描，批次列表将在此展示</p>
    </div>
  );
}

function FilePreviewPlaceholder() {
  return (
    <div style={{
      padding: 40, textAlign: 'center', background: '#fff',
      borderRadius: 6, border: '2px dashed #d9d9d9',
    }}>
      <p style={{ fontSize: 32, margin: '0 0 8px' }}>📋</p>
      <p style={{ margin: 0, color: '#888' }}>扫描完成后，文件解析结果和字段预览表格将在此展示</p>
    </div>
  );
}

// ============ 样式常量 ============

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  background: '#1890ff',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  transition: 'background 0.15s',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 12,
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  boxSizing: 'border-box',
};

export default App;
