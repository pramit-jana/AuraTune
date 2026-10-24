import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Check,
  Copy,
  ExternalLink,
  X,
  QrCode,
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  onPromptInstall: () => Promise<boolean>;
}

const SHARED_ANDROID_URL =
  'https://ais-pre-frzgcxu5ds5tqipptgqcsd-370355383358.asia-southeast1.run.app';

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  onPromptInstall,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : SHARED_ANDROID_URL;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=0f1623&color=10b981&data=${encodeURIComponent(
    SHARED_ANDROID_URL
  )}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARED_ANDROID_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-install-title"
    >
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="android-install-title"
                className="text-base font-bold text-white"
              >
                Use AuraTune on Your Android Device
              </h3>
              <p className="text-xs text-slate-400">
                Install as a standalone Android app (PWA) with full-screen player
                & auto-cache
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direct One-Tap Install if opened directly in Android Chrome */}
        {isInstalled ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-200">
              AuraTune is already installed on this device and running in
              standalone mode.
            </p>
          </div>
        ) : isInstallable ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-300">
                Ready for Direct Android Installation
              </p>
              <p className="text-xs text-slate-300">
                Tap Install to add AuraTune directly to your Android Home Screen
                and App Drawer.
              </p>
            </div>
            <button
              type="button"
              onClick={onPromptInstall}
              className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Install Android App</span>
            </button>
          </div>
        ) : null}

        {/* QR Code + Share Link for opening on Android Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center p-4 rounded-xl bg-slate-950/80 border border-slate-800/90">
          <div className="sm:col-span-4 flex flex-col items-center justify-center space-y-2">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <img
                src={qrCodeUrl}
                alt="Scan QR code with your Android phone"
                className="w-32 h-32 rounded-lg"
              />
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <QrCode className="w-3 h-3 text-emerald-400" />
              <span>Scan with Android Camera</span>
            </span>
          </div>

          <div className="sm:col-span-8 space-y-3">
            <p className="text-xs font-semibold text-white">
              Step 1: Open this link in Chrome on your Android phone
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Scan the QR code with your phone camera or copy the direct app URL
              below and open it in <strong>Google Chrome</strong> on Android:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={SHARED_ANDROID_URL}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
            {appUrl !== SHARED_ANDROID_URL && (
              <p className="text-[11px] text-slate-400">
                Note: Make sure your app sharing is enabled in AI Studio if
                signing in from a different Google account.
              </p>
            )}
          </div>
        </div>

        {/* Step-by-Step Android Chrome Install Guide */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-white">
            Step 2: Install to your Android Home Screen
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-xs font-mono-tabular font-semibold text-emerald-400">
                01 · Open in Chrome
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Open the link in <strong>Chrome for Android</strong> and sign in
                with your Google account.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-xs font-mono-tabular font-semibold text-emerald-400">
                02 · Tap Menu (⋮)
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tap the <strong>Install App</strong> banner inside AuraTune, or
                tap Chrome&apos;s top-right <strong>⋮ menu</strong>.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <span className="text-xs font-mono-tabular font-semibold text-emerald-400">
                03 · Add to Home Screen
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Select <strong>&ldquo;Add to Home screen&rdquo;</strong> or{' '}
                <strong>&ldquo;Install app&rdquo;</strong> to launch AuraTune
                like a native Android app.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <a
            href={SHARED_ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Full-Screen App Tab</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
