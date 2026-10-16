import { useEffect, useRef, useState } from 'react';
import type { InferenceInput } from '../domain/types';
import { validateUpload } from '../upload/validate';
export function UploadPanel({
  onReady,
  onInvalidate,
}: {
  onReady: (input: InferenceInput) => void;
  onInvalidate: () => void;
}) {
  const [files, setFiles] = useState<{ rgb?: File; depth?: File }>({});
  const [errors, setErrors] = useState<{ rgb?: string; depth?: string }>({});
  const [busy, setBusy] = useState<{ rgb?: boolean; depth?: boolean }>({});
  const accepted = useRef<{ rgb?: File; depth?: File }>({});
  const revisions = useRef({ rgb: 0, depth: 0 });
  useEffect(() => {
    return () => {
      revisions.current.rgb++;
      revisions.current.depth++;
    };
  }, []);
  const choose = async (role: 'rgb' | 'depth', file?: File) => {
    const revision = ++revisions.current[role];
    accepted.current = { ...accepted.current, [role]: undefined };
    setFiles(accepted.current);
    setErrors((current) => ({ ...current, [role]: undefined }));
    onInvalidate();
    if (!file) {
      setBusy((current) => ({ ...current, [role]: false }));
      return;
    }
    setBusy((current) => ({ ...current, [role]: true }));
    try {
      await validateUpload(file, role);
      if (revision !== revisions.current[role]) return;
      accepted.current = { ...accepted.current, [role]: file };
      setFiles(accepted.current);
      const { rgb, depth } = accepted.current;
      if (rgb && depth) onReady({ id: crypto.randomUUID(), rgb, depth });
    } catch (error) {
      if (revision === revisions.current[role])
        setErrors((current) => ({
          ...current,
          [role]: error instanceof Error ? error.message : '校验失败',
        }));
    } finally {
      if (revision === revisions.current[role])
        setBusy((current) => ({ ...current, [role]: false }));
    }
  };
  return (
    <div className="upload-panel">
      <div className="upload-fields">
        {(['rgb', 'depth'] as const).map((role) => (
          <label className="file-field" key={role}>
            <strong>{role === 'rgb' ? 'RGB 彩色图' : '原始深度图'}</strong>
            <span>
              {role === 'rgb' ? '8 位三通道 PNG' : '16 位单通道 PNG'}，1024×1024，最大 30 MB
            </span>
            <input
              aria-label={role === 'rgb' ? '上传 RGB 图' : '上传深度图'}
              type="file"
              accept="image/png,.png"
              onChange={(e) => void choose(role, e.target.files?.[0])}
            />
            {busy[role] && <small>正在检查图像…</small>}
            {files[role] && <small className="success">✓ 校验通过</small>}
            {errors[role] && (
              <small role="alert" className="error-text">
                {errors[role]}
              </small>
            )}
          </label>
        ))}
      </div>
      <p className="notice">请选择同一视角、已配准的 RGB 与原始深度图。</p>
    </div>
  );
}
