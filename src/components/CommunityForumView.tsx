import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Play,
  Plus,
  Search,
  Send,
  ThumbsUp,
  WifiOff,
  X,
} from 'lucide-react';
import { ForumThread } from '../types/app';
import { getRankForXp } from '../utils/storage';

interface CommunityForumViewProps {
  threads: ForumThread[];
  learnerName: string;
  learnerXp: number;
  isOnline: boolean;
  onCreateThread: (thread: Omit<ForumThread, 'id' | 'createdAt' | 'upvotes' | 'replies'>) => void;
  onAddReply: (threadId: string, body: string, formulaSnippet?: string) => void;
  onToggleUpvoteThread: (threadId: string) => void;
  onTryFormulaInSimulator: (formula: string, presetModuleId?: string) => void;
}

const TOPICS: Array<'Semua' | ForumThread['topic']> = [
  'Semua',
  'Dasar',
  'Logika',
  'Teks & Tanggal',
  'Pencarian',
  'Tips Kasus',
];

export const CommunityForumView: React.FC<CommunityForumViewProps> = ({
  threads,
  learnerName,
  learnerXp,
  isOnline,
  onCreateThread,
  onAddReply,
  onToggleUpvoteThread,
  onTryFormulaInSimulator,
}) => {
  const [topicFilter, setTopicFilter] = useState<'Semua' | ForumThread['topic']>('Semua');
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(threads[0]?.id ?? '');
  const [showNewModal, setShowNewModal] = useState(false);

  // New thread form
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState<ForumThread['topic']>('Logika');
  const [newBody, setNewBody] = useState('');
  const [newFormula, setNewFormula] = useState('');

  // Reply form
  const [replyBody, setReplyBody] = useState('');
  const [replyFormula, setReplyFormula] = useState('');

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      const matchTopic = topicFilter === 'Semua' || t.topic === topicFilter;
      const matchQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.formulaSnippet && t.formulaSnippet.toLowerCase().includes(q));
      return matchTopic && matchQuery;
    });
  }, [threads, topicFilter, search]);

  const activeThread =
    filteredThreads.find((t) => t.id === selectedThreadId) ?? filteredThreads[0] ?? null;

  const rankTitle = getRankForXp(learnerXp).title;

  const handleSubmitThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    onCreateThread({
      topic: newTopic,
      title: newTitle.trim(),
      author: learnerName,
      authorRank: rankTitle,
      body: newBody.trim(),
      formulaSnippet: newFormula.trim() || undefined,
      pendingSync: !isOnline,
    });
    setNewTitle('');
    setNewBody('');
    setNewFormula('');
    setShowNewModal(false);
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyBody.trim()) return;
    onAddReply(activeThread.id, replyBody.trim(), replyFormula.trim() || undefined);
    setReplyBody('');
    setReplyFormula('');
  };

  return (
    <section aria-label="Forum Diskusi Komunitas Excel" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Forum Komunitas & Diskusi Rumus
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Diskusikan studi kasus, bagikan variasi rumus, dan uji langsung cuplikan formula komunitas di simulator.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Buat Diskusi Baru
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setTopicFilter(topic)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                topicFilter === topic
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari topik atau fungsi (=XLOOKUP)..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Two-Column Forum Master-Detail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Thread List */}
        <div className="space-y-3 lg:col-span-5">
          {filteredThreads.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Tidak ada diskusi yang cocok dengan pencarian Anda.
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isSelected = activeThread?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`block w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-teal-700 bg-white ring-1 ring-teal-700/20 dark:border-teal-500 dark:bg-slate-900 dark:ring-teal-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {thread.topic} · {thread.createdAt}
                    </span>
                    {thread.pendingSync && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <WifiOff className="h-3 w-3" aria-hidden="true" />
                        Tersimpan Offline
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {thread.title}
                  </h2>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {thread.author} · {thread.authorRank}
                    </span>
                    <span className="inline-flex items-center gap-3 font-mono tabular-nums">
                      <span>{thread.upvotes} suka</span>
                      <span>{thread.replies.length} balasan</span>
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Thread Detail View */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          {activeThread ? (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {activeThread.topic} · Oleh {activeThread.author} ({activeThread.authorRank}) ·{' '}
                    {activeThread.createdAt}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleUpvoteThread(activeThread.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeThread.upvotedByMe
                        ? 'border-teal-700 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{activeThread.upvotes}</span>
                  </button>
                </div>

                <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white">
                  {activeThread.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {activeThread.body}
                </p>

                {activeThread.formulaSnippet && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <code className="font-mono text-xs text-teal-800 dark:text-teal-300">
                      {activeThread.formulaSnippet}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        onTryFormulaInSimulator(
                          activeThread.formulaSnippet!,
                          activeThread.presetModuleId
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      Coba di Simulator
                    </button>
                  </div>
                )}
              </div>

              {/* Replies */}
              <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                  <MessageSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                  Balasan Komunitas ({activeThread.replies.length})
                </div>

                {activeThread.replies.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belum ada balasan. Jadilah yang pertama membagikan solusi atau pengalaman Anda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activeThread.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            <strong className="text-slate-900 dark:text-white">{rep.author}</strong>{' '}
                            · {rep.authorRank} · {rep.createdAt}
                          </span>
                          {rep.pendingSync && (
                            <span className="text-amber-600 dark:text-amber-400">
                              Tersimpan Offline
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{rep.body}</p>
                        {rep.formulaSnippet && (
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                            <code className="font-mono text-xs text-teal-800 dark:text-teal-300">
                              {rep.formulaSnippet}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                onTryFormulaInSimulator(
                                  rep.formulaSnippet!,
                                  activeThread.presetModuleId
                                )
                              }
                              className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
                            >
                              Uji Rumus
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Reply Form */}
                <form onSubmit={handleSubmitReply} className="space-y-3 pt-2">
                  <textarea
                    rows={3}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Tulis tanggapan, penjelasan logika, atau tips rumus Anda..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={replyFormula}
                      onChange={(e) => setReplyFormula(e.target.value)}
                      placeholder="Opsional: lampirkan contoh rumus (=SUMIF(...))"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Kirim Balasan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Pilih topik diskusi di sebelah kiri untuk membaca pembahasan lengkap.
            </div>
          )}
        </div>
      </div>

      {/* Create New Thread Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-thread"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <h2
                id="modal-new-thread"
                className="font-display text-lg font-bold text-slate-900 dark:text-white"
              >
                Buat Diskusi Komunitas Baru
              </h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                aria-label="Tutup modal"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitThread} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Kategori Topik
                </label>
                <select
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value as ForumThread['topic'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="Dasar">Dasar</option>
                  <option value="Logika">Logika</option>
                  <option value="Teks & Tanggal">Teks & Tanggal</option>
                  <option value="Pencarian">Pencarian</option>
                  <option value="Tips Kasus">Tips Kasus</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Judul Diskusi
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Cara menggabungkan INDEX MATCH untuk dua kondisi"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Penjelasan atau Pertanyaan
                </label>
                <textarea
                  rows={4}
                  required
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Jelaskan kasus tabel atau kendala rumus yang ingin didiskusikan..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Contoh Rumus Terkait (Opsional)
                </label>
                <input
                  type="text"
                  value={newFormula}
                  onChange={(e) => setNewFormula(e.target.value)}
                  placeholder="=IFERROR(VLOOKUP(E2,A2:C5,3,FALSE),0)"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  {isOnline ? 'Terbitkan Diskusi' : 'Simpan Draft Offline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
