import AVFoundation
import ExpoModulesCore
import UIKit

/**
 What you see while recording.

 This is a preview of the BACK camera only, with the front camera's live
 preview laid into the same corner the recorder composites it into. It is not
 the recorded frame — that is built in DualCamRecorder from the sample buffers
 — but it has to agree with it, or people frame a shot that comes out
 different. The 0.34 width and 4:3 ratio here are the same numbers used there;
 change one and change the other.
 */
final class DualCamPreviewView: ExpoView {
  private let backLayer = AVCaptureVideoPreviewLayer()
  private let frontLayer = AVCaptureVideoPreviewLayer()
  private let frontFrame = UIView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black

    backLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(backLayer)

    frontFrame.layer.borderWidth = 2
    frontFrame.layer.borderColor = UIColor(red: 0.96, green: 0.77, blue: 0.09, alpha: 1).cgColor
    frontFrame.layer.cornerRadius = 10
    frontFrame.clipsToBounds = true
    addSubview(frontFrame)

    frontLayer.videoGravity = .resizeAspectFill
    frontFrame.layer.addSublayer(frontLayer)
  }

  func setActive(_ active: Bool, recorder: DualCamRecorder?) {
    guard active, let recorder else {
      backLayer.session = nil
      frontLayer.session = nil
      return
    }
    // Both preview layers share the one multi-cam session; each picks up its
    // own connection from it.
    backLayer.setSessionWithNoConnection(recorder.session)
    frontLayer.setSessionWithNoConnection(recorder.session)
    connect(recorder: recorder)
  }

  private func connect(recorder: DualCamRecorder) {
    for input in recorder.session.inputs {
      guard let deviceInput = input as? AVCaptureDeviceInput,
            deviceInput.device.hasMediaType(.video) else { continue }

      let position = deviceInput.device.position
      guard let port = deviceInput.ports(
        for: .video,
        sourceDeviceType: deviceInput.device.deviceType,
        sourceDevicePosition: position
      ).first else { continue }

      let target = position == .back ? backLayer : frontLayer
      let connection = AVCaptureConnection(inputPort: port, videoPreviewLayer: target)
      if position == .front, connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = true
      }
      if recorder.session.canAddConnection(connection) {
        recorder.session.addConnection(connection)
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    backLayer.frame = bounds

    let inset: CGFloat = 12
    let width = bounds.width * 0.34
    let height = width * 4.0 / 3.0
    frontFrame.frame = CGRect(x: inset, y: inset, width: width, height: height)
    frontLayer.frame = frontFrame.bounds
  }
}
