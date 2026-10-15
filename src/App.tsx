import { useState } from 'react';
import type { DemoProvider, ViewTransform } from './domain/types';
import { useDemo } from './application/useDemo';
import { ComparisonViewer } from './components/ComparisonViewer';
import { UploadPanel } from './components/UploadPanel';
export default function App({ provider }: { provider: DemoProvider }) {
  const demo = useDemo(provider);
  const [mode, setMode] = useState<'samples' | 'upload'>('samples');
  const [view, setView] = useState<ViewTransform>({ zoom: 1, x: 0, y: 0 });
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
          <span className="brand-mark" aria-hidden="true">
            ▧
          </span>
          <strong>
            RGB-D<span>小目标实例分割</span>
          </strong>
        </a>
        <div className="header-meta">
          <details className="mode-info">
            <summary>模拟演示</summary>
            <p>输入和真实标注来自课程验证集。预测由标注扰动生成，不代表模型性能；耗时为模拟值。</p>
          </details>
        </div>
      </header>
      <main>
        <section className="input-section">
          <div className="section-heading">
            <h1>输入场景</h1>
            <div className="input-actions">
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
              {mode === 'samples' && (
                <button
                  className="primary"
                  disabled={!demo.input || demo.loading || demo.running}
                  onClick={() => void demo.run()}
                >
                  {demo.running ? '正在运行…' : demo.comparison ? '重新对比' : '运行对比'}
                </button>
              )}
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
                {demo.samples.map((item) => (
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
                  正在加载样例…
                </p>
              )}
              {demo.input && (
                <details className="input-details">
                  <summary>
                    RGB 与深度预览{' '}
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
                        深度 · 近 <i className="depth-scale" /> 远
                      </figcaption>
                    </figure>
                    <div className="input-description">
                      <strong>输入信息</strong>
                      <p>
                        原始深度 × {demo.input.depthScaleM} = 米<br />
                        无效值：{demo.input.depthInvalidCode}
                        <br />
                        深度为相机 Z 轴距离，色彩按每张图有效范围归一化。
                      </p>
                    </div>
                  </div>
                </details>
              )}
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
        <details className="metrics-section">
          <summary>
            实验指标<span>待接入真实评测</span>
          </summary>
          <p>
            完整测试集的 Mask APₛ、Mask
            AP、模型大小与推理速度将在评测后提供，与当前图片和展示阈值无关。
          </p>
        </details>
      </main>
      <footer className="page-footer">
        <span>RGB-D 实例分割</span>
        <span>课程演示</span>
      </footer>
    </>
  );
}
