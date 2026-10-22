import { useState } from 'react';
import type { DemoBackend, SampleRepository, ViewTransform } from './domain/types';
import { COURSE_INPUT } from './domain/inputSpec';
import { useDemo } from './application/useDemo';
import { ComparisonViewer } from './components/ComparisonViewer';
import { InputPanel } from './components/InputPanel';
export default function App({
  repository,
  backend,
}: {
  repository: SampleRepository;
  backend: DemoBackend;
}) {
  const demo = useDemo(repository, backend);
  const [view, setView] = useState<ViewTransform>({ zoom: 1, x: 0, y: 0 });
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 });
  return (
    <>
      <header className="topbar">
        <a href="#" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ▧
          </span>
          <strong>
            DPSeg<span>RGB-D 小目标实例分割</span>
          </strong>
        </a>
      </header>
      <main>
        <section className="input-section">
          <div className="section-heading">
            <h1>RGB-D 输入</h1>
            <button
              className="primary"
              disabled={!demo.item || demo.loading || demo.running}
              onClick={() => void demo.run()}
            >
              {demo.running ? '正在运行…' : demo.comparison ? '重新对比' : '运行对比'}
            </button>
          </div>
          <InputPanel
            files={demo.files}
            hasGT={Boolean(demo.item?.gt)}
            loading={demo.loading}
            onChoose={(file) => {
              resetView();
              demo.choosePackage(file);
            }}
          />
          <details className="sample-shortcut">
            <summary>使用样例填入</summary>
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
          </details>
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
                  {demo.item.gt ? '，包含真实标注' : ''}
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
                  <strong>输入要求</strong>
                  <p>
                    RGB 与深度需配准。
                    <br />
                    原始深度 × {COURSE_INPUT.depthScaleM} = 米<br />
                    无效值：{COURSE_INPUT.depthInvalidCode}，每文件最大 30 MB。
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
      </main>
      <footer className="page-footer">
        <span>DPSeg · Depth-guided Point Refinement for Segmentation</span>
        <span>课程演示</span>
      </footer>
    </>
  );
}
