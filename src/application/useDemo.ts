import { useCallback, useEffect, useRef, useState } from 'react';
import type { Comparison, DemoInput, DemoProvider, SampleSummary } from '../domain/types';
const message = (error: unknown) => (error instanceof Error ? error.message : '操作失败，请重试。');
export function useDemo(provider: DemoProvider) {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState<DemoInput>();
  const [comparison, setComparison] = useState<Comparison>();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [listRevision, refreshList] = useState(0);
  const [loadRevision, reloadInput] = useState(0);
  const sequence = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const runController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setListError('');
    provider
      .listSamples(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setSamples(items);
        setSelected((current) => current || items[0]?.id || '');
        if (!items.length) setListError('没有可用样例，请先生成样例资源。');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setListError(message(e));
      });
    return () => controller.abort();
  }, [provider, listRevision]);
  const clear = useCallback(() => {
    sequence.current++;
    loadController.current?.abort();
    runController.current?.abort();
    setInput(undefined);
    setComparison(undefined);
    setError('');
    setLoading(false);
    setRunning(false);
  }, []);
  useEffect(() => {
    clear();
    if (!selected) return;
    const current = sequence.current;
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    provider
      .loadSample(selected, controller.signal)
      .then((value) => {
        if (current === sequence.current && !controller.signal.aborted) setInput(value);
      })
      .catch((e) => {
        if (current === sequence.current && !controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (current === sequence.current) setLoading(false);
      });
    return () => controller.abort();
  }, [selected, provider, clear, loadRevision]);
  useEffect(
    () => () => {
      loadController.current?.abort();
      runController.current?.abort();
    },
    [],
  );
  const select = (id: string) => {
    clear();
    setSelected(id);
  };
  const run = async () => {
    if (!input) return;
    runController.current?.abort();
    const controller = new AbortController();
    runController.current = controller;
    const current = sequence.current;
    setRunning(true);
    setComparison(undefined);
    setError('');
    try {
      const value = await provider.compare(
        { kind: 'sample', sampleId: input.id },
        controller.signal,
      );
      if (current === sequence.current && !controller.signal.aborted) {
        if (value.inputId !== input.id) throw new Error('预测结果与当前输入不匹配。');
        setComparison(value);
      }
    } catch (e) {
      if (current === sequence.current && !controller.signal.aborted) setError(message(e));
    } finally {
      if (current === sequence.current && !controller.signal.aborted) setRunning(false);
    }
  };
  return {
    samples,
    selected,
    input,
    comparison,
    loading,
    running,
    error,
    listError,
    select,
    run,
    clear,
    retryList: () => refreshList((v) => v + 1),
    retryInput: () => reloadInput((v) => v + 1),
  };
}
