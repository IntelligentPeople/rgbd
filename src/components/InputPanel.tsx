import type { InputFiles } from '../domain/types';
export function InputPanel({ files, hasGT, loading, onChoose }: {
  files: InputFiles; hasGT: boolean; loading: boolean; onChoose: (file: File) => void;
}) {
  return (
    <div className="package-input">
      <div className="package-upload-row">
        <div><strong>上传 RGB-D 数据包</strong><p>一个 ZIP，包含 RGB、原始深度图及可选的实例标注。</p></div>
        <label className="file-picker">
          上传数据包
          <input aria-label="上传 ZIP 数据包" type="file" accept=".zip,application/zip"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) onChoose(file); e.target.value = ''; }} />
        </label>
      </div>
      {loading ? <small role="status">正在校验数据包…</small> : files.rgb && files.depth ?
        <small className="package-ready">已准备 RGB 与深度图{hasGT ? ' · 包含 GT 实例标注' : ''}</small> : null}
      <details className="viewer-help">
        <summary>数据包格式</summary>
        <ul>
          <li>ZIP 根目录：rgb.png、depth.png，gt.png 可选，不嵌套文件夹。</li>
          <li>均为 1024×1024 PNG；RGB 为 8 位三通道，深度为 16 位单通道，需保持配准。</li>
          <li>GT 为 8 或 16 位单通道实例 ID 图：0 为背景，不同整数表示不同实例。彩色掩码预览不适用。</li>
          <li>深度沿用课程单位与相机标定；每个文件限 30 MB，ZIP 限 90 MB。</li>
        </ul>
      </details>
    </div>
  );
}
