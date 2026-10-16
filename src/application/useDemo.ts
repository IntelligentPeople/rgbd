import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Comparison,
  DemoItem,
  DemoBackend,
  InferenceInput,
  SampleRepository,
  SampleSummary,
  InputFiles,
  InputRole,
} from '../domain/types';
import { prepareInput } from '../input/prepare';
import { validateUpload } from '../upload/validate';
import { validateComparison } from './comparison';
const message = (error: unknown) => (error instanceof Error ? error.message : '操作失败，请重试。');
export function useDemo(repository: SampleRepository, backend: DemoBackend) {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [files, setFiles] = useState<InputFiles>({});
  const filesRef = useRef<InputFiles>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<InputRole, string>>>({});
  const [checking, setChecking] = useState<Partial<Record<InputRole, boolean>>>({});
  const fieldRevisions = useRef({ rgb: 0, depth: 0 });
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
        if (current === sequence.current && !controller.signal.aborted) {
          filesRef.current = { rgb: value.input.rgb, depth: value.input.depth };
          setFiles(filesRef.current);
          setItem(value);
        }
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
      fieldRevisions.current.rgb++;
      fieldRevisions.current.depth++;
      filesRef.current = {};
      setFiles({});
      setFileErrors({});
      setChecking({});
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
        if (!items.length) setListError('没有可用样例。');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setListError(message(e));
      });
    return () => controller.abort();
  }, [repository, listRevision]);
  const upload = (input: InferenceInput) => {
    lastLoad.current = () => {
      void load((signal) => prepareInput(input, signal));
    };
    lastLoad.current();
  };
  const chooseFile = async (role: InputRole, file?: File) => {
    const revision = ++fieldRevisions.current[role];
    clear();
    setSelected('');
    lastLoad.current = undefined;
    filesRef.current = { ...filesRef.current, [role]: undefined };
    setFiles(filesRef.current);
    setFileErrors((current) => ({ ...current, [role]: undefined }));
    setChecking((current) => ({ ...current, [role]: Boolean(file) }));
    if (!file) return;
    try {
      await validateUpload(file, role);
      if (revision !== fieldRevisions.current[role]) return;
      filesRef.current = { ...filesRef.current, [role]: file };
      setFiles(filesRef.current);
      const { rgb, depth } = filesRef.current;
      if (rgb && depth) upload({ id: crypto.randomUUID(), rgb, depth });
    } catch (e) {
      if (revision === fieldRevisions.current[role])
        setFileErrors((current) => ({ ...current, [role]: message(e) }));
    } finally {
      if (revision === fieldRevisions.current[role])
        setChecking((current) => ({ ...current, [role]: false }));
    }
  };
  useEffect(
    () => () => {
      fieldRevisions.current.rgb++;
      fieldRevisions.current.depth++;
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
      const result = await backend.compare(item.input, controller.signal);
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
    files,
    fileErrors,
    checking,
    item,
    comparison,
    loading,
    running,
    error,
    listError,
    select,
    chooseFile,
    run,
    retryList: () => refreshList((v) => v + 1),
    retryInput: () => lastLoad.current?.(),
  };
}
