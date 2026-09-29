// Turn a game story into a file, in the browser, for nothing.
//
// The story already plays here, which means the browser is already holding
// every frame — so making a video out of it needs no server, no ffmpeg and no
// render bill. A canvas plays the pieces in sequence, MediaRecorder records
// the canvas, and what comes out is the thing you can put on Instagram.
//
// This is the only route to Instagram that does not require a native video
// module in the app. It works because the media is served with
// `access-control-allow-origin: *` — without that the canvas would be
// tainted the moment a frame was drawn and nothing could be read back out.
// crossOrigin must be set BEFORE src on every element for that to hold.
//
// WITH SOUND. A canvas emits video and nothing else, so the clips' audio is
// routed through a Web Audio graph into a second track on the same stream:
// each clip's element becomes a MediaElementSource wired to a
// MediaStreamDestination, and the recorder is handed video + audio together.
//
// The sources are connected to the recording destination ONLY, never to the
// speakers, so building a video does not blast a room's audio out of the
// phone that is making it. Stills contribute silence, which keeps the audio
// track continuous — a track that stops and starts is a file some players
// refuse to scrub.

export type RenderItem = {
  url: string;
  kind: 'image' | 'video';
};

export type RenderOpts = {
  photoMs?: number;
  maxClipMs?: number;
  /** 0..1, for a progress label — rendering runs in real time. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/** 9:16, which is what a phone and every story surface expects. */
const W = 1080;
const H = 1920;

/** The first of these the browser admits to supporting. */
const CANDIDATES = [
  // Audio codec named explicitly first: some browsers will happily report
  // support for a bare container and then record a file with no audio track.
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickMime(): string | null {
  const MR = (window as any).MediaRecorder;
  if (!MR?.isTypeSupported) return null;
  return CANDIDATES.find((t) => MR.isTypeSupported(t)) ?? null;
}

/** Whether this browser can do it at all, so the button can stay hidden. */
export function canRenderStory(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).MediaRecorder !== 'undefined' &&
    typeof document.createElement('canvas').captureStream === 'function' &&
    pickMime() !== null
  );
}

/** Cover-fit, so nothing is letterboxed and nothing is squashed. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: HTMLImageElement | HTMLVideoElement,
  sw: number,
  sh: number,
) {
  if (!sw || !sh) return;
  const scale = Math.max(W / sw, H / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
}

function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    signal?.addEventListener('abort', () => reject(new Error('cancelled')));
    img.src = url;
  });
}

function loadVideo(url: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    // NOT muted. Muting silences the element, and the Web Audio tap below
    // reads the element — a muted clip records a silent clip. Nothing is
    // audible anyway, because the graph goes to the recorder and not to the
    // speakers.
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('video failed'));
    signal?.addEventListener('abort', () => reject(new Error('cancelled')));
    v.src = url;
  });
}

/**
 * Play the story onto a canvas while a recorder watches, and hand back the
 * file. Real time by necessity — a recorder captures what it is shown, so a
 * fifty-second story takes fifty seconds to make.
 */
export async function renderStory(
  items: RenderItem[],
  opts: RenderOpts = {},
): Promise<Blob> {
  const photoMs = opts.photoMs ?? 4500;
  const maxClipMs = opts.maxClipMs ?? 8000;
  const mime = pickMime();
  if (!mime) throw new Error('This browser cannot make a video.');
  if (items.length === 0) throw new Error('Nothing to render.');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas.');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // Video from the canvas, audio from the clips, one stream.
  const videoStream = canvas.captureStream(30);
  let actx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (AC) {
      actx = new AC() as AudioContext;
      // The caller is a click handler, which is the gesture that allows this.
      await actx.resume().catch(() => undefined);
      audioDest = actx.createMediaStreamDestination();
    }
  } catch {
    // No audio context is a silent video, not a failed one.
    actx = null;
    audioDest = null;
  }

  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...(audioDest ? audioDest.stream.getAudioTracks() : []),
  ]);

  const chunks: BlobPart[] = [];
  const rec = new (window as any).MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  }) as MediaRecorder;
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  rec.start();

  try {
    for (let n = 0; n < items.length; n++) {
      if (opts.signal?.aborted) throw new Error('cancelled');
      const it = items[n];
      opts.onProgress?.(n / items.length);

      if (it.kind === 'video') {
        const v = await loadVideo(it.url, opts.signal);
        const ms = Math.min((v.duration || maxClipMs / 1000) * 1000, maxClipMs);
        // Tap this clip's audio into the recording. One source per element —
        // createMediaElementSource can only ever be called once on the same
        // element, which is why each clip gets a fresh one.
        let src: MediaElementAudioSourceNode | null = null;
        if (actx && audioDest) {
          try {
            src = actx.createMediaElementSource(v);
            src.connect(audioDest);
          } catch {
            src = null; // this clip records silent rather than not at all
          }
        }
        await v.play().catch(() => undefined);
        const started = performance.now();
        // Draw every frame the recorder will see. A video element is not
        // captured by a canvas on its own; it has to be painted.
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (opts.signal?.aborted || performance.now() - started >= ms) {
              v.pause();
              resolve();
              return;
            }
            drawCover(ctx, v, v.videoWidth, v.videoHeight);
            requestAnimationFrame(tick);
          };
          tick();
        });
        src?.disconnect();
      } else {
        const img = await loadImage(it.url, opts.signal);
        const started = performance.now();
        // A still is still redrawn: the stream wants frames, and a canvas
        // that stops changing can stop emitting them.
        await new Promise<void>((resolve) => {
          const tick = () => {
            if (opts.signal?.aborted || performance.now() - started >= photoMs) {
              resolve();
              return;
            }
            drawCover(ctx, img, img.naturalWidth, img.naturalHeight);
            requestAnimationFrame(tick);
          };
          tick();
        });
      }
    }
    opts.onProgress?.(1);
  } finally {
    // Stop in every case, so an abort still resolves the promise above rather
    // than leaving a recorder running and a caller waiting forever.
    if (rec.state !== 'inactive') rec.stop();
    stream.getTracks().forEach((t) => t.stop());
    videoStream.getTracks().forEach((t) => t.stop());
    await actx?.close().catch(() => undefined);
  }

  return done;
}

/** Hand the file to the browser under a name worth seeing in a camera roll. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked late: iOS in particular may still be reading it when the click
  // returns, and a revoked URL there is a download that silently does nothing.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
