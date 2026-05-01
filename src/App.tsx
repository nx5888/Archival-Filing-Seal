// src/App.tsx
// 电子档案归档章印制工具 - 主界面 v2
// Phase 1+2: 集成全部组件 + 打通「选择目录→扫描→展示」链路
// 遵循方案 v3.1 架构

import { useState, useEffect, useCallback } from 'react';
import TemplateManager from './components/TemplateManager';
import StampSchemaEditor from './components/StampSchemaEditor';
import PageNumberPanel from './components/PageNumberPanel';
import BatchManager from './components/BatchManager';
import FilePreviewTable from './components/FilePreviewTable';
import type {
  StampSchema,
  ScanResult,
  BatchPreview,
  FilePreviewItem,
  PageNumberConfig,
} from './types/stamp';

function App() {
  // ---- 连接状态 ----
  const [connected, setConnected] = useState<boolean | null>(null);

  // ---- 导航 ----
  const [activeMainTab, setActiveMainTab] = useState<'config' | 'stamp' | 'pagenum' | 'process'>('config');

  // ---- 归档章 Schema ----
  const [stampSchema, setStampSchema] = useState<StampSchema | null>(null);

  // ---- 扫描结果（核心数据流）----
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rootPath, setRootPath] = useState<string>('');

  // ---- 页码配置 ----
  const [pageConfig, setPageConfig] = useState<PageNumberConfig | null>(null);

  // ---- A 区固化值 ----
  const [configValues, setConfigValues] = useState<Record<string, string>>({
    fonds: '',
    retention: '永久',
    year: new Date().getFullYear().toString(),
    offsetX: '5',
    offsetY: '5',
  });

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

  // ============ 核心操作：选择目录 + 扫描 ============

  const handleSelectDirectory = useCallback(async () => {
    try {
      // 打开目录选择（优先使用 Tauri 原生对话框，fallback 到手动输入）
      let selectedDir: string | null = null;

      // 尝试通过 Tauri invoke 调用文件系统对话框
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        selectedDir = await invoke<string | null>('dialog_open', {
          options: { directory: true, multiple: false },
        });
      } catch {
        // Tauri 不支持或未连接时，使用浏览器 prompt 输入路径
      }

      // 最终 fallback
      if (!selectedDir) {
        selectedDir = window.prompt('请输入要扫描的目录完整路径:', rootPath || 'D:\\');
      }

      if (!selectedDir) return;

      setRootPath(selectedDir);
      await performScan(selectedDir);
    } catch (err) {
      console.error('选择目录失败:', err);
      alert(`选择目录失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const performScan = useCallback(async (dirPath: string) => {
    if (!connected) {
      alert('后端未连接，无法扫描。请确认应用以 Tauri 模式运行。');
      return;
    }

    setScanning(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<ScanResult>('scan_directory', {
        rootPath: dirPath,
        templateId: 1, // 默认使用文书档案模板
        configJson: JSON.stringify(configValues),
      });
      setScanResult(result);
      // 自动切换到批次与预览 Tab
      setActiveMainTab('process');
    } catch (err) {
      console.error('扫描失败:', err);
      alert(`扫描失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [connected, configValues]);

  // 从扫描结果中提取扁平化文件列表（供 FilePreviewTable 使用）
  const flatFiles: FilePreviewItem[] = useCallback((): FilePreviewItem[] => {
    if (!scanResult) return [];
    return scanResult.batches.flatMap((batch: BatchPreview) =>
      batch.file_paths.map((filePath: string) => ({
        abs_path: filePath,
        file_path: filePath.replace(/^[A-Z]:[/\\]/i, '').replace(/^\\\\/, ''),
        extracted_fields: {},
        status: 'pending' as const,
        batch_name: batch.batch_name,
        error_msg: undefined,
      }))
    );
  }, [scanResult])();

  // ============ 回调处理 ============

  const handleStampSchemaChange = useCallback((schema: StampSchema) => {
    setStampSchema(schema);
  }, []);

  const handlePageConfigChange = useCallback((cfg: PageNumberConfig) => {
    setPageConfig(cfg);
  }, []);

  // A 区值变更
  const handleConfigChange = useCallback((key: string, value: string) => {
    setConfigValues(prev => ({ ...prev, [key]: value }));
  }, []);

  // 开始批量处理
  const handleStartProcessing = useCallback(async () => {
    if (!connected) {
      alert('后端未连接');
      return;
    }
    if (!scanResult || scanResult.batches.length === 0) {
      alert('请先扫描目录');
      return;
    }
    alert(`即将处理 ${scanResult.total_files} 个文件...\n（盖章核心功能待 P4 完整实现）`);
  }, [connected, scanResult]);

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
          {rootPath && (
            <span style={{ fontSize: 11, color: '#888', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📂 {rootPath}
            </span>
          )}
          {scanResult && (
            <span style={{
              padding: '2px 8px', borderRadius: 8, fontSize: 11,
              background: '#e6f7ff', color: '#1890ff', border: '1px solid #91d5ff',
            }}>
              {scanResult.batches.length} 个批次 · {scanResult.total_files} 个文件
            </span>
          )}
        </div>

        {/* 工具栏按钮组 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={btnStyle}
            onClick={handleSelectDirectory}
            disabled={scanning}
          >
            {scanning ? '⏳ 扫描中...' : '📂 选择目录'}
          </button>
          <button
            style={{
              ...btnStyle,
              opacity: scanResult ? 1 : 0.5,
            }}
            disabled={!scanResult}
            onClick={handleStartProcessing}
          >
            ▶ 开始处理
          </button>
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

          {/* 批次快速状态 */}
          {scanResult && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>扫描概览</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                {scanResult.total_files} 文件 / {scanResult.batches.length} 批次
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #f0f0f0' }}>
            <TemplateManager />
          </div>
        </aside>

        {/* ===== 主内容区 ===== */}
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* ===== Tab: 配置面板 (A/B/C) ===== */}
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
                  <ConfigField
                    label="全宗号"
                    placeholder="如 0226"
                    value={configValues.fonds}
                    onChange={v => handleConfigChange('fonds', v)}
                  />
                  <ConfigField
                    label="默认保管期限"
                    type="select"
                    options={['永久', '30年', '10年', '3年']}
                    value={configValues.retention}
                    onChange={v => handleConfigChange('retention', v)}
                  />
                  <ConfigField
                    label="默认年度"
                    type="number"
                    value={configValues.year}
                    onChange={v => handleConfigChange('year', v)}
                  />
                  <ConfigField
                    label="归档章 X 偏移(mm)"
                    type="number"
                    value={configValues.offsetX}
                    onChange={v => handleConfigChange('offsetX', v)}
                  />
                  <ConfigField
                    label="归档章 Y 偏移(mm)"
                    type="number"
                    value={configValues.offsetY}
                    onChange={v => handleConfigChange('offsetY', v)}
                  />

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

          {/* ===== Tab: 归档章编辑器 ===== */}
          {activeMainTab === 'stamp' && (
            <StampSchemaEditor
              schema={stampSchema ?? undefined}
              onChange={handleStampSchemaChange}
            />
          )}

          {/* ===== Tab: 页码设置 —— 使用完整组件 ===== */}
          {activeMainTab === 'pagenum' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>📄 页码设置</h2>
              <p style={{ color: '#888', marginBottom: 16 }}>
                页码功能完全遵循 §0 全自定义原则——范围、格式、位置、外观均可配置。
              </p>
              <PageNumberPanel
                config={pageConfig ?? undefined}
                onChange={handlePageConfigChange}
              />
            </div>
          )}

          {/* ===== Tab: 批次与预览 —— 使用完整组件 ===== */}
          {activeMainTab === 'process' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>🚀 批次管理与文件预览</h2>

              {!scanResult ? (
                <div style={{
                  padding: 40, textAlign: 'center', background: '#fff',
                  borderRadius: 6, border: '2px dashed #d9d9d9',
                }}>
                  <p style={{ fontSize: 32, margin: '0 0 8px' }}>📂</p>
                  <p style={{ margin: 0, color: '#888' }}>
                    点击顶部「选择目录」按钮开始扫描 PDF 文件
                  </p>
                  <p style={{ margin: '4px 0 0', color: '#bbb', fontSize: 11 }}>
                    扫描完成后，批次列表和文件预览将在此展示
                  </p>
                </div>
              ) : (
                <>
                  <BatchManager batches={scanResult.batches} />
                  <div style={{ marginTop: 16 }}>
                    <FilePreviewTable files={flatFiles} />
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============ 辅助组件 ============

interface ConfigFieldProps {
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function ConfigField({ label, type = 'text', options, value, onChange, placeholder }: ConfigFieldProps) {
  return (
    <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 13 }}>{label}</label>
      {type === 'select' ? (
        <select
          style={inputStyle}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {(options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input
          type={type}
          style={inputStyle}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
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
