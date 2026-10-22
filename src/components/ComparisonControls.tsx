import type { Dispatch, SetStateAction } from 'react';
import type { GroundTruthInstance, ViewTransform } from '../domain/types';
import { confidenceAtPrefix, confidencePrefix, maskArea } from '../evaluation/instanceMetrics';
import { zoomView } from '../viewer/render';
import { RangeControl } from './RangeControl';

export function ComparisonControls({
  gt,
  threshold,
  setThreshold,
  scoreLevels,
  iou,
  setIou,
  small,
  setSmall,
  diagnostic,
  setDiagnostic,
  focus,
  onFocus,
  opacity,
  setOpacity,
  showMasks,
  setShowMasks,
  view,
  setView,
}: {
  gt?: GroundTruthInstance[];
  threshold: number;
  setThreshold: (v: number) => void;
  scoreLevels: number[];
  iou: number;
  setIou: (v: number) => void;
  small: boolean;
  setSmall: (v: boolean) => void;
  diagnostic: boolean;
  setDiagnostic: (v: boolean) => void;
  focus: string;
  onFocus: (id: string) => void;
  opacity: number;
  setOpacity: (v: number) => void;
  showMasks: boolean;
  setShowMasks: (v: boolean) => void;
  view: ViewTransform;
  setView: Dispatch<SetStateAction<ViewTransform>>;
}) {
  const prefix = confidencePrefix(scoreLevels, threshold);
  const hasScores = scoreLevels.length > 0;
  return (
    <aside className="analysis-inspector" aria-label="对比参数">
      <div className="inspector-heading">
        <h3>对比设置</h3>
        <span className="live-link">
          <i />
          联动视图与曲线
        </span>
      </div>
      {gt && (
        <div className="inspector-scope" role="group" aria-label="评价目标范围">
          <button
            aria-pressed={!small}
            onClick={() => {
              setSmall(false);
              onFocus('');
            }}
          >
            全部实例
          </button>
          <button
            aria-pressed={small}
            onClick={() => {
              setSmall(true);
              onFocus('');
            }}
          >
            仅小目标
          </button>
        </div>
      )}
      <div className="inspector-parameters">
        <div className="confidence-control">
          <RangeControl
            label="置信度"
            ariaLabel="置信度阈值"
            valueText={`置信度至少 ${threshold.toPrecision(7)}，纳入 ${prefix} 档候选`}
            min={0}
            max={hasScores ? scoreLevels.length : 1}
            step={hasScores ? 1 : 'any'}
            value={hasScores ? scoreLevels.length - prefix : Math.min(1, threshold)}
            onChange={(v) =>
              setThreshold(hasScores ? confidenceAtPrefix(scoreLevels, scoreLevels.length - v) : v)
            }
            valueLabel={
              <label className="threshold-entry">
                <span>≥</span>
                <input
                  aria-label="置信度精确值"
                  type="number"
                  min="0"
                  max="1"
                  step="any"
                  title={`精确阈值 ${threshold}`}
                  value={Number(Math.min(1, threshold).toPrecision(7))}
                  onChange={(e) => {
                    const n = e.target.valueAsNumber;
                    if (Number.isFinite(n) && n >= 0 && n <= 1) setThreshold(n);
                  }}
                />
              </label>
            }
          />
          <div className="confidence-steps">
            <button
              aria-label="多纳入一档预测"
              disabled={!hasScores || prefix === scoreLevels.length}
              onClick={() => setThreshold(confidenceAtPrefix(scoreLevels, prefix + 1))}
            >
              −
            </button>
            <span>
              {hasScores ? `${prefix} / ${scoreLevels.length} 档` : '等待预测'}
              <small>按实际分数逐档</small>
            </span>
            <button
              aria-label="少纳入一档预测"
              disabled={!hasScores || prefix === 0}
              onClick={() => setThreshold(confidenceAtPrefix(scoreLevels, prefix - 1))}
            >
              ＋
            </button>
          </div>
        </div>
        {gt && (
          <RangeControl
            label="IoU 匹配门槛"
            ariaLabel="IoU 匹配阈值"
            min={0.5}
            max={0.95}
            step={0.05}
            value={iou}
            onChange={setIou}
            valueLabel={<output>≥ {iou.toFixed(2)}</output>}
          />
        )}
      </div>
      {gt && (
        <div className="inspector-diagnosis">
          <div className="inspector-segment" role="group" aria-label="掩码显示方式">
            <button aria-pressed={diagnostic} onClick={() => setDiagnostic(true)}>
              误差诊断
            </button>
            <button aria-pressed={!diagnostic} onClick={() => setDiagnostic(false)}>
              实例颜色
            </button>
          </div>
          {diagnostic && (
            <div className="diagnostic-legend">
              <span>
                <i />
                匹配
              </span>
              <span>
                <i />
                误检
              </span>
              <span>
                <i />
                漏检
              </span>
            </div>
          )}
          <label className="focus-picker">
            聚焦 GT 实例
            <select
              aria-label="聚焦 GT 实例"
              value={focus}
              onChange={(e) => onFocus(e.target.value)}
            >
              <option value="">整张图片</option>
              {gt
                .map((g, i) => ({ g, i }))
                .filter(({ g }) => !small || maskArea(g.mask) <= 1024)
                .map(({ g, i }) => (
                  <option key={g.id} value={g.id}>
                    GT {i + 1}
                    {maskArea(g.mask) <= 1024 ? ' · 小目标' : ''} · {maskArea(g.mask)} px²
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <details className="inspector-display">
        <summary>掩码与视图</summary>
        <div className="display-settings">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showMasks}
              onChange={(e) => setShowMasks(e.target.checked)}
            />
            显示掩码
          </label>
          <RangeControl
            label="掩码透明度"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={setOpacity}
            valueLabel={<output>{Math.round(opacity * 100)}%</output>}
          />
          <div className="zoom-controls">
            <button aria-label="缩小" onClick={() => setView((v) => zoomView(v, 0.8))}>
              −
            </button>
            <output>{view.zoom.toFixed(1)}×</output>
            <button aria-label="放大" onClick={() => setView((v) => zoomView(v, 1.25))}>
              ＋
            </button>
            <button onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>复位</button>
          </div>
        </div>
      </details>
      <p className="inspector-hint">置信度选择工作点，IoU 改变匹配规则。</p>
    </aside>
  );
}
