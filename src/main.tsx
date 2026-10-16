import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createBackend } from './backend';
import { StaticSampleRepository } from './providers/samples';
import './styles.css';
const root = createRoot(document.getElementById('root')!);
try {
  const backend = createBackend();
  const repository = new StaticSampleRepository();
  root.render(
    <StrictMode>
      <App repository={repository} backend={backend} />
    </StrictMode>,
  );
} catch (error) {
  root.render(
    <main>
      <h1>配置无法加载</h1>
      <p role="alert">{error instanceof Error ? error.message : '未知错误'}</p>
    </main>,
  );
}
