import { requireNativeModule, requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

/**
 * Both cameras at once.
 *
 * iOS only, and only on A12 and newer — AVCaptureMultiCamSession is not
 * emulated, so this is false on the Simulator and on anything older than an
 * iPhone XS. `isSupported()` is not advisory: call it, and fall back to the
 * front-only capture in lib/faceReaction.ts when it returns false.
 */
type DualCamNativeModule = {
  isSupported(): boolean;
  requestPermissions(): Promise<{ camera: boolean; microphone: boolean }>;
  /** Begins writing. Resolves with the file URI it will write to. */
  start(): Promise<string>;
  /** Finishes the file. Resolves with the final URI and its size on disk. */
  stop(): Promise<{ uri: string; bytes: number }>;
  /** Tears down the capture session. Two live cameras is the most expensive
   *  thing this app can leave running — always call this on unmount. */
  dismiss(): void;
  /** Returns a copy with the Side Huddle mark burned in. Original untouched. */
  composeShareAsset(uri: string, isVideo: boolean): Promise<string>;
};

// Loading the module throws on a build that predates it, and on Android. A
// missing module must read as "not supported" rather than crash the composer.
let native: DualCamNativeModule | null = null;
try {
  native = requireNativeModule<DualCamNativeModule>("DualCam");
} catch {
  native = null;
}

export const DualCam = {
  isSupported(): boolean {
    try {
      return native?.isSupported() ?? false;
    } catch {
      return false;
    }
  },
  requestPermissions: () =>
    native?.requestPermissions() ?? Promise.resolve({ camera: false, microphone: false }),
  start: () => {
    if (!native) return Promise.reject(new Error("Dual camera isn't available on this device."));
    return native.start();
  },
  stop: () => {
    if (!native) return Promise.reject(new Error("Dual camera isn't available on this device."));
    return native.stop();
  },
  dismiss: () => native?.dismiss(),
  composeShareAsset: (uri: string, isVideo: boolean) => {
    if (!native) return Promise.reject(new Error("Sharing isn't available on this build."));
    return native.composeShareAsset(uri, isVideo);
  },
};

export type DualCamPreviewProps = ViewProps & { active?: boolean };

export const DualCamPreview: React.ComponentType<DualCamPreviewProps> = native
  ? requireNativeViewManager("DualCam")
  : (() => null as any);
