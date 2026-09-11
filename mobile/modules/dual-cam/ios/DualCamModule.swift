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

    /// Tears the capture session down. Two live camera inputs are the most
    /// expensive thing this app can leave running, so the screen that opens
    /// the preview must call this on unmount.
    Function("dismiss") {
      self.recorder?.stopSession()
      self.recorder = nil
    }

    View(DualCamPreviewView.self) {
      Prop("active") { (view: DualCamPreviewView, active: Bool) in
        view.setActive(active, recorder: self.recorder)
      }
    }
  }

  private static func request(_ media: AVMediaType) async -> Bool {
    if AVCaptureDevice.authorizationStatus(for: media) == .authorized { return true }
    return await AVCaptureDevice.requestAccess(for: media)
  }
}
