import React, { useMemo, useState } from 'react';
import { Award, Check, Copy, Download, Lock, Share2, ArrowRight } from 'lucide-react';
import { CURRICULUM_MODULES, LEVEL_METADATA } from '../data/curriculum';
import { CertificateRecord, LevelId, UserProgressState } from '../types/app';

interface CertificatesViewProps {
  progress: UserProgressState;
  onJumpToModule: (moduleId: string) => void;
}

function downloadCertificatePng(cert: CertificateRecord) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean archival parchment-white backdrop
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle architectural border frame
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 10;
  ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(62, 62, canvas.width - 124, canvas.height - 124);

  // Header brand
  ctx.fillStyle = '#0F766E';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RUMUSLAB · AKADEMI SPREADSHEET INTERAKTIF', canvas.width / 2, 145);

  // Certificate Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 54px sans-serif';
  ctx.fillText('SERTIFIKAT PENYELESAIAN', canvas.width / 2, 240);

  ctx.fillStyle = '#475569';
  ctx.font = '400 24px sans-serif';
  ctx.fillText('Dengan bangga diberikan kepada:', canvas.width / 2, 325);

  // Learner Name
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 58px sans-serif';
  ctx.fillText(cert.learnerName, canvas.width / 2, 415);

  // Underline
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 445);
  ctx.lineTo(1050, 445);
  ctx.stroke();

  // Body description
  ctx.fillStyle = '#334155';
  ctx.font = '400 24px sans-serif';
  ctx.fillText(
    'Telah menyelesaikan seluruh studi kasus praktis dan latihan mandiri pada:',
    canvas.width / 2,
    515
  );

  ctx.fillStyle = '#0F766E';
  ctx.font = '700 34px sans-serif';
  ctx.fillText(cert.levelTitle, canvas.width / 2, 575);

  ctx.fillStyle = '#475569';
  ctx.font = '500 22px sans-serif';
  ctx.fillText(
    `Fokus Kompetensi: ${LEVEL_METADATA[cert.level].focus}`,
    canvas.width / 2,
    625
  );

  // Verification metadata row
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(160, 700, 1080, 110);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(160, 700, 1080, 110);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px sans-serif';
  ctx.fillText('TANGGAL TERBIT', 200, 740);
  ctx.fillText('AKURASI PENYELESAIAN', 560, 740);
  ctx.fillText('ID VERIFIKASI SERTIFIKAT', 900, 740);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px monospace';
  ctx.fillText(cert.issuedAt, 200, 778);
  ctx.fillText(`${cert.accuracyPercent}% (${cert.completedModules} modul)`, 560, 778);
  ctx.fillText(cert.id, 900, 778);

  // Footer signature
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px sans-serif';
  ctx.fillText('RumusLab Offline-Ready Certification · Terverifikasi Lokal', canvas.width / 2, 880);

  const link = document.createElement('a');
  link.download = `Sertifikat-RumusLab-Level-${cert.level}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  progress,
  onJumpToModule,
}) => {
  const [copiedLevel, setCopiedLevel] = useState<number | null>(null);

  const levelCards = useMemo(() => {
    const levels: LevelId[] = [1, 2, 3, 4];
    return levels.map((lvl) => {
      const mods = CURRICULUM_MODULES.filter((m) => m.level === lvl);
      const done = mods.filter((m) => progress.completedModuleIds.includes(m.id));
      const isComplete = done.length === mods.length && mods.length > 0;
      const nextMod = mods.find((m) => !progress.completedModuleIds.includes(m.id));
      const existingCert = progress.certificates[lvl];
      const cert: CertificateRecord | null = isComplete
        ? existingCert ?? {
            id: `RL-L${lvl}-${String(progress.xp).padStart(4, '0')}`,
            level: lvl,
            levelTitle: LEVEL_METADATA[lvl].title,
            learnerName: progress.learnerName,
            issuedAt: progress.lastActiveDate,
            accuracyPercent:
              progress.totalAttempts > 0
                ? Math.round((progress.correctAttempts / progress.totalAttempts) * 100)
                : 100,
            completedModules: mods.length,
          }
        : null;

      return {
        level: lvl,
        meta: LEVEL_METADATA[lvl],
        doneCount: done.length,
        totalCount: mods.length,
        isComplete,
        nextMod,
        cert,
      };
    });
  }, [progress]);

  const buildShareText = (cert: CertificateRecord) =>
    `Saya baru saja meraih Sertifikat ${cert.levelTitle} di RumusLab dengan fokus ${LEVEL_METADATA[cert.level].focus} (ID: ${cert.id}). Belajar rumus Excel jadi lebih mudah lewat simulasi interaktif!`;

  const handleSocialShare = (
    platform: 'linkedin' | 'x' | 'facebook' | 'whatsapp' | 'native',
    cert: CertificateRecord
  ) => {
    const text = buildShareText(cert);
    const url = window.location.origin;

    if (platform === 'native' && navigator.share) {
      void navigator.share({
        title: `Sertifikat ${cert.levelTitle} — RumusLab`,
        text,
        url,
      });
      return;
    }

    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);
    let shareUrl = '';

    if (platform === 'linkedin') {
      shareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodedText}%20${encodedUrl}`;
    } else if (platform === 'x') {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    } else if (platform === 'whatsapp') {
      shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
    }

    if (shareUrl) {
      const a = document.createElement('a');
      a.href = shareUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  const handleCopyShare = async (cert: CertificateRecord) => {
    try {
      await navigator.clipboard.writeText(buildShareText(cert));
      setCopiedLevel(cert.level);
      window.setTimeout(() => setCopiedLevel(null), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <section aria-label="Sertifikat Penyelesaian Level" className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Sertifikat Penyelesaian & Integrasi Media Sosial
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Setiap level yang dituntaskan membuka sertifikat resmi atas nama Anda yang dapat diunduh sebagai PNG atau dibagikan langsung ke profil media sosial.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {levelCards.map((item) => (
          <div
            key={item.level}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.meta.badge} · {item.doneCount}/{item.totalCount} modul selesai
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                    {item.meta.title}
                  </h2>
                </div>
                {item.isComplete ? (
                  <Award className="h-6 w-6 shrink-0 text-teal-700 dark:text-teal-400" aria-label="Terbuka" />
                ) : (
                  <Lock className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-label="Terkunci" />
                )}
              </div>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {item.meta.subtitle}
              </p>

              {/* Progress Track */}
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-teal-700 transition-all dark:bg-teal-500"
                    style={{
                      width: `${Math.round((item.doneCount / item.totalCount) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                  Kompetensi: {item.meta.focus}
                </div>
              </div>

              {/* Certificate Preview Frame when Unlocked */}
              {item.cert && (
                <div className="mt-5 rounded-lg border border-teal-700/30 bg-slate-50 p-4 dark:border-teal-500/30 dark:bg-slate-950/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Pratinjau Sertifikat Resmi
                  </div>
                  <div className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
                    {item.cert.learnerName}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {item.cert.levelTitle} · Terbit {item.cert.issuedAt} · ID{' '}
                    <span className="font-mono">{item.cert.id}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              {item.cert ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadCertificatePng(item.cert!)}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Unduh Sertifikat (PNG)
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyShare(item.cert!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copiedLevel === item.level ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Salin Teks
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Bagikan ke:</span>
                    <button
                      type="button"
                      onClick={() => handleSocialShare('linkedin', item.cert!)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      LinkedIn
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialShare('x', item.cert!)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      X / Twitter
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialShare('facebook', item.cert!)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Facebook
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialShare('whatsapp', item.cert!)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      WhatsApp
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={() => handleSocialShare('native', item.cert!)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Share2 className="h-3 w-3" aria-hidden="true" />
                        Lainnya
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Selesaikan {item.totalCount - item.doneCount} modul lagi untuk membuka sertifikat.
                  </span>
                  {item.nextMod && (
                    <button
                      type="button"
                      onClick={() => onJumpToModule(item.nextMod!.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                    >
                      Kerjakan Sekarang
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
