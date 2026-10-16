import type { InputFiles, InputRole } from '../domain/types';
import { COURSE_INPUT } from '../domain/inputSpec';
export function InputPanel({
  files,
  errors,
  checking,
  onChoose,
}: {
  files: InputFiles;
  errors: Partial<Record<InputRole, string>>;
  checking: Partial<Record<InputRole, boolean>>;
  onChoose: (role: InputRole, file?: File) => void;
}) {
  return (
    <div className="input-fields">
      {(['rgb', 'depth'] as const).map((role) => (
        <div className="file-field" key={role}>
          <strong>{role === 'rgb' ? 'RGB 彩色图' : '原始深度图'}</strong>
          <span>
            {role === 'rgb' ? '8 位三通道 PNG' : '16 位单通道 PNG'}，{COURSE_INPUT.width}×
            {COURSE_INPUT.height}
          </span>
          <div className="file-selection">
            <label className="file-picker">
              {files[role] ? '更换文件' : '选择文件'}
              <input
                aria-label={role === 'rgb' ? '选择 RGB 图' : '选择深度图'}
                type="file"
                accept="image/png,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onChoose(role, file);
                  e.target.value = '';
                }}
              />
            </label>
            <span
              className="file-name"
              title={files[role] instanceof File ? files[role].name : undefined}
            >
              {files[role] instanceof File
                ? files[role].name
                : files[role]
                  ? '已填入文件'
                  : '尚未选择'}
            </span>
          </div>
          {checking[role] && <small role="status">正在检查…</small>}
          {errors[role] && (
            <small role="alert" className="error-text">
              {errors[role]}
            </small>
          )}
        </div>
      ))}
    </div>
  );
}
