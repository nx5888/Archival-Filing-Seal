// src/components/PageNumberPanel.tsx
// 页码自定义设置面板 —— 遵循 §0 全自定义原则
// 覆盖范围/格式/位置/外观/双面模式 全部可配

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PageNumberConfig } from '../types/stamp';

function createDefaultConfig(): PageNumberConfig {
  return {
    enabled: true,
    scope: 'all-pages',
    skip_first: false,
    page_range: null,
    numbering_mode: 'per-file',
    start_number: 1,
    format: '{current}',
    zero_pad: 0,
    font_family: 'SimFang',
    font_size_pt: 8,
    font_color: [0, 0, 0],
    bold: false,
    italic: false,
    opacity: 100,
    position_v: 'bottom',
    position_h: 'center',
    mirror_odd_even: false,
    offset_mm: [0, 10],
  };
}

interface PageNumberPanelProps {
  config?: PageNumberConfig;
  onChange: (config: PageNumberConfig) => void;
  readOnly?: boolean;
}

export default function PageNumberPanel({
  config: propConfig,
  onChange,
  readOnly = false,
}: PageNumberPanelProps) {
  const [cfg, setCfg] = useState<PageNumberConfig>(() => propConfig ?? createDefaultConfig());

  // 外部配置变更同步
  useEffect(() => {
    if (propConfig) setCfg(propConfig);
  }, [propConfig]);

  const emit = useCallback((updated: PageNumberConfig) => {
    setCfg(updated);
    onChange(updated);
  }, [onChange]);

  // 通用更新函数
  const update = useCallback(<K extends keyof PageNumberConfig>(key: K, value: PageNumberConfig[K]) => {
    setCfg(prev => {
      const updated = { ...prev, [key]: value };
      emit(updated);
      return updated;
    });
  }, [emit]);

  // 实时预览页码格式
  const formatPreview = useMemo(() => {
    return cfg.format
      .replace('{current}', String(cfg.start_number).padStart(cfg.zero_pad || 0, '0'))
      .replace('{total}', '--');
  }, [cfg.format, cfg.start_number, cfg.zero_pad]);

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #d9d9d9',
      }}>
        <strong style={{ fontSize: 15 }}>📄 页码设置</strong>
        <span style={{ fontSize: 12, color: '#888' }}>
          预览：{formatPreview}
        </span>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* ===== 左列：基本设置 ===== */}
        <section>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>基本设置</h3>
          <FieldRow label="启用">
            <label><input type="checkbox" checked={cfg.enabled} disabled={readOnly}
              onChange={e => update('enabled', e.target.checked)} /> 开启页码功能</label>
          </FieldRow>

          <FieldRow label="适用范围">
            <select value={cfg.scope} disabled={readOnly || !cfg.enabled}
              onChange={e => update('scope', e.target.value as PageNumberConfig['scope'])}
              style={selectStyle}>
              <option value="all-pages">全部文件</option>
              <option value="stamped-only">仅已盖章文件</option>
            </select>
          </FieldRow>

          <FieldRow label="跳过首页">
            <label><input type="checkbox" checked={cfg.skip_first} disabled={readOnly || !cfg.enabled}
              onChange={e => update('skip_first', e.target.checked)} /> 不在首页加页码</label>
          </FieldRow>

          <FieldRow label="指定页面范围">
            <input value={cfg.page_range ?? ''} placeholder="留空=全部，如 3-10, 15-20"
              disabled={readOnly || !cfg.enabled}
              onChange={e => update('page_range', e.target.value || null)}
              style={inputStyle} />
          </FieldRow>

          <h3 style={{ margin: '16px 0 12px', fontSize: 14 }}>编号规则</h3>

          <FieldRow label="编号模式">
            <select value={cfg.numbering_mode} disabled={readOnly || !cfg.enabled}
              onChange={e => update('numbering_mode', e.target.value as PageNumberConfig['numbering_mode'])}
              style={selectStyle}>
              <option value="per-file">逐件重排（每件从1开始）</option>
              <option value="continuous">连续编号（跨文件累加）</option>
            </select>
          </FieldRow>

          <FieldRow label="起始号">
            <input type="number" min={1} value={cfg.start_number} disabled={readOnly || !cfg.enabled}
              onChange={e => update('start_number', Math.max(1, Number(e.target.value)))}
              style={{ ...inputStyle, width: 80 }} />
          </FieldRow>

          <FieldRow label="显示格式">
            <select value={cfg.format} disabled={readOnly || !cfg.enabled}
              onChange={e => update('format', e.target.value)}
              style={selectStyle}>
              <option value="{current}">{'{current}'}</option>
              <option value="第{current}页">{'第{current}页'}</option>
              <option value="{current}/{total}">{'{current}/{total}'}</option>
              <option value="- {current} -">{'- {current} -'}</option>
            </select>
          </FieldRow>

          <FieldRow label="补零位数">
            <select value={cfg.zero_pad} disabled={readOnly || !cfg.enabled}
              onChange={e => update('zero_pad', Number(e.target.value))}
              style={selectStyle}>
              <option value={0}>不补零 (5)</option>
              <option value={2}>2位补零 (05)</option>
              <option value={3}>3位补零 (005)</option>
              <option value={4}>4位补零 (0005)</option>
            </select>
          </FieldRow>
        </section>

        {/* ===== 右列：位置与外观 ===== */}
        <section>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>位置与布局</h3>

          <FieldRow label="垂直位置">
            <select value={cfg.position_v} disabled={readOnly || !cfg.enabled}
              onChange={e => update('position_v', e.target.value as PageNumberConfig['position_v'])}
              style={selectStyle}>
              <option value="top">页眉（上方）</option>
              <option value="bottom">页脚（下方）</option>
            </select>
          </FieldRow>

          <FieldRow label="水平位置">
            <select value={cfg.position_h} disabled={readOnly || !cfg.enabled}
              onChange={e => update('position_h', e.target.value as PageNumberConfig['position_h'])}
              style={selectStyle}>
              <option value="left">左侧</option>
              <option value="center">居中</option>
              <option value="right">右侧</option>
            </select>
          </FieldRow>

          <FieldRow label="双面打印镜像">
            <label><input type="checkbox" checked={cfg.mirror_odd_even} disabled={readOnly || !cfg.enabled}
              onChange={e => update('mirror_odd_even', e.target.checked)} />
              {' '}奇数页右外侧 / 偶数页左外侧
            </label>
          </FieldRow>

          <div style={{ marginTop: 4, padding: '6px 10px', fontSize: 11, background: '#fffbe6', borderRadius: 4,
            border: '1px solid #ffe58f', color: '#d48806' }}>
            💡 档案行业规范：双面打印时，页码通常位于「外侧」（奇数页右、偶数页左），便于翻阅。
          </div>

          <FieldRow label="X 偏移(mm)">
            <input type="number" step={1} value={cfg.offset_mm[0]} disabled={readOnly || !cfg.enabled}
              onChange={e => {
                const off = [...cfg.offset_mm] as [number, number];
                off[0] = Number(e.target.value);
                update('offset_mm', off);
              }}
              style={{ ...inputStyle, width: 80 }} />
          </FieldRow>

          <FieldRow label="Y 偏移(mm)">
            <input type="number" step={1} value={cfg.offset_mm[1]} disabled={readOnly || !cfg.enabled}
              onChange={e => {
                const off = [...cfg.offset_mm] as [number, number];
                off[1] = Number(e.target.value);
                update('offset_mm', off);
              }}
              style={{ ...inputStyle, width: 80 }} />
          </FieldRow>

          <h3 style={{ margin: '16px 0 12px', fontSize: 14 }}>字体与外观</h3>

          <FieldRow label="字体族">
            <input value={cfg.font_family} disabled={readOnly || !cfg.enabled}
              onChange={e => update('font_family', e.target.value)}
              style={inputStyle} />
          </FieldRow>

          <FieldRow label="字号(pt)">
            <input type="number" step={0.5} min={4} max={72} value={cfg.font_size_pt}
              disabled={readOnly || !cfg.enabled}
              onChange={e => update('font_size_pt', Number(e.target.value))}
              style={{ ...inputStyle, width: 80 }} />
          </FieldRow>

          <FieldRow label="颜色">
            <input type="color"
              value={`#${cfg.font_color.map(c => c.toString(16).padStart(2, '0')).join('')}`}
              disabled={readOnly || !cfg.enabled}
              onChange={e => {
                const hex = e.target.value.replace('#', '');
                update('font_color', [
                  parseInt(hex.substring(0, 2), 16),
                  parseInt(hex.substring(2, 4), 16),
                  parseInt(hex.substring(4, 6), 16),
                ]);
              }}
              style={{ width: 40, height: 26 }} />
            <span style={{ fontSize: 11, color: '#888' }}>
              RGB({cfg.font_color.join(',')})
            </span>
          </FieldRow>

          <FieldRow label="">
            <label><input type="checkbox" checked={cfg.bold} disabled={readOnly || !cfg.enabled}
              onChange={e => update('bold', e.target.checked)} /> 粗体</label>
            <label style={{ marginLeft: 12 }}>
              <input type="checkbox" checked={cfg.italic} disabled={readOnly || !cfg.enabled}
                onChange={e => update('italic', e.target.checked)} /> 斜体
            </label>
          </FieldRow>

          <FieldRow label={`透明度: ${cfg.opacity}%`}>
            <input type="range" min={0} max={100} value={cfg.opacity}
              disabled={readOnly || !cfg.enabled}
              onChange={e => update('opacity', Number(e.target.value))}
              style={{ width: 120 }} />
          </FieldRow>
        </section>
      </div>
    </div>
  );
}

// ============ 辅助组件 ============

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center',
      gap: 8, marginBottom: 8,
    }}>
      <label style={{ fontSize: 13 }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12, border: '1px solid #d9d9d9',
  borderRadius: 4, boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};
