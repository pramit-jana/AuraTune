import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Check,
  Copy,
  ExternalLink,
  X,
  QrCode,
  Package,
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

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=0f1623&color=10b981&data=${encodeURIComponent(
    SHARED_ANDROID_URL
  )}`;

  const pwaBuilderApkUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-install-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="android-install-title"
                className="text-sm sm:text-base font-bold text-white"
              >
                Get AuraTune Android APK & Mobile Setup
              </h3>
              <p className="text-xs text-slate-400">
                Download a standalone Android APK file or install directly via
                Android Chrome WebAPK
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

        {/* SECTION 1: GET STANDALONE .APK FILE */}
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-mono-tabular font-semibold text-emerald-400 uppercase tracking-wider">
                Standalone Android Package (.APK)
              </span>
              <h4 className="text-sm font-bold text-white">
                Download Signed Android .APK File or Android Studio Project
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                AuraTune includes a full Android manifest and Digital Asset
                Links (`com.auratune.music`). Choose either option below to get
                your `.apk` file:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option A: One-Click Cloud APK Packager (PWABuilder) */}
            <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-400">
                  Option 1 · Instant Cloud .APK (60s)
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Opens PWABuilder pre-loaded with AuraTune. Click{' '}
                  <strong>Package for stores &rarr; Android &rarr; Download</strong>{' '}
                  to get a signed <code className="text-emerald-300">AuraTune.apk</code>.
                </p>
              </div>
              <a
                href={pwaBuilderApkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Generate Signed .APK (PWABuilder)</span>
              </a>
            </div>

            {/* Option B: Direct Download Android APK Source Project (.zip) */}
            <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-400">
                  Option 2 · Android APK Project (.ZIP)
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Downloads the native Android WebView project (<code className="text-emerald-300">com.auratune.music</code>) with a GitHub Actions workflow that compiles <code className="text-emerald-300">app-debug.apk</code>.
                </p>
              </div>
              <a
                href="/api/android/apk-project.zip"
                download="AuraTune-Android-APK-Project.zip"
                className="w-full px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download APK Project (.ZIP)</span>
              </a>
            </div>
          </div>
        </div>

        {/* SECTION 2: DIRECT ONE-TAP CHROME WEBAPK INSTALL ON ANDROID */}
        {isInstalled ? (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-200">
              AuraTune is already installed on this device and running as a
              standalone Android app.
            </p>
          </div>
        ) : isInstallable ? (
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-emerald-300">
                Option 3 · Instant Android Chrome WebAPK Install
              </p>
              <p className="text-xs text-slate-300">
                Chrome on Android automatically compiles and installs a real
                signed WebAPK onto your phone when you tap Install below:
              </p>
            </div>
            <button
              type="button"
              onClick={onPromptInstall}
              className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Install WebAPK Now</span>
            </button>
          </div>
        ) : null}

        {/* SECTION 3: QR CODE & URL FOR ANDROID PHONE */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-slate-950/80 border border-slate-800/90">
          <div className="sm:col-span-4 flex flex-col items-center justify-center space-y-2">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <img
                src={qrCodeUrl}
                alt="Scan QR code with your Android phone"
                className="w-28 h-28 rounded-lg"
              />
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <QrCode className="w-3 h-3 text-emerald-400" />
              <span>Scan on Android</span>
            </span>
          </div>

          <div className="sm:col-span-8 space-y-2.5">
            <p className="text-xs font-semibold text-white">
              Direct Android App URL (Copy for PWABuilder or Chrome on Android)
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
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              In Chrome on Android, you can also tap the top-right{' '}
              <strong>⋮ menu &rarr; Install app</strong> so Google Chrome
              generates and installs the native WebAPK directly on your 6.2&quot;
              Android device.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <a
            href="/api/android/apk-project.zip"
            download="AuraTune-Android-APK-Project.zip"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Android Studio APK Zip</span>
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
