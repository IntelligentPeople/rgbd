import { useState, type Dispatch, type SetStateAction } from 'react';
import type {
  Comparison,
  DemoInput,
  Instance,
  RenderOptions,
  ViewTransform,
} from '../domain/types';
import { MaskViewport } from '../viewer/MaskViewport';
import { visibleInstances, zoomView } from '../viewer/render';
import { exportComparison } from '../viewer/export';
export function ComparisonViewer({
  input,
  comparison,
  running,
  view,
  setView,
}: {
  input: DemoInput;
  comparison?: Comparison;
  running: boolean;
  view: ViewTransform;
  setView: Dispatch<SetStateAction<ViewTransform>>;
}) {
  const [threshold, setThreshold] = useState(0.5);
  const [opacity, setOpacity] = useState(0.6);
  const [showMasks, setShowMasks] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const options: RenderOptions = { view, threshold, opacity, showMasks };
  const panels: {
    title: string;
    subtitle: string;
    instances: Instance[];
    error?: string;
    pending?: boolean;
    kind: string;
  }[] = [];
  if (input.gt)
    panels.push({
      title: '真实标注',
      subtitle: 'GT',
      instances: input.gt,
      kind: 'gt',
    });
  for (const role of ['baseline', 'improved'] as const) {
    const model = comparison?.models.find((item) => item.role === role);
    panels.push({
      title: model?.name ?? (role === 'baseline' ? '基线模型' : '改进模型'),
      kind: role,
      subtitle: model
        ? `${model.source === 'mock' ? '模拟预测' : model.source === 'cached' ? '真实缓存预测' : '实时预测'} · ${model.version}`
        : '等待运行',
      instances: model?.status === 'success' ? model.instances : [],
      error: model?.status === 'error' ? model.message : undefined,
      pending: !model,
    });
  }
  return (
    <section className="comparison-section">
      <div className="section-heading">
        <h2>分割对比</h2>
        <button
          className="secondary"
          disabled={!comparison || exporting || running}
          onClick={async () => {
            setExporting(true);
            setExportError('');
            try {
              await exportComparison(input, panels, options);
            } catch {
              setExportError('导出失败，请重试。');
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? '正在导出…' : '导出图片'}
        </button>
      </div>
      <div className="viewer-toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={showMasks}
            onChange={(e) => setShowMasks(e.target.checked)}
          />
          显示掩码
        </label>
        <label>
          透明度{' '}
          <input
            aria-label="掩码透明度"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
          <b>{Math.round(opacity * 100)}%</b>
        </label>
        <label>
          置信度{' '}
          <input
            aria-label="置信度阈值"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <b>{threshold.toFixed(2)}</b>
        </label>
        <div className="zoom-controls">
          <button aria-label="缩小" onClick={() => setView((v) => zoomView(v, 0.8))}>
            −
          </button>
          <span>{view.zoom.toFixed(1)}×</span>
          <button aria-label="放大" onClick={() => setView((v) => zoomView(v, 1.25))}>
            ＋
          </button>
          <button onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>复位</button>
        </div>
      </div>
      {!input.gt && <p className="notice">此输入没有真实标注，仅展示模型预测。</p>}
      <div
        className="comparison-grid"
        style={{ gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}
      >
        {panels.map((panel) => (
          <article className={`result-panel ${panel.kind}`} key={panel.kind}>
            <header>
              <div>
                <h3>{panel.title}</h3>
                <span title={panel.subtitle}>{panel.subtitle.split(' · ')[0]}</span>
              </div>
              <span className="count">
                {panel.pending || panel.error
                  ? '—'
                  : visibleInstances(panel.instances, threshold).length}
                <small> 实例</small>
              </span>
            </header>
            <div className="viewport-wrap">
              <MaskViewport
                input={input}
                instances={panel.instances}
                options={options}
                setView={setView}
                label={`${panel.title}对比视图，滚轮缩放，拖动平移，键盘加减缩放，0复位`}
              />
              {panel.pending && (
                <div className="viewport-placeholder">
                  <span>{running ? '正在运行…' : '等待对比'}</span>
                </div>
              )}
              {panel.error && (
                <div className="viewport-placeholder">
                  <span role="alert">{panel.error}</span>
                </div>
              )}
            </div>
            {panel.kind !== 'gt' && comparison && (
              <footer>
                {(() => {
                  const model = comparison?.models.find((m) => m.role === panel.kind);
                  return model?.status === 'success'
                    ? `${model.source === 'mock' ? '模拟耗时' : '推理耗时'} ${(model.elapsedMs / 1000).toFixed(2)} s${visibleInstances(model.instances, threshold).length === 0 ? ' · 当前阈值下无实例' : ''}`
                    : panel.error
                      ? '请重新运行对比'
                      : '';
                })()}
              </footer>
            )}
          </article>
        ))}
      </div>
      <details className="viewer-help">
        <summary>操作说明</summary>
        <p>
          滚轮缩放，拖动平移，三列同步。键盘加减键缩放，0
          复位。置信度仅筛选预测；颜色用于区分实例，不表示跨模型匹配。
        </p>
      </details>
      {exportError && (
        <p role="alert" className="error-text">
          {exportError}
        </p>
      )}
    </section>
  );
}
