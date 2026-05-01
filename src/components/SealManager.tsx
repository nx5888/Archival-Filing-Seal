// src/components/SealManager.tsx
// 印章管理（上传/预览/删除）

import { useEffect, useState } from 'react';
import { Seal } from '../types/stamp';

export default function SealManager() {
  const [seals, setSeals] = useState<Seal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSeals() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<Seal[]>('list_seals');
      setSeals(result);
    } catch (e: any) {
      console.warn('加载印章失败', e);
      setError('无法连接后端，请确认 Tauri 应用已启动');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeals();
  }, []);

  async function handleUpload() {
    setUploading(true);
    setError(null);
    try {
      // 使用 Tauri dialog 插件选择图片文件
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        multiple: false,
        filters: [{
          name: '图片文件',
          extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'],
        }],
      });

      if (!filePath) {
        setUploading(false);
        return;
      }

      const fileName = filePath.split(/[/\\]/).pop() || '印章';
      // 去掉扩展名作为默认名称
      const defaultName = fileName.replace(/\.[^.]+$/, '');

      const name = prompt('请输入印章名称：', defaultName);
      if (!name) {
        setUploading(false);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const sealId = await invoke<number>('upload_seal', {
        name,
        srcPath: filePath,
      });

      alert(`印章上传成功！ID: ${sealId}`);
      await loadSeals();
    } catch (e: any) {
      setError(`上传失败: ${e.toString()}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(seal: Seal) {
    if (!confirm(`确定要删除印章「${seal.name}」吗？`)) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_seal', { sealId: seal.id });
      alert('删除成功');
      await loadSeals();
    } catch (e: any) {
      setError(`删除失败: ${e.toString()}`);
    }
  }

  if (loading) return <p>加载印章中...</p>;

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>印章管理</h2>

      {error && (
        <p style={{ color: 'red', padding: 8, background: '#fee', borderRadius: 4 }}>
          {error}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading}
        style={{
          padding: '8px 16px',
          background: uploading ? '#ccc' : '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: uploading ? 'default' : 'pointer',
          marginBottom: 16,
        }}
      >
        {uploading ? '上传中...' : '上传印章图片'}
      </button>

      {seals.length === 0 ? (
        <p>暂无印章，请点击上方按钮上传。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>预览</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>ID</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>名称</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>尺寸(mm)</th>
              <th style={{ border: '1px solid #ccc', padding: 4 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {seals.map(s => (
              <tr key={s.id}>
                <td style={{ border: '1px solid #ccc', padding: 4, textAlign: 'center' }}>
                  <img
                    src={`file://${s.file_path}`}
                    alt={s.name}
                    style={{ maxWidth: 80, maxHeight: 80, objectFit: 'contain' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.id}</td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.name}</td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>
                  {s.width_mm && s.height_mm
                    ? `${s.width_mm.toFixed(1)} × ${s.height_mm.toFixed(1)}`
                    : '未知'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: 4 }}>
                  <button
                    onClick={() => handleDelete(s)}
                    style={{
                      padding: '4px 8px',
                      background: '#cc0000',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
