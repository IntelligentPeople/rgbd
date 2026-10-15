import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createProvider } from './providers';
import './styles.css';
const root = createRoot(document.getElementById('root')!);
try {
  const provider = createProvider();
  root.render(
    <StrictMode>
      <App provider={provider} />
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
