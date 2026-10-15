import { useState } from 'react';
import type { DemoProvider, ViewTransform } from './domain/types';
import { useDemo } from './application/useDemo';
import { ComparisonViewer } from './components/ComparisonViewer';
import { UploadPanel } from './components/UploadPanel';
export default function App({ provider }: { provider: DemoProvider }) {
  const demo = useDemo(provider);
  const [mode, setMode] = useState<'samples' | 'upload'>('samples');
  const [view, setView] = useState<ViewTransform>({ zoom: 1, x: 0, y: 0 });
  const sample = demo.samples.find((item) => item.id === demo.selected);
  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    setMode(next);
    if (next === 'upload') demo.select('');
    else if (demo.samples[0]) demo.select(demo.samples[0].id);
    setView({ zoom: 1, x: 0, y: 0 });
  };
  return (
    <>
      <header className="topbar">
        <a href="#" className="brand">
          <span className="brand-mark">◈</span>
          <strong>
            RGB-D<span>实例分割实验台</span>
          </strong>
        </a>
        <div className="header-meta">
          <span className="status-dot" />
          本地演示 <span className="mode-badge">MOCK</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <span className="eyebrow">SMALL OBJECT · INSTANCE SEGMENTATION</span>
            <h1>
              从像素到实例<span>，看清每一个小目标。</span>
            </h1>
            <p>结合 RGB 与深度信息，观察真实标注与基线、改进模型的分割差异。</p>
          </div>
          <div className="intro-index">
            RGB<span>＋</span>D<small>1024 × 1024</small>
          </div>
        </section>
        <div className="mock-notice">
          <span>模拟模式</span>
          <p>
            输入与 GT 来自真实课程数据；两组预测由标注扰动生成，仅用于交互演示，不代表模型性能。
          </p>
        </div>
        <section className="input-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / INPUT</span>
              <h2>选择一个场景</h2>
            </div>
            <div className="tabs" role="group" aria-label="输入方式">
              <button
                aria-pressed={mode === 'samples'}
                className={mode === 'samples' ? 'active' : ''}
                onClick={() => changeMode('samples')}
              >
                内置样例
              </button>
              <button
                aria-pressed={mode === 'upload'}
                className={mode === 'upload' ? 'active' : ''}
                onClick={() => changeMode('upload')}
              >
                上传 RGB-D
              </button>
            </div>
          </div>
          {mode === 'samples' ? (
            <>
              {demo.listError && (
                <div className="error-box" role="alert">
                  {demo.listError} <button onClick={demo.retryList}>重试加载</button>
                </div>
              )}
              <div className="sample-grid">
                {demo.samples.map((item, i) => (
                  <button
                    key={item.id}
                    className={`sample ${item.id === demo.selected ? 'selected' : ''}`}
                    aria-pressed={item.id === demo.selected}
                    onClick={() => {
                      demo.select(item.id);
                      setView({ zoom: 1, x: 0, y: 0 });
                      if (item.id === demo.selected) demo.retryInput();
                    }}
                  >
                    <div className="thumbnail">
                      <img src={item.rgbUrl} alt={item.title} />
                      <span>0{i + 1}</span>
                      {item.id === demo.selected && <b>✓</b>}
                    </div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.instanceCount} 个实例 · {item.smallCount} 个小目标
                    </small>
                  </button>
                ))}
              </div>
              {demo.loading && (
                <p role="status" className="notice">
                  正在解码 RGB-D 与真实实例掩码…
                </p>
              )}
              {demo.input && (
                <details className="input-details">
                  <summary>
                    查看输入 RGB / 深度{' '}
                    <span>
                      {demo.input.width}×{demo.input.height} · 样例 {demo.input.id}
                    </span>
                  </summary>
                  <div className="input-images">
                    <figure>
                      <img src={demo.input.rgb.src} alt="样例原始 RGB" />
                      <figcaption>RGB 彩色图</figcaption>
                    </figure>
                    <figure>
                      <img src={demo.input.depthPreview?.src} alt="深度伪彩色预览" />
                      <figcaption>
                        深度伪彩色 · 近 <i className="depth-scale" /> 远
                      </figcaption>
                    </figure>
                    <div className="input-description">
                      <strong>{sample?.title}</strong>
                      <p>{sample?.description}</p>
                      <p>
                        原始深度 × {demo.input.depthScaleM} = 米<br />
                        无效值：{demo.input.depthInvalidCode}
                        <br />
                        深度为相机 Z 轴距离，色彩按每张图有效范围归一化。
                      </p>
                      <p>GT 仅用于对照，不进入推理。</p>
                    </div>
                  </div>
                </details>
              )}
              <div className="run-row">
                <div>
                  <span className="pair-dot" />
                  基线模型 <span className="pair-line">→</span> 改进模型
                  <small>固定模型对 · 模拟预测</small>
                </div>
                <button
                  className="primary"
                  disabled={!demo.input || demo.loading || demo.running}
                  onClick={() => void demo.run()}
                >
                  {demo.running ? '◌ 正在运行…' : demo.comparison ? '↻ 重新运行对比' : '▶ 运行对比'}
                </button>
              </div>
            </>
          ) : (
            <UploadPanel />
          )}
          {demo.error && (
            <div className="error-box" role="alert">
              {demo.error}{' '}
              <button onClick={() => (demo.input ? void demo.run() : demo.retryInput())}>
                重试
              </button>
            </div>
          )}
        </section>
        {mode === 'samples' && demo.input && (
          <ComparisonViewer
            key={demo.input.id}
            input={demo.input}
            comparison={demo.comparison}
            running={demo.running}
            view={view}
            setView={setView}
          />
        )}
        <section className="metrics-section">
          <div>
            <span className="eyebrow">03 / BENCHMARK</span>
            <h2>完整实验指标</h2>
            <p>
              与当前图片及展示阈值独立。
              <br />
              真实评测结果核验后填入。
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>模型</th>
                  <th>Mask APₛ ↑</th>
                  <th>Mask AP ↑</th>
                  <th>模型大小</th>
                  <th>推理速度</th>
                </tr>
              </thead>
              <tbody>
                {['基线模型', '改进模型'].map((name) => (
                  <tr key={name}>
                    <th>{name}</th>
                    {[0, 1, 2, 3].map((i) => (
                      <td key={i}>待提供</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <small>
              主指标：Mask APₛ@[0.50:0.95]，分数范围 0–1。效率指标需注明硬件与计时条件。
            </small>
          </div>
        </section>
      </main>
      <footer className="page-footer">
        <span>RGB-D / 小目标实例分割</span>
        <span>课程数据 · 验证集样例 · Mock 演示 v0.1</span>
      </footer>
    </>
  );
}
