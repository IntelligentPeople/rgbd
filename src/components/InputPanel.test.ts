import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../App';
import { InputPanel } from './InputPanel';
import type { DemoBackend, SampleRepository } from '../domain/types';
test('frontend only requires compare and never inspects backend implementation metadata', () => {
  const backend: DemoBackend = {
    compare: async () => {
      throw new Error('not called during render');
    },
  };
  Object.defineProperty(backend, 'info', {
    get() {
      throw new Error('Implementation metadata must stay private');
    },
  });
  const repository: SampleRepository = {
    listSamples: async () => [],
    loadSample: async () => {
      throw new Error();
    },
  };
  const html = renderToStaticMarkup(createElement(App, { repository, backend }));
  assert.equal((html.match(/type="file"/g) ?? []).length, 1);
  assert.equal((html.match(/运行对比/g) ?? []).length, 1);
  assert.match(html, /使用样例填入/);
  assert.doesNotMatch(html, /mock|模拟|role="group"/i);
});
test('sample-filled files and user-picked files use the same controlled input fields', () => {
  const html = renderToStaticMarkup(
    createElement(InputPanel, {
      files: {
        rgb: new File(['rgb'], 'example_rgb.png'),
        depth: new File(['depth'], 'example_depth.png'),
      },
      hasGT: true,
      loading: false,
      onChoose() {},
    }),
  );
  assert.match(html, /已准备 RGB 与深度图/);
  assert.match(html, /包含 GT 实例标注/);
  assert.equal((html.match(/type="file"/g) ?? []).length, 1);
});
