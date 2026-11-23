import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  HelpCircle,
  MousePointerClick,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CURRICULUM_MODULES,
  FORMULA_CATALOG,
  LEVEL_METADATA,
  SANDBOX_INITIAL_GRID,
} from '../data/curriculum';
import {
  COLS,
  ROWS,
  evaluateGrid,
  extractCellReferences,
} from '../engine/excelEngine';
import { LessonModule, LevelId, SheetGrid } from '../types/app';

interface SpreadsheetSimulatorProps {
  selectedModuleId: string;
  onSelectModuleId: (id: string) => void;
  completedModuleIds: string[];
  onCompleteModule: (module: LessonModule, elapsedSeconds: number) => void;
  onRecordAttempt: (isCorrect: boolean) => void;
  injectedFormula?: { formula: string; timestamp: number; source?: 'forum' | 'cheatsheet' } | null;
  onOpenCheatSheet?: () => void;
}

type SimulatorTab = LevelId | 'sandbox';
type CatalogCategory =
  | 'Semua'
  | 'Dasar'
  | 'Logika'
  | 'Teks & Tanggal'
  | 'Pencarian'
  | 'Statistical'
  | 'Financial';

function expectsOperandInFormula(draft: string): boolean {
  if (!draft.startsWith('=')) return false;
  const trimmed = draft.trimEnd();
  if (trimmed === '=') return true;
  const lastChar = trimmed[trimmed.length - 1];
  return ['(', ',', ';', '+', '-', '*', '/', '^', '=', '<', '>', '&', ':'].includes(lastChar);
}

