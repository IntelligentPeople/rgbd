import { useEffect, useRef, useState } from 'react';
import { validateUpload } from '../upload/validate';
export function UploadPanel() {
  const [files, setFiles] = useState<{ rgb?: File; depth?: File }>({});
  const [errors, setErrors] = useState<{ rgb?: string; depth?: string }>({});
  const [busy, setBusy] = useState<{ rgb?: boolean; depth?: boolean }>({});
  const [preview, setPreview] = useState(''); const revisions = useRef({ rgb: 0, depth: 0 });
  useEffect(() => {
    if (!files.rgb) { setPreview(''); return; }
    const url = URL.createObjectURL(files.rgb); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [files.rgb]);
  const choose = async (role: 'rgb' | 'depth', file?: File) => {
    const revision = ++revisions.current[role]; setFiles(current => ({ ...current, [role]: undefined })); setErrors(current => ({ ...current, [role]: undefined }));
    if (!file) { setBusy(current => ({ ...current, [role]: false })); return; }
    setBusy(current => ({ ...current, [role]: true }));
    try { await validateUpload(file, role); if (revision === revisions.current[role]) setFiles(current => ({ ...current, [role]: file })); }
    catch (error) { if (revision === revisions.current[role]) setErrors(current => ({ ...current, [role]: error instanceof Error ? error.message : '校验失败' })); }
    finally { if (revision === revisions.current[role]) setBusy(current => ({ ...current, [role]: false })); }
  };
  return <div className="upload-panel">
    <div className="upload-fields">{(['rgb', 'depth'] as const).map(role => <label className="file-field" key={role}>
      <strong>{role === 'rgb' ? 'RGB 彩色图' : '原始深度图'}</strong>
      <span>{role === 'rgb' ? '8 位 · 三通道 PNG' : '16 位 · 单通道 PNG'} · 1024×1024</span>
      <input aria-label={role === 'rgb' ? '上传 RGB 图' : '上传深度图'} type="file" accept="image/png,.png" onChange={e => void choose(role, e.target.files?.[0])} />
      {busy[role] && <small>正在检查图像…</small>}
      {files[role] && <small className="success">✓ {files[role]!.name} · 校验通过</small>}
      {errors[role] && <small role="alert" className="error-text">{errors[role]}</small>}
    </label>)}</div>
    {preview && <img className="upload-preview" src={preview} alt="上传的 RGB 预览" />}
    <p className="notice">{files.rgb && files.depth ? '输入已就绪。' : ''}当前为 Mock 模式，暂未接入上传推理。文件仅在浏览器本地校验，不会发送到服务器。</p>
  </div>;
}
