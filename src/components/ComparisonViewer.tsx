import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Comparison, DemoItem, Instance, RenderOptions, ViewTransform } from '../domain/types';
import { MaskViewport } from '../viewer/MaskViewport';
import { visibleInstances } from '../viewer/render';
import { exportComparison } from '../viewer/export';
import {
  prepareEvaluation,
  evaluate,
  atConfidence,
  meanAP,
  maskArea,
  type Evaluation,
  confidenceLevels,
} from '../evaluation/instanceMetrics';
import { PrecisionRecall } from './PrecisionRecall';
import { ComparisonControls } from './ComparisonControls';
export function ComparisonViewer({
  input,
  comparison,
  running,
  view,
  setView,
}: {
  input: DemoItem;
  comparison?: Comparison;
  running: boolean;
  view: ViewTransform;
  setView: Dispatch<SetStateAction<ViewTransform>>;
}) {
  const [threshold, setThreshold] = useState(0.5);
  const [opacity, setOpacity] = useState(0.6);
  const [showMasks, setShowMasks] = useState(true);
  const [iou, setIou] = useState(0.5);
  const [small, setSmall] = useState(false);
  const [diagnostic, setDiagnostic] = useState(true);
  const [focus, setFocus] = useState('');
  const prepared = useMemo(
    () =>
      comparison?.models.flatMap((model) =>
        input.gt && model.status === 'success'
          ? [{ model, data: prepareEvaluation(input.gt, model.instances) }]
          : [],
      ) ?? [],
    [comparison, input],
  );
  const fixedMetrics = useMemo(
    () => prepared.map((p) => ({ ...p, ap: meanAP(p.data, 'all'), aps: meanAP(p.data, 'small') })),
    [prepared],
  );
  const evaluated = useMemo(
    () =>
      fixedMetrics.map((p) => ({
        ...p,
        evaluation: evaluate(p.data, iou, small ? 'small' : 'all'),
      })),
    [fixedMetrics, iou, small],
  );
  const scoreLevels = useMemo(
    () =>
      evaluated.length
        ? confidenceLevels(evaluated.map((e) => e.evaluation))
        : [
            ...new Set(
              comparison?.models.flatMap((model) =>
                model.status === 'success' ? model.instances.map((p) => p.score) : [],
              ) ?? [],
            ),
          ].sort((a, b) => b - a),
    [evaluated, comparison],
  );
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
    evaluation?: Evaluation;
    options?: RenderOptions;
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
      subtitle: model ? model.version : '等待运行',
      instances: model?.status === 'success' ? model.instances : [],
      error: model?.status === 'error' ? model.message : undefined,
      pending: !model,
    });
  }
  for (const panel of panels) {
    const evaluation = evaluated.find((e) => e.model.role === panel.kind)?.evaluation;
    panel.evaluation = evaluation;
    const focusIndex = input.gt?.findIndex((g) => g.id === focus) ?? -1;
    if (panel.kind === 'gt') {
      panel.instances = panel.instances.filter(
        (g) => (!small || maskArea(g.mask) <= 1024) && (!focus || g.id === focus),
      );
    } else if (evaluation) {
      const entries = evaluation.entries.filter((e) => !e.ignored);
      panel.instances = entries
        .filter((e) => !focus || e.gtIndex === focusIndex)
        .map((e) => e.prediction);
      const matched = new Set(
        entries
          .filter((e) => e.prediction.score >= threshold && e.gtIndex >= 0)
          .map((e) => e.gtIndex),
      );
      panel.options = {
        ...options,
        colors: diagnostic
          ? Object.fromEntries(
              entries.map((e) => [e.prediction.id, e.gtIndex >= 0 ? '#168264' : '#d33b53']),
            )
          : undefined,
        missed: diagnostic
          ? input.gt?.filter(
              (g, gi) =>
                (!small || maskArea(g.mask) <= 1024) &&
                (!focus || g.id === focus) &&
                !matched.has(gi),
            )
          : undefined,
      };
    }
  }
  const selectFocus = (id: string) => {
    setFocus(id);
    const gt = input.gt?.find((g) => g.id === id);
    if (!gt) {
      setView({ zoom: 1, x: 0, y: 0 });
      return;
    }
    const { width, height, pixels } = gt.mask;
    let left = width,
      right = 0,
      top = height,
      bottom = 0;
    pixels.forEach((v, i) => {
      if (v) {
        left = Math.min(left, i % width);
        right = Math.max(right, i % width);
        top = Math.min(top, Math.floor(i / width));
        bottom = Math.max(bottom, Math.floor(i / width));
      }
    });
    const zoom = Math.min(
      8,
      Math.max(1, 0.65 / Math.max((right - left + 1) / width, (bottom - top + 1) / height)),
    );
    setView({
      zoom,
      x: (0.5 - (left + right) / 2 / width) * zoom,
      y: (0.5 - (top + bottom) / 2 / height) * zoom,
    });
  };
  const focusSummary = (panel: (typeof panels)[number]) => {
    const gi = input.gt?.findIndex((g) => g.id === focus) ?? -1;
    const match = panel.evaluation?.entries.find(
      (e) => e.gtIndex === gi && e.prediction.score >= threshold && !e.ignored,
    );
    if (match)
      return `匹配 IoU ${match.iou.toFixed(3)} · 置信度 ${match.prediction.score.toFixed(3)}`;
    const data = prepared.find((p) => p.model.role === panel.kind)?.data;
    const best = data
      ? Math.max(
          0,
          ...data.overlaps.map((row, i) => (data.sorted[i].score >= threshold ? row[gi] : 0)),
        )
      : 0;
    return `未匹配 · 最佳候选 IoU ${best.toFixed(3)}`;
  };
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
      <div className="analysis-workbench">
        <ComparisonControls
          gt={input.gt}
          threshold={threshold}
          setThreshold={setThreshold}
          scoreLevels={scoreLevels}
          iou={iou}
          setIou={setIou}
          small={small}
          setSmall={setSmall}
          diagnostic={diagnostic}
          setDiagnostic={setDiagnostic}
          focus={focus}
          onFocus={selectFocus}
          opacity={opacity}
          setOpacity={setOpacity}
          showMasks={showMasks}
          setShowMasks={setShowMasks}
          view={view}
          setView={setView}
        />
        <div className="analysis-content">
          {!input.gt && <p className="notice">此输入没有真实标注，仅展示模型预测。</p>}
          <section className="mask-card" aria-label="掩码对比">
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
                  {panel.evaluation && focus ? (
                    <span className="focus-summary" title={focusSummary(panel)}>
                      {focusSummary(panel)}
                    </span>
                  ) : panel.evaluation ? (
                    <span className="match-counts">
                      {(() => {
                        const p = atConfidence(panel.evaluation!, threshold);
                        return (
                          <>
                            <b>{p.tp}</b> 匹配 <b>{p.fp}</b> 误检 <b>{p.fn}</b> 漏检
                          </>
                        );
                      })()}
                    </span>
                  ) : (
                    <span className="count">
                      {panel.pending || panel.error
                        ? '—'
                        : visibleInstances(panel.instances, threshold).length}
                      <small> 实例</small>
                    </span>
                  )}
                </header>
                <div className="viewport-wrap">
                  <MaskViewport
                    input={input}
                    instances={panel.instances}
                    options={panel.options ?? options}
                    setView={setView}
                    onSelect={panel.kind === 'gt' ? selectFocus : undefined}
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
                        ? `处理耗时 ${(model.elapsedMs / 1000).toFixed(2)} s${visibleInstances(model.instances, threshold).length === 0 ? ' · 当前阈值下无实例' : ''}`
                        : panel.error
                          ? '请重新运行对比'
                          : '';
                    })()}
                  </footer>
                )}
              </article>
            ))}
          </div>
          <details className="viewer-help mask-guide">
            <summary>掩码图操作</summary>
            <ul>
              <li>滚轮缩放、拖动平移，三图同步；键盘 + / − 缩放，0 复位。</li>
              <li>误差诊断：绿色为匹配，红色为误检，黄色虚线为漏检，按当前置信度与 IoU 判断。</li>
              <li>点击 GT 实例或使用右侧下拉框聚焦，表头显示该实例的匹配信息；曲线仍统计整图或全部小目标。</li>
            </ul>
          </details>
          </section>
          {evaluated.length > 0 && (
            <PrecisionRecall
              models={evaluated.map((e) => ({
                name: e.model.name,
                role: e.model.role,
                evaluation: e.evaluation,
                ap: e.ap,
                aps: e.aps,
              }))}
              threshold={threshold}
              iou={iou}
              small={small}
            />
          )}
          {exportError && (
            <p role="alert" className="error-text">
              {exportError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
