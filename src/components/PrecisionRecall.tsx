import type { Evaluation } from '../evaluation/instanceMetrics';
import { atConfidence } from '../evaluation/instanceMetrics';
import { useState } from 'react';

export const MODEL_COLORS = { baseline: '#2563b5', improved: '#c56218' };
export const formatAP = (v: number | null) => (v === null ? '无小目标' : v.toFixed(3));
export function PrecisionRecall({
  models,
  threshold,
  iou,
  small,
}: {
  models: {
    name: string;
    role: 'baseline' | 'improved';
    evaluation: Evaluation;
    ap: number | null;
    aps: number | null;
  }[];
  threshold: number;
  iou: number;
  small: boolean;
}) {
  const [raw, setRaw] = useState(true);
  const x = (r: number) => 64 + r * 540;
  const y = (p: number) => 264 - p * 220;
  const envelopePath = (e: Evaluation) => {
    let path = `M ${x(0)} ${y(e.envelope[0]?.precision ?? 0)}`;
    e.envelope.forEach((p, i) => {
      path += ` H ${x(p.recall)} V ${y(e.envelope[i + 1]?.precision ?? 0)}`;
    });
    return path + ` H ${x(1)}`;
  };
  return (
    <section className="pr-section" aria-label="单图精确率召回率曲线">
      <div className="section-heading">
        <h3>P–R 曲线</h3>
        <span>
          单图 · {small ? '小目标' : '全部目标'} · IoU ≥ {iou.toFixed(2)}
        </span>
      </div>
      <div className="pr-controls">
        <span>阴影为插值包络，圆点为当前工作点</span>
        <label>
          <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> 原始
          P–R
        </label>
      </div>
      <div className="pr-layout">
        <svg
          viewBox="0 0 640 316"
          role="img"
          aria-label="单调插值 P–R 包络与原始工作点，蓝色和橙色阴影同时表示两个模型的连续包络区域"
        >
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <g key={v} className="chart-grid">
              <line x1={x(v)} x2={x(v)} y1={44} y2={264} />
              <line x1={64} x2={604} y1={y(v)} y2={y(v)} />
              <text x={x(v)} y={283} textAnchor="middle">
                {v.toFixed(1)}
              </text>
              <text x={52} y={y(v) + 4} textAnchor="end">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={334} y={309} textAnchor="middle">
            Recall · 召回率
          </text>
          <text x={18} y={154} textAnchor="middle" transform="rotate(-90 18 154)">
            Precision · 精确率
          </text>
          {models
            .filter((m) => m.evaluation.total > 0)
            .map((areaModel) => (
              <path
                key={areaModel.role}
                className="pr-envelope-area"
                data-model={areaModel.role}
                d={`${envelopePath(areaModel.evaluation)} L ${x(1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
                fill={MODEL_COLORS[areaModel.role]}
                opacity=".10"
              />
            ))}
          {models.map((model) => {
            const { evaluation: e } = model;
            if (!e.total) return null;
            let path = `M ${x(0)} ${y(e.points[0]?.precision ?? 0)}`;
            for (const p of e.points) {
              path += ` H ${x(p.recall)} V ${y(p.precision)}`;
            }
            const current = atConfidence(e, threshold);
            return (
              <g key={model.role}>
                {raw && (
                  <path
                    className="pr-raw"
                    d={path}
                    fill="none"
                    stroke={MODEL_COLORS[model.role]}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity=".45"
                  />
                )}
                <path
                  className="pr-envelope"
                  d={envelopePath(e)}
                  fill="none"
                  stroke={MODEL_COLORS[model.role]}
                  strokeWidth="2.5"
                  strokeDasharray={model.role === 'improved' ? '8 3' : undefined}
                />
                {raw &&
                  e.points
                    .filter(
                      (p, i) => i === e.points.length - 1 || p.score !== e.points[i + 1].score,
                    )
                    .map((p, i) => (
                      <circle
                        key={i}
                        cx={x(p.recall)}
                        cy={y(p.precision)}
                        r="2.5"
                        fill={MODEL_COLORS[model.role]}
                        opacity=".6"
                      >
                        <title>
                          可达工作点 · 置信度 ≥ {p.score.toPrecision(7)} · P{' '}
                          {p.precision.toFixed(3)} / R {p.recall.toFixed(3)}
                        </title>
                      </circle>
                    ))}
                <circle
                  className="pr-current"
                  cx={x(current.recall)}
                  cy={y(current.precision)}
                  r="5.5"
                  fill={MODEL_COLORS[model.role]}
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>
                    {model.name}：P {current.precision.toFixed(3)}，R {current.recall.toFixed(3)}
                    ，置信度 ≥ {threshold.toPrecision(7)}
                  </title>
                </circle>
              </g>
            );
          })}
          {models.length > 0 && models.every((m) => !m.evaluation.total) && (
            <text x="334" y="154" textAnchor="middle">
              本图没有小目标，无法计算 APₛ
            </text>
          )}
        </svg>
        <div className="pr-readouts">
          {models.map((m) => {
            const p = atConfidence(m.evaluation, threshold);
            return (
              <article key={m.role} style={{ borderLeftColor: MODEL_COLORS[m.role] }}>
                <h4>
                  <i style={{ background: MODEL_COLORS[m.role] }} />
                  {m.name}
                </h4>
                <dl>
                  <div>
                    <dt>当前 IoU 的 AP</dt>
                    <dd>{formatAP(m.evaluation.ap)}</dd>
                  </div>
                  <div>
                    <dt>Precision / Recall</dt>
                    <dd>
                      {m.evaluation.total
                        ? `${p.tp + p.fp ? p.precision.toFixed(3) : '—'} / ${p.recall.toFixed(3)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>当前有效预测</dt>
                    <dd>
                      {p.tp + p.fp} / {m.evaluation.entries.filter((e) => !e.ignored).length}
                    </dd>
                  </div>
                  <div>
                    <dt>单图 AP / APₛ</dt>
                    <dd>
                      {formatAP(m.ap)} / {formatAP(m.aps)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </div>
      <details className="viewer-help curve-guide">
        <summary>如何阅读曲线</summary>
        <dl>
          <div><dt>看线与点</dt><dd>粗线是插值包络，阴影便于比较；细虚线是原始 P–R，大圆点是当前置信度下的结果。</dd></div>
          <div><dt>调节参数</dt><dd>IoU 改变匹配标准和整条曲线；置信度筛选掩码并移动圆点，不改变 AP。</dd></div>
          <div><dt>区分 AP</dt><dd>当前 IoU 的 AP 取包络上 101 个召回位置的精确率平均值；单图 AP / APₛ 再对 IoU 0.50–0.95 取平均。</dd></div>
        </dl>
        <p>仅统计当前图片，最多 100 个候选；APₛ 评价原图面积 ≤ 1024 像素的小目标。</p>
      </details>
    </section>
  );
}
