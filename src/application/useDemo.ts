import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Comparison,
  DemoItem,
  InferenceAdapter,
  InferenceInput,
  SampleRepository,
  SampleSummary,
} from '../domain/types';
import { prepareInput } from '../input/prepare';
import { validateComparison } from './comparison';
const message = (error: unknown) => (error instanceof Error ? error.message : '操作失败，请重试。');
export function useDemo(repository: SampleRepository, adapter: InferenceAdapter) {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [item, setItem] = useState<DemoItem>();
  const [comparison, setComparison] = useState<Comparison>();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [listRevision, refreshList] = useState(0);
  const sequence = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const runController = useRef<AbortController | null>(null);
  const lastLoad = useRef<(() => void) | undefined>(undefined);
  const clear = useCallback(() => {
    sequence.current++;
    loadController.current?.abort();
    runController.current?.abort();
    setItem(undefined);
    setComparison(undefined);
    setError('');
    setLoading(false);
    setRunning(false);
  }, []);
  const load = useCallback(
    async (prepare: (signal: AbortSignal) => Promise<DemoItem>) => {
      clear();
      const current = sequence.current;
      const controller = new AbortController();
      loadController.current = controller;
      setLoading(true);
      try {
        const value = await prepare(controller.signal);
        if (current === sequence.current && !controller.signal.aborted) setItem(value);
      } catch (e) {
        if (current === sequence.current && !controller.signal.aborted) setError(message(e));
      } finally {
        if (current === sequence.current && !controller.signal.aborted) setLoading(false);
      }
    },
    [clear],
  );
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      lastLoad.current = () => {
        void load((signal) => repository.loadSample(id, signal));
      };
      lastLoad.current();
    },
    [load, repository],
  );
  useEffect(() => {
    const controller = new AbortController();
    setListError('');
    repository
      .listSamples(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setSamples(items);
        if (!items.length) setListError('没有可用样例，请先生成样例资源。');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setListError(message(e));
      });
    return () => controller.abort();
  }, [repository, listRevision]);
  // Select the first sample only once, so a late list response cannot replace uploads.
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && samples[0]) {
      initialized.current = true;
      select(samples[0].id);
    }
  }, [samples, select]);
  const reset = () => {
    initialized.current = true;
    setSelected('');
    lastLoad.current = undefined;
    clear();
  };
  const upload = (input: InferenceInput) => {
    initialized.current = true;
    setSelected('');
    lastLoad.current = () => {
      void load((signal) => prepareInput(input, signal));
    };
    lastLoad.current();
  };
  useEffect(
    () => () => {
      loadController.current?.abort();
      runController.current?.abort();
    },
    [],
  );
  const run = async () => {
    if (!item) return;
    runController.current?.abort();
    const controller = new AbortController();
    runController.current = controller;
    const current = sequence.current;
    setRunning(true);
    setComparison(undefined);
    setError('');
    try {
      // Only original files cross this boundary. No GT, previews or source-specific IDs.
      const result = await adapter.compare(item.input, controller.signal);
      if (current === sequence.current && !controller.signal.aborted) {
        validateComparison(result, item.input);
        setComparison(result);
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
    item,
    comparison,
    loading,
    running,
    error,
    listError,
    select,
    upload,
    reset,
    run,
    retryList: () => refreshList((v) => v + 1),
    retryInput: () => lastLoad.current?.(),
  };
}