export const SpreadsheetSimulator: React.FC<SpreadsheetSimulatorProps> = ({
  selectedModuleId,
  onSelectModuleId,
  completedModuleIds,
  onCompleteModule,
  onRecordAttempt,
  injectedFormula,
  onOpenCheatSheet,
}) => {
  const activeModule = useMemo(
    () => CURRICULUM_MODULES.find((m) => m.id === selectedModuleId) ?? CURRICULUM_MODULES[0],
    [selectedModuleId]
  );

  const [levelTab, setLevelTab] = useState<SimulatorTab>(activeModule.level);
  const [grid, setGrid] = useState<SheetGrid>(() => structuredClone(activeModule.initialGrid));
  const [selectedCell, setSelectedCell] = useState<string>(activeModule.targetCell);
  const [formulaDraft, setFormulaDraft] = useState<string>(
    activeModule.initialGrid[activeModule.targetCell]?.raw ?? ''
  );
  const [inlineEditingCell, setInlineEditingCell] = useState<string | null>(null);
  const [isFormulaFocused, setIsFormulaFocused] = useState<boolean>(false);
  const [dragAnchorCell, setDragAnchorCell] = useState<string | null>(null);
  const [dragBaseDraft, setDragBaseDraft] = useState<string>('');
  const [showQuickGuide, setShowQuickGuide] = useState<boolean>(true);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    detail: string;
  } | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [moduleStartTime, setModuleStartTime] = useState<number>(() => Date.now());
  const [sideTab, setSideTab] = useState<'tugas' | 'referensi'>('tugas');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>('Semua');

  const formulaInputRef = useRef<HTMLInputElement | null>(null);

  // Sync grid when switching module
  useEffect(() => {
    if (levelTab === 'sandbox') {
      setGrid(structuredClone(SANDBOX_INITIAL_GRID));
      setSelectedCell('D2');
      setFormulaDraft(SANDBOX_INITIAL_GRID['D2']?.raw ?? '');
      setInlineEditingCell(null);
      setFeedback(null);
      setShowHint(false);
      setActiveStepIdx(0);
    } else {
      const mod = CURRICULUM_MODULES.find((m) => m.id === selectedModuleId);
      if (mod) {
        if (mod.level !== levelTab) {
          setLevelTab(mod.level);
        }
        setGrid(structuredClone(mod.initialGrid));
        setSelectedCell(mod.targetCell);
        setFormulaDraft(mod.initialGrid[mod.targetCell]?.raw ?? '');
        setInlineEditingCell(null);
        setFeedback(null);
        setShowHint(false);
        setActiveStepIdx(0);
        setModuleStartTime(Date.now());
      }
    }
  }, [selectedModuleId]);

  // Handle forum-injected formula ("Coba di Simulator")
  useEffect(() => {
    if (!injectedFormula) return;
    setFormulaDraft(injectedFormula.formula);
    setGrid((prev) => ({
      ...prev,
      [selectedCell]: {
        ...(prev[selectedCell] ?? {}),
        raw: injectedFormula.formula,
      },
    }));
    setFeedback({
      type: 'info',
      title:
        injectedFormula.source === 'cheatsheet'
          ? 'Contoh Rumus Cheat Sheet Disisipkan'
          : 'Rumus dari Komunitas Dimuat',
      detail: `Rumus ${injectedFormula.formula} diterapkan ke sel ${selectedCell}. Anda dapat menyesuaikan rentang sel atau melihat alur evaluasinya di bawah.`,
    });
  }, [injectedFormula]);

  // Release drag state globally
  useEffect(() => {
    const handleMouseUp = () => {
      setDragAnchorCell(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const nextModule = useMemo(() => {
    const currentIdx = CURRICULUM_MODULES.findIndex((m) => m.id === activeModule.id);
    const upcomingUnfinished = CURRICULUM_MODULES.find(
      (m, idx) => idx > currentIdx && !completedModuleIds.includes(m.id)
    );
    if (upcomingUnfinished) return upcomingUnfinished;
    return CURRICULUM_MODULES[currentIdx + 1] ?? null;
  }, [activeModule.id, completedModuleIds]);

  const switchToSandbox = () => {
    setLevelTab('sandbox');
    setGrid(structuredClone(SANDBOX_INITIAL_GRID));
    setSelectedCell('D2');
    setFormulaDraft(SANDBOX_INITIAL_GRID['D2']?.raw ?? '');
    setInlineEditingCell(null);
    setFeedback(null);
    setShowHint(false);
    setActiveStepIdx(0);
  };

  const switchToLevel = (lvl: LevelId) => {
    setLevelTab(lvl);
    const firstMod = CURRICULUM_MODULES.find((m) => m.level === lvl);
    if (firstMod) {
      onSelectModuleId(firstMod.id);
    }
  };

  const evaluated = useMemo(() => evaluateGrid(grid), [grid]);
  const activeCellEval = evaluated[selectedCell];

  const referencedCoords = useMemo(() => {
    if (formulaDraft.startsWith('=')) {
      return extractCellReferences(formulaDraft);
    }
    return activeCellEval?.referencedCells ?? [];
  }, [formulaDraft, activeCellEval]);

  const autocompleteMatches = useMemo(() => {
    if (!formulaDraft.startsWith('=')) return [];
    const match = /=([A-Za-z]{1,12})$/.exec(formulaDraft.trim());
    if (!match) return [];
    const query = match[1].toUpperCase();
    return FORMULA_CATALOG.filter((f) => f.name.startsWith(query)).slice(0, 5);
  }, [formulaDraft]);

  const activeSyntaxGuide = useMemo(() => {
    if (!formulaDraft.startsWith('=')) return null;
    const fnMatches = [...formulaDraft.matchAll(/([A-Za-z]+)\(/g)];
    if (fnMatches.length === 0) return null;
    const lastFn = fnMatches[fnMatches.length - 1][1].toUpperCase();
    return FORMULA_CATALOG.find((f) => f.name === lastFn) ?? null;
  }, [formulaDraft]);

  const isPickCellMode =
    (isFormulaFocused || inlineEditingCell !== null) && expectsOperandInFormula(formulaDraft);

  const commitCellValue = (coord: string, value: string) => {
    const existing = grid[coord];
    if (levelTab !== 'sandbox' && existing?.readOnly) return;
    setGrid((prev) => ({
      ...prev,
      [coord]: {
        ...(prev[coord] ?? {}),
        raw: value,
      },
    }));
  };

  const handleCellMouseDown = (e: React.MouseEvent, coord: string) => {
    // Point-and-click cell/range reference insertion while building a formula
    if (isPickCellMode && coord !== selectedCell) {
      e.preventDefault();
      const base = formulaDraft;
      const nextDraft = `${base}${coord}`;
      setDragAnchorCell(coord);
      setDragBaseDraft(base);
      setFormulaDraft(nextDraft);
      commitCellValue(selectedCell, nextDraft);
      return;
    }

    // Standard selection
    setInlineEditingCell(null);
    setSelectedCell(coord);
    setFormulaDraft(grid[coord]?.raw ?? '');
    setActiveStepIdx(0);
  };

  const handleCellMouseEnter = (coord: string) => {
    if (!dragAnchorCell) return;
    const rangeStr = dragAnchorCell === coord ? coord : `${dragAnchorCell}:${coord}`;
    const nextDraft = `${dragBaseDraft}${rangeStr}`;
    setFormulaDraft(nextDraft);
    commitCellValue(selectedCell, nextDraft);
  };

  const handleCellDoubleClick = (coord: string) => {
    if (levelTab !== 'sandbox' && grid[coord]?.readOnly) return;
    setSelectedCell(coord);
    setFormulaDraft(grid[coord]?.raw ?? '');
    setInlineEditingCell(coord);
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCellValue(selectedCell, formulaDraft);
      setInlineEditingCell(null);
      if (levelTab !== 'sandbox' && selectedCell === activeModule.targetCell) {
        verifyTargetCell(formulaDraft);
      }
    } else if (e.key === 'Escape') {
      setInlineEditingCell(null);
    }
  };

  const handleInsertFunctionSuggestion = (fnName: string) => {
    const replaced = formulaDraft.replace(/=[A-Za-z]{1,12}$/, `=${fnName}(`);
    setFormulaDraft(replaced);
    commitCellValue(selectedCell, replaced);
    formulaInputRef.current?.focus();
  };

  const handleQuickInsertFunctionChip = (fnName: string) => {
    const target = levelTab === 'sandbox' ? selectedCell : activeModule.targetCell;
    if (levelTab !== 'sandbox' && selectedCell !== target) {
      setSelectedCell(target);
    }
    const base = formulaDraft.startsWith('=') ? formulaDraft : '=';
    const next = base === '=' ? `=${fnName}(` : `${base}${fnName}(`;
    setFormulaDraft(next);
    commitCellValue(target, next);
    setTimeout(() => formulaInputRef.current?.focus(), 0);
  };

  const handleResetSheet = () => {
    if (levelTab === 'sandbox') {
      setGrid(structuredClone(SANDBOX_INITIAL_GRID));
      setSelectedCell('D2');
      setFormulaDraft(SANDBOX_INITIAL_GRID['D2']?.raw ?? '');
    } else {
      setGrid(structuredClone(activeModule.initialGrid));
      setSelectedCell(activeModule.targetCell);
      setFormulaDraft(activeModule.initialGrid[activeModule.targetCell]?.raw ?? '');
    }
    setInlineEditingCell(null);
    setFeedback(null);
    setActiveStepIdx(0);
  };

  const handleApplySolution = () => {
    if (levelTab === 'sandbox') return;
    const target = activeModule.targetCell;
    const sol = activeModule.solutionFormula;
    setSelectedCell(target);
    setInlineEditingCell(null);
    setFormulaDraft(sol);
    setGrid((prev) => ({
      ...prev,
      [target]: {
        ...(prev[target] ?? {}),
        raw: sol,
      },
    }));
    setFeedback({
      type: 'info',
      title: 'Contoh Rumus Diterapkan',
      detail: `Rumus ${sol} sudah diisi ke sel ${target}. Sekarang klik "Periksa Jawaban" atau ubah rumusnya untuk bereksperimen.`,
    });
  };

  const handleFocusTargetCell = () => {
    if (levelTab === 'sandbox') return;
    const target = activeModule.targetCell;
    setSelectedCell(target);
    setFormulaDraft(grid[target]?.raw ?? '');
    setTimeout(() => formulaInputRef.current?.focus(), 0);
  };

  const verifyTargetCell = (overrideFormula?: string) => {
    if (levelTab === 'sandbox') return;
    const target = activeModule.targetCell;
    const rawFormula = (overrideFormula ?? grid[target]?.raw ?? '').trim();

    const testGrid: SheetGrid = {
      ...grid,
      [target]: { ...(grid[target] ?? {}), raw: rawFormula },
    };
    if (overrideFormula !== undefined) {
      setGrid(testGrid);
    }

    const resMap = evaluateGrid(testGrid);
    const cellRes = resMap[target];

    if (!rawFormula.startsWith('=')) {
      onRecordAttempt(false);
      setFeedback({
        type: 'error',
        title: 'Gunakan Rumus Excel (=)',
        detail: `Sel ${target} harus diawali tanda sama dengan (=), misalnya dengan klik tombol fungsi ${activeModule.requiredFunctions[0]} di atas tabel.`,
      });
      return;
    }

    const upperFormula = rawFormula.toUpperCase();
    const missingFn = activeModule.requiredFunctions.find(
      (fn) => !upperFormula.includes(`${fn.toUpperCase()}(`)
    );
    if (missingFn) {
      onRecordAttempt(false);
      setFeedback({
        type: 'error',
        title: `Fungsi ${missingFn} Belum Digunakan`,
        detail: `Pada latihan ini, pastikan rumus di sel ${target} memakai fungsi ${missingFn}(...) agar sesuai tujuan belajar.`,
      });
      return;
    }

    if (!cellRes || cellRes.error) {
      onRecordAttempt(false);
      setFeedback({
        type: 'error',
        title: `Terdapat Galat Rumus (${cellRes?.error ?? 'Error'})`,
        detail: 'Periksa kembali tanda kurung tutup ), tanda kutip teks "...", serta rentang sel Anda.',
      });
      return;
    }

    const actualVal = cellRes.value;
    const expectedVal = activeModule.expectedValue;
    let isMatch = false;

    if (typeof expectedVal === 'number' && typeof actualVal === 'number') {
      const tol = activeModule.numericTolerance ?? 0.01;
      isMatch = Math.abs(actualVal - expectedVal) <= tol;
    } else {
      isMatch =
        String(actualVal ?? '').trim().toLowerCase() ===
        String(expectedVal).trim().toLowerCase();
    }

    if (isMatch) {
      onRecordAttempt(true);
      const elapsedSeconds = Math.max(15, Math.round((Date.now() - moduleStartTime) / 1000));
      onCompleteModule(activeModule, elapsedSeconds);
      setFeedback({
        type: 'success',
        title: `Tepat Sekali! (+${activeModule.xpReward} XP)`,
        detail: `Rumus ${rawFormula} menghasilkan ${cellRes.displayValue}. Progres dan penguasaan fungsi ${activeModule.functionsCovered.join(', ')} telah tersimpan.`,
      });
    } else {
      onRecordAttempt(false);
      setFeedback({
        type: 'error',
        title: 'Hasil Belum Sesuai Target',
        detail: `Rumus Anda menghasilkan "${cellRes.displayValue}", sedangkan hasil yang diharapkan adalah "${expectedVal}". Coba periksa rentang sel atau klik "Petunjuk".`,
      });
    }
  };

  const levelModules = useMemo(() => {
    if (levelTab === 'sandbox') return [];
    return CURRICULUM_MODULES.filter((m) => m.level === levelTab);
  }, [levelTab]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return FORMULA_CATALOG.filter((f) => {
      const matchCat = catalogCategory === 'Semua' || f.category === catalogCategory;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [catalogSearch, catalogCategory]);

  const evalSteps = activeCellEval?.steps ?? [];
  const currentStep = evalSteps[activeStepIdx] ?? null;

  const quickChips =
    levelTab === 'sandbox'
      ? ['SUM', 'AVERAGE', 'IF', 'COUNTIF', 'VLOOKUP']
      : Array.from(new Set([...activeModule.requiredFunctions, ...activeModule.functionsCovered]));

  return (
    <section aria-label="Simulator Spreadsheet Interaktif" className="space-y-5">
      {/* Level & Sandbox Segmented Selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Laboratorium Simulasi Fungsi Excel
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Klik sel kuning target, tekan tombol fungsi atau ketik rumus, lalu klik sel di tabel untuk mengisi koordinat otomatis.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Pilih level belajar"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          {([1, 2, 3, 4] as LevelId[]).map((lvl) => {
            const active = levelTab === lvl;
            const totalInLvl = CURRICULUM_MODULES.filter((m) => m.level === lvl).length;
            const doneInLvl = CURRICULUM_MODULES.filter(
              (m) => m.level === lvl && completedModuleIds.includes(m.id)
            ).length;
            return (
              <button
                key={lvl}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchToLevel(lvl)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Level {lvl}{' '}
                <span className="ml-1 font-mono tabular-nums opacity-75">
                  {doneInLvl}/{totalInLvl}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={levelTab === 'sandbox'}
            onClick={switchToSandbox}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              levelTab === 'sandbox'
                ? 'bg-teal-700 text-white shadow-sm dark:bg-teal-600'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Sandbox Bebas
          </button>
        </div>
      </div>

      {/* Collapsible 3-Step Beginner Quick Guide */}
      {showQuickGuide && levelTab !== 'sandbox' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-900 dark:text-white">Cara Cepat Mulai:</span>
            <span>
              <strong className="font-mono text-teal-700 dark:text-teal-400">1.</strong> Sel target{' '}
              <strong className="font-mono">{activeModule.targetCell}</strong> sudah terpilih
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              <strong className="font-mono text-teal-700 dark:text-teal-400">2.</strong> Klik tombol rumus cepat atau ketik{' '}
              <code className="font-mono text-teal-700 dark:text-teal-400">=</code> lalu klik/seret sel data di tabel
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              <strong className="font-mono text-teal-700 dark:text-teal-400">3.</strong> Tekan{' '}
              <strong>Enter</strong> atau klik <strong>Periksa Jawaban</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickGuide(false)}
            aria-label="Sembunyikan panduan cepat"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Module Selector Row inside Active Level */}
      {levelTab !== 'sandbox' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {levelModules.map((mod) => {
            const isSelected = mod.id === activeModule.id;
            const isDone = completedModuleIds.includes(mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onSelectModuleId(mod.id)}
                className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-teal-700 bg-white ring-1 ring-teal-700/20 dark:border-teal-500 dark:bg-slate-900 dark:ring-teal-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {mod.mode === 'case-study' ? 'Studi Kasus' : 'Latihan Mandiri'} · {mod.estimatedMinutes} mnt · +{mod.xpReward} XP
                    </span>
                    {isDone && (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400"
                        aria-label="Selesai"
                      />
                    )}
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {mod.title}
                  </h2>
                </div>
                <div className="mt-3 font-mono text-xs text-teal-800 dark:text-teal-300">
                  {mod.functionsCovered.join(' · ')}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Two-Zone Interactive Sandbox */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT ZONE (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Formula Bar */}
            <div className="relative flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div
                title="Koordinat sel aktif"
                className="flex h-9 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white font-mono text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {selectedCell}
              </div>
              <div className="flex h-9 items-center px-1.5 font-mono text-sm font-semibold italic text-teal-700 dark:text-teal-400">
                fx
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <input
                  ref={formulaInputRef}
                  type="text"
                  aria-label={`Bilah formula untuk sel ${selectedCell}`}
                  value={formulaDraft}
                  readOnly={levelTab !== 'sandbox' && Boolean(grid[selectedCell]?.readOnly)}
                  onFocus={() => setIsFormulaFocused(true)}
                  onBlur={() => setIsFormulaFocused(false)}
                  onChange={(e) => {
                    setFormulaDraft(e.target.value);
                    commitCellValue(selectedCell, e.target.value);
                  }}
                  onKeyDown={handleFormulaKeyDown}
                  placeholder={
                    levelTab !== 'sandbox' && grid[selectedCell]?.readOnly
                      ? `Sel referensi — klik sel target ${activeModule.targetCell} untuk menjawab`
                      : 'Ketik = lalu rumus (misal =SUM(D2:D6))...'
                  }
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-teal-400"
                />
                {autocompleteMatches.length > 0 && (
                  <div className="absolute left-0 top-10 z-20 w-full max-w-md rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {autocompleteMatches.map((fn) => (
                      <button
                        key={fn.name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertFunctionSuggestion(fn.name);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">
                          {fn.name}
                        </span>
                        <span className="truncate text-slate-500 dark:text-slate-400">
                          {fn.syntax}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  commitCellValue(selectedCell, formulaDraft);
                  if (levelTab !== 'sandbox' && selectedCell === activeModule.targetCell) {
                    verifyTargetCell(formulaDraft);
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Terapkan
              </button>
              <button
                type="button"
                onClick={handleResetSheet}
                title="Reset lembar kerja"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
              {onOpenCheatSheet && (
                <button
                  type="button"
                  onClick={onOpenCheatSheet}
                  title="Buka Cheat Sheet Rumus Excel (Ctrl+K)"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-700/30 bg-teal-50 px-3 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/70 whitespace-nowrap"
                >
                  <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cheat Sheet</span>
                  <kbd className="hidden sm:inline rounded border border-teal-700/20 bg-white/80 px-1 py-0.5 font-mono text-[10px] dark:border-teal-500/30 dark:bg-slate-900">
                    Ctrl+K
                  </kbd>
                </button>
              )}
            </div>

            {/* Beginner Quick Function Buttons & Live Syntax Helper Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Sisipkan cepat:
                </span>
                {quickChips.map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleQuickInsertFunctionChip(fn);
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-teal-800 transition-colors hover:border-teal-600 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:border-teal-500 dark:hover:bg-teal-950/40"
                  >
                    ={fn}(
                  </button>
                ))}

                {levelTab !== 'sandbox' && selectedCell !== activeModule.targetCell && (
                  <button
                    type="button"
                    onClick={handleFocusTargetCell}
                    className="ml-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                  >
                    Kembali ke Sel Target {activeModule.targetCell}
                  </button>
                )}
              </div>

              {isPickCellMode ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                  <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                  Klik atau seret sel di tabel untuk mengisi referensi
                </span>
              ) : activeSyntaxGuide ? (
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  Pola: <strong>{activeSyntaxGuide.syntax}</strong>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Klik dua kali sel mana saja untuk mengetik langsung di tabel
                </span>
              )}
            </div>

            {/* Spreadsheet Table */}
            <div className="overflow-x-auto select-none">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80">
                    <th className="w-10 border-b border-r border-slate-200 px-2 py-2 text-center font-mono text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      #
                    </th>
                    {COLS.map((col) => (
                      <th
                        key={col}
                        className="min-w-[120px] border-b border-r border-slate-200 px-3 py-2 text-center font-mono text-xs font-semibold text-slate-600 last:border-r-0 dark:border-slate-700 dark:text-slate-300"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.slice(0, 10).map((row) => (
                    <tr key={row} className="h-10">
                      <th className="border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-center font-mono text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                        {row}
                      </th>
                      {COLS.map((col) => {
                        const coord = `${col}${row}`;
                        const cell = grid[coord];
                        const ev = evaluated[coord];
                        const isSelected = selectedCell === coord;
                        const isReferenced = referencedCoords.includes(coord);
                        const isTarget = levelTab !== 'sandbox' && coord === activeModule.targetCell;
                        const isHeader = cell?.format === 'header';
                        const isNumeric = typeof ev?.value === 'number';
                        const hasFormula = cell?.raw?.startsWith('=');
                        const isInlineEditing = inlineEditingCell === coord;

                        return (
                          <td
                            key={coord}
                            onMouseDown={(e) => handleCellMouseDown(e, coord)}
                            onMouseEnter={() => handleCellMouseEnter(coord)}
                            onDoubleClick={() => handleCellDoubleClick(coord)}
                            className={`relative cursor-pointer border-b border-r border-slate-200 px-2.5 py-1.5 transition-colors last:border-r-0 dark:border-slate-800 ${
                              isHeader
                                ? 'bg-slate-100/90 font-semibold text-slate-800 dark:bg-slate-800/70 dark:text-slate-100'
                                : isSelected
                                  ? 'bg-teal-50/70 dark:bg-teal-950/40'
                                  : isReferenced
                                    ? 'bg-sky-50/80 dark:bg-sky-950/30'
                                    : isTarget
                                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                                      : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50'
                            } ${
                              isSelected
                                ? 'outline-2 -outline-offset-2 outline-teal-700 dark:outline-teal-400'
                                : isReferenced
                                  ? 'outline-1 -outline-offset-1 outline-dashed outline-sky-600 dark:outline-sky-400'
                                  : isTarget
                                    ? 'outline-1 -outline-offset-1 outline-dashed outline-amber-600 dark:outline-amber-400'
                                    : ''
                            }`}
                          >
                            {isInlineEditing ? (
                              <input
                                type="text"
                                autoFocus
                                value={formulaDraft}
                                onChange={(e) => {
                                  setFormulaDraft(e.target.value);
                                  commitCellValue(coord, e.target.value);
                                }}
                                onKeyDown={handleFormulaKeyDown}
                                onBlur={() => setInlineEditingCell(null)}
                                className="w-full bg-transparent font-mono text-xs text-slate-900 focus:outline-none dark:text-white"
                              />
                            ) : (
                              <div
                                className={`flex items-center justify-between gap-1.5 font-mono text-xs sm:text-[13px] tabular-nums ${
                                  ev?.error
                                    ? 'font-semibold text-rose-600 dark:text-rose-400'
                                    : isNumeric
                                      ? 'justify-end text-slate-900 dark:text-slate-100'
                                      : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <span className="truncate">
                                  {ev?.displayValue ?? ''}
                                </span>
                                {hasFormula && !isSelected && (
                                  <span
                                    title={`Rumus: ${cell?.raw}`}
                                    className="text-[10px] text-teal-700/70 dark:text-teal-400/70 shrink-0"
                                  >
                                    fx
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border-2 border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950" />
                  Sel Aktif ({selectedCell})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm border border-dashed border-sky-600 bg-sky-50 dark:border-sky-400 dark:bg-sky-950" />
                  Sel Referensi Rumus
                </span>
                {levelTab !== 'sandbox' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-dashed border-amber-600 bg-amber-50 dark:border-amber-400 dark:bg-amber-950" />
                    Sel Target Jawaban ({activeModule.targetCell})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Mendukung koma (,) maupun titik koma (;)
              </span>
            </div>
          </div>

          {/* Interactive Step-by-Step Formula Evaluation Debugger */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Simulasi Alur Evaluasi Rumus · Sel {selectedCell}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lihat bagaimana rumus dihitung langkah demi langkah oleh Excel.
                </p>
              </div>
              {evalSteps.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeStepIdx === 0}
                    onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                    className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Langkah sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    Langkah {activeStepIdx + 1}/{evalSteps.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeStepIdx >= evalSteps.length - 1}
                    onClick={() => setActiveStepIdx((i) => Math.min(evalSteps.length - 1, i + 1))}
                    className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Langkah berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {currentStep ? (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 dark:border-slate-800">
                <div className="sm:col-span-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Proses Evaluasi</div>
                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {currentStep.description}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                    Ekspresi: {currentStep.expression}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Hasil Langkah Ini</div>
                  <div className="mt-1 font-mono text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
                    {currentStep.result}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Pilih sel berisi rumus (=...) untuk menelusuri alur perhitungannya di sini.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT ZONE (4 cols): Concept & Control Deck */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSideTab('tugas')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sideTab === 'tugas'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {levelTab === 'sandbox' ? 'Panduan Sandbox' : 'Instruksi Kasus'}
            </button>
            <button
              type="button"
              onClick={() => setSideTab('referensi')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                sideTab === 'referensi'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Katalog Rumus ({FORMULA_CATALOG.length})
            </button>
          </div>

          {sideTab === 'tugas' ? (
            levelTab === 'sandbox' ? (
              <div className="mt-5 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Mode Eksplorasi Bebas
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Klik dua kali sel mana pun untuk mengubah angka, lalu ketik rumus bebas untuk bereksperimen tanpa batas.
                </p>
                <div className="space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Coba Eksperimen Cepat:
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCell('D6');
                      setFormulaDraft('=AVERAGE(D2:D4)');
                      commitCellValue('D6', '=AVERAGE(D2:D4)');
                    }}
                    className="block w-full rounded-lg border border-slate-200 p-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <div className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      =AVERAGE(D2:D4)
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      Hitung rata-rata selisih anggaran ke sel D6
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCell('E5');
                      setFormulaDraft('=COUNTIF(E2:E4,"Sesuai Anggaran")');
                      commitCellValue('E5', '=COUNTIF(E2:E4,"Sesuai Anggaran")');
                    }}
                    className="block w-full rounded-lg border border-slate-200 p-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <div className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      =COUNTIF(E2:E4,"Sesuai Anggaran")
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      Hitung berapa pos pengeluaran yang hemat di E5
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {LEVEL_METADATA[activeModule.level].title} · Target Sel {activeModule.targetCell}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                    {activeModule.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeModule.scenario}
                  </p>
                </div>

                {/* Target Cell Summary */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Sel Target</div>
                    <button
                      type="button"
                      onClick={handleFocusTargetCell}
                      className="mt-0.5 font-mono text-sm font-bold text-slate-900 underline decoration-dotted hover:text-teal-700 dark:text-white dark:hover:text-teal-400"
                    >
                      {activeModule.targetCell}
                    </button>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Fungsi Wajib</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-teal-700 dark:text-teal-400">
                      {activeModule.requiredFunctions.join(', ')}
                    </div>
                  </div>
                </div>

                {/* Case Study Walkthrough */}
                {activeModule.walkthroughSteps && activeModule.walkthroughSteps.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                      <BookOpen className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                      Panduan Studi Kasus
                    </div>
                    {activeModule.walkthroughSteps.map((step) => (
                      <div
                        key={step.title}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {step.title}
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                          {step.explanation}
                        </p>
                        <div className="mt-1.5 font-mono text-[11px] text-teal-800 dark:text-teal-300">
                          {step.targetCell}: {step.formula}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => verifyTargetCell()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Periksa Jawaban Sel {activeModule.targetCell}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {showHint ? 'Tutup Petunjuk' : 'Petunjuk'}
                    </button>

                    <button
                      type="button"
                      onClick={handleApplySolution}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Isi Contoh
                    </button>
                  </div>
                </div>

                {showHint && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <strong>Petunjuk:</strong> {activeModule.hint}
                  </div>
                )}

                {feedback && (
                  <div
                    role="status"
                    className={`rounded-lg border p-3.5 text-xs leading-relaxed ${
                      feedback.type === 'success'
                        ? 'border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100'
                        : feedback.type === 'error'
                          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                          : 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {feedback.type === 'success' ? (
                        <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>{feedback.title}</span>
                    </div>
                    <p className="mt-1 opacity-90">{feedback.detail}</p>
                    {feedback.type === 'success' && nextModule && (
                      <button
                        type="button"
                        onClick={() => onSelectModuleId(nextModule.id)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                      >
                        Lanjut ke Materi Berikutnya
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          ) : (
            /* Formula Quick Reference Tab */
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    'Semua',
                    'Dasar',
                    'Statistical',
                    'Logika',
                    'Teks & Tanggal',
                    'Pencarian',
                    'Financial',
                  ] as CatalogCategory[]
                ).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategory(cat)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        catalogCategory === cat
                          ? 'bg-teal-700 text-white dark:bg-teal-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Cari fungsi (SUM, IF, VLOOKUP...)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="max-h-[390px] space-y-2.5 overflow-y-auto pr-1">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {item.syntax}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {item.summary}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <code className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.example}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setFormulaDraft(item.example);
                          commitCellValue(selectedCell, item.example);
                        }}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/50 whitespace-nowrap"
                      >
                        <Code2 className="h-3 w-3" aria-hidden="true" />
                        Sisipkan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
