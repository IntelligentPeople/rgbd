import { useState } from 'react';
import type { InferenceAdapter, SampleRepository, ViewTransform } from './domain/types';
import { COURSE_INPUT } from './domain/inputSpec';
import { useDemo } from './application/useDemo';
import { ComparisonViewer } from './components/ComparisonViewer';
import { UploadPanel } from './components/UploadPanel';
export default function App({
  repository,
  adapter,
}: {
  repository: SampleRepository;
  adapter: InferenceAdapter;
}) {
  const demo = useDemo(repository, adapter);
  const [mode, setMode] = useState<'samples' | 'upload'>('samples');
  const [view, setView] = useState<ViewTransform>({ zoom: 1, x: 0, y: 0 });
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 });
  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    setMode(next);
    demo.reset();
    resetView();
    if (next === 'samples' && demo.samples[0]) demo.select(demo.samples[0].id);
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
        {adapter.info.source === 'mock' && (
          <details className="mode-info">
            <summary>{adapter.info.label}</summary>
            <p>{adapter.info.description}</p>
          </details>
        )}
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
              <button
                className="primary"
                disabled={!demo.item || demo.loading || demo.running}
                onClick={() => void demo.run()}
              >
                {demo.running ? '正在运行…' : demo.comparison ? '重新对比' : '运行对比'}
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
                {demo.samples.map((sample) => (
                  <button
                    key={sample.id}
                    className={`sample ${sample.id === demo.selected ? 'selected' : ''}`}
                    aria-pressed={sample.id === demo.selected}
                    onClick={() => {
                      demo.select(sample.id);
                      resetView();
                    }}
                  >
                    <div className="thumbnail">
                      <img src={sample.rgbUrl} alt={sample.title} />
                      {sample.id === demo.selected && <b>✓</b>}
                    </div>
                    <strong>{sample.title}</strong>
                    <small>
                      {sample.instanceCount} 个实例 · {sample.smallCount} 个小目标
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <UploadPanel
              onReady={demo.upload}
              onInvalidate={() => {
                demo.reset();
                resetView();
              }}
            />
          )}
          {demo.loading && (
            <p role="status" className="notice">
              正在准备 RGB-D 输入…
            </p>
          )}
          {demo.item && (
            <details className="input-details">
              <summary>
                RGB 与深度预览{' '}
                <span>
                  {COURSE_INPUT.width}×{COURSE_INPUT.height}
                </span>
              </summary>
              <div className="input-images">
                <figure>
                  <img src={demo.item.rgbPreview.src} alt="原始 RGB 预览" />
                  <figcaption>RGB 彩色图</figcaption>
                </figure>
                <figure>
                  <img src={demo.item.depthPreview.src} alt="深度伪彩色预览" />
                  <figcaption>
                    深度 · 近 <i className="depth-scale" /> 远
                  </figcaption>
                </figure>
                <div className="input-description">
                  <strong>输入信息</strong>
                  <p>
                    原始深度 × {COURSE_INPUT.depthScaleM} = 米<br />
                    无效值：{COURSE_INPUT.depthInvalidCode}
                    <br />
                    预览按有效深度范围着色，推理使用原始文件。
                  </p>
                </div>
              </div>
            </details>
          )}
          {demo.error && (
            <div className="error-box" role="alert">
              {demo.error}{' '}
              <button onClick={() => (demo.item ? void demo.run() : demo.retryInput())}>
                重试
              </button>
            </div>
          )}
        </section>
        {demo.item && (
          <ComparisonViewer
            key={demo.item.input.id}
            input={demo.item}
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
