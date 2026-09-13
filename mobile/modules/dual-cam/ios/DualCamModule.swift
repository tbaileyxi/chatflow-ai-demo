import AVFoundation
import ExpoModulesCore

/**
 The JS surface for dual-camera capture.

 Deliberately small: is it supported, show a preview, start, stop, get a file
 back. Everything about compositing lives in DualCamRecorder, and everything
 about what the clip MEANS — the score, the game state — stays in JS where the
 app already knows it.
 */
public class DualCamModule: Module {
  private var recorder: DualCamRecorder?

  public func definition() -> ModuleDefinition {
    Name("DualCam")

    /**
     Multi-cam is A12 and newer, and false on the Simulator. Callers must
     branch on this — the front-only path is still there for everyone else.
     */
    Function("isSupported") { () -> Bool in
      DualCamRecorder.isSupported
    }

    AsyncFunction("requestPermissions") { () -> [String: Bool] in
      let camera = await Self.request(.video)
      let microphone = await Self.request(.audio)
      return ["camera": camera, "microphone": microphone]
    }

    /// Brings the session up without recording, so a tap-for-photo works
    /// before anybody has held the button.
    AsyncFunction("prepare") { () -> Bool in
      guard DualCamRecorder.isSupported else { return false }
      if self.recorder == nil {
        let recorder = DualCamRecorder()
        try recorder.configure()
        recorder.startSession()
        self.recorder = recorder
      }
      return true
    }

    AsyncFunction("start") { () -> String in
      guard DualCamRecorder.isSupported else {
        throw Exception(name: "ERR_UNSUPPORTED", description: "This iPhone can't record both cameras at once.")
      }

      let recorder = self.recorder ?? DualCamRecorder()
      if self.recorder == nil {
        try recorder.configure()
        recorder.startSession()
        self.recorder = recorder
      }

      let url = try recorder.startRecording()
      return url.absoluteString
    }

    /// A tap. One composited frame as a JPEG, same framing as the clip.
    AsyncFunction("capturePhoto") { (promise: Promise) in
      guard let recorder = self.recorder else {
        promise.reject("ERR_NOT_READY", "Camera isn't running.")
        return
      }
      recorder.capturePhoto { result in
        switch result {
        case .success(let url): promise.resolve(url.absoluteString)
        case .failure(let error): promise.reject("ERR_PHOTO_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      guard let recorder = self.recorder else {
        promise.reject("ERR_NOT_RECORDING", "Not recording.")
        return
      }

      recorder.stopRecording { result in
        switch result {
        case .success(let url):
          let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
          promise.resolve([
            "uri": url.absoluteString,
            "bytes": bytes ?? 0
          ])
        case .failure(let error):
          promise.reject("ERR_RECORDING_FAILED", error.localizedDescription)
        }
      }
    }

    /// Which camera is the frame and which is the corner. The capture screen
    /// owns this; the recorder and the preview both read it.
    Function("setSwapped") { (swapped: Bool) in
      self.recorder?.swapped = swapped
    }

    /// Tears the capture session down. Two live camera inputs are the most
    /// expensive thing this app can leave running, so the screen that opens
    /// the preview must call this on unmount.
    Function("dismiss") {
      self.recorder?.stopSession()
      self.recorder = nil
    }

    /**
     Returns a COPY of a photo or video with the Side Huddle mark on it, for
     sharing outward. The original is never touched — the version in the thread
     stays clean, because a watermark shown to the room is an advert aimed at
     people who already installed the app.
     */
    AsyncFunction("composeShareAsset") { (uri: String, isVideo: Bool, promise: Promise) in
      guard let url = URL(string: uri) else {
        promise.reject("ERR_BAD_URI", "Couldn't read that file.")
        return
      }

      if isVideo {
        ShareComposer.compose(videoAt: url) { result in
          switch result {
          case .success(let out): promise.resolve(out.absoluteString)
          case .failure(let error): promise.reject("ERR_COMPOSE_FAILED", error.localizedDescription)
          }
        }
      } else {
        do {
          promise.resolve(try ShareComposer.compose(imageAt: url).absoluteString)
        } catch {
          promise.reject("ERR_COMPOSE_FAILED", error.localizedDescription)
        }
      }
    }

    View(DualCamPreviewView.self) {
      Prop("active") { (view: DualCamPreviewView, active: Bool) in
        view.setActive(active, recorder: self.recorder)
      }
      Prop("swapped") { (view: DualCamPreviewView, swapped: Bool) in
        view.swapped = swapped
      }
    }
  }

  private static func request(_ media: AVMediaType) async -> Bool {
    if AVCaptureDevice.authorizationStatus(for: media) == .authorized { return true }
    return await AVCaptureDevice.requestAccess(for: media)
  }
}
