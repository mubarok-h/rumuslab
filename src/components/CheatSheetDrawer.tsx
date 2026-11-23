import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Check, Code2, Copy, Keyboard, Search, X } from 'lucide-react';
import { FORMULA_CATALOG } from '../data/curriculum';

interface CheatSheetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  highlightedFunctions?: string[];
  canInsertToCell: boolean;
  onInsertFormula: (formula: string) => void;
}

type CheatTab =
  | 'Semua'
  | 'Dasar'
  | 'Statistical'
  | 'Logika'
  | 'Teks & Tanggal'
  | 'Pencarian'
  | 'Financial'
  | 'Operator';

const OPERATORS_AND_SHORTCUTS = [
  {
    symbol: '=SUM(A1:A5)',
    label: 'Titik dua (:)',
    desc: 'Membentuk rentang sel berurutan dari A1 sampai A5.',
  },
  {
    symbol: ', atau ;',
    label: 'Pemisah argumen',
    desc: 'Memisahkan parameter rumus. RumusLab mendukung keduanya otomatis.',
  },
  {
    symbol: '"Teks"',
    label: 'Tanda kutip ganda',
    desc: 'Wajib membungkus teks kriteria seperti "Lunas" atau "Lulus".',
  },
  {
    symbol: '>=  <=  <>',
    label: 'Operator perbandingan',
    desc: 'Lebih besar sama dengan (>=), lebih kecil sama dengan (<=), tidak sama dengan (<>).',
  },
  {
    symbol: '&',
    label: 'Penggabung teks',
    desc: 'Menggabungkan isi dua sel atau teks, contoh: =A2&" "&B2.',
  },
  {
    symbol: 'Ctrl+K / Cmd+K',
    label: 'Buka / tutup Cheat Sheet',
    desc: 'Pintasan cepat kapan saja tanpa berpindah dari lembar kerja.',
  },
  {
    symbol: 'Klik & Seret',
    label: 'Pilih rentang otomatis',
    desc: 'Saat mengetik rumus (=), klik atau seret sel di tabel untuk mengisi rentang.',
  },
  {
    symbol: 'Klik 2x / Enter',
    label: 'Edit langsung & periksa',
    desc: 'Klik 2x sel untuk mengetik langsung; tekan Enter untuk menerapkan & cek hasil.',
  },
];

export const CheatSheetDrawer: React.FC<CheatSheetDrawerProps> = ({
  isOpen,
  onClose,
  highlightedFunctions = [],
  canInsertToCell,
  onInsertFormula,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CheatTab>('Semua');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const relatedItems = useMemo(() => {
    if (highlightedFunctions.length === 0) return [];
    return FORMULA_CATALOG.filter((f) => highlightedFunctions.includes(f.name));
  }, [highlightedFunctions]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULA_CATALOG.filter((item) => {
      const matchTab = activeTab === 'Semua' || item.category === activeTab;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.syntax.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [query, activeTab]);

  if (!isOpen) return null;

  const handleCopy = async (name: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedName(name);
      window.setTimeout(() => setCopiedName(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-drawer-title"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <h2
                id="cheatsheet-drawer-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                Cheat Sheet Rumus Excel
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Referensi sintaks cepat tanpa meninggalkan simulator · Tekan{' '}
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Ctrl+K
              </kbd>{' '}
              atau{' '}
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Esc
              </kbd>{' '}
              untuk menutup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Cheat Sheet"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filter Tabs */}
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activeTab === 'Operator' && e.target.value.trim()) {
                  setActiveTab('Semua');
                }
              }}
              placeholder="Cari sintaks fungsi (misal: VLOOKUP, SUMIF, TRIM)..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

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
                'Operator',
              ] as CheatTab[]
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-teal-700 text-white dark:bg-teal-600'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab === 'Operator' ? 'Operator & Pintasan' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {activeTab === 'Operator' ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                <Keyboard className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                Aturan Penulisan & Pintasan Keyboard
              </div>
              {OPERATORS_AND_SHORTCUTS.map((op) => (
                <div
                  key={op.label}
                  className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {op.label}
                    </span>
                    <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-800 dark:bg-slate-800 dark:text-teal-300">
                      {op.symbol}
                    </code>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{op.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Related Functions for Active Exercise */}
              {relatedItems.length > 0 && !query.trim() && activeTab === 'Semua' && (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                    Dipakai pada Latihan Aktif
                  </div>
                  {relatedItems.map((item) => (
                    <div
                      key={`rel-${item.name}`}
                      className="rounded-lg border border-teal-700/30 bg-teal-50/50 p-3.5 dark:border-teal-500/30 dark:bg-teal-950/25"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-teal-800 dark:text-teal-300">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                        {item.syntax}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {item.summary}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-teal-700/15 pt-2 dark:border-teal-500/20">
                        <code className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {item.example}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.name, item.example)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {copiedName === item.name ? (
                              <>
                                <Check className="h-3 w-3 text-teal-600" aria-hidden="true" />
                                Tersalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                Salin
                              </>
                            )}
                          </button>
                          {canInsertToCell && (
                            <button
                              type="button"
                              onClick={() => {
                                onInsertFormula(item.example);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 rounded bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                            >
                              <Code2 className="h-3 w-3" aria-hidden="true" />
                              Sisipkan ke Sel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full / Filtered Catalog */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Daftar Referensi Rumus ({filteredItems.length})
                </div>
                {filteredItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada rumus yang cocok dengan kata kunci "{query}".
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-200">
                        {item.syntax}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {item.summary}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <code className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {item.example}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.name, item.example)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {copiedName === item.name ? (
                              <>
                                <Check className="h-3 w-3 text-teal-600" aria-hidden="true" />
                                Tersalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                Salin
                              </>
                            )}
                          </button>
                          {canInsertToCell && (
                            <button
                              type="button"
                              onClick={() => {
                                onInsertFormula(item.example);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                            >
                              <Code2 className="h-3 w-3" aria-hidden="true" />
                              Sisipkan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
