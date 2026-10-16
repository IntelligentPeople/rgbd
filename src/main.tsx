import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createAdapter } from './providers';
import { StaticSampleRepository } from './providers/samples';
import './styles.css';
const root = createRoot(document.getElementById('root')!);
try {
  const adapter = createAdapter();
  const repository = new StaticSampleRepository();
  root.render(
    <StrictMode>
      <App repository={repository} adapter={adapter} />
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
