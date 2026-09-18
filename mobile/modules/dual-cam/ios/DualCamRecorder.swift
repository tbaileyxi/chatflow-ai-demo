import AVFoundation
import CoreImage
import UIKit

/**
 Front and back at the same time, composited into one video file.

 WHY THIS EXISTS AS NATIVE CODE. Neither expo-camera nor
 react-native-vision-camera runs two capture devices at once. iOS does, through
 AVCaptureMultiCamSession, and nothing else on the platform does — so the
 feature is a native module or it is nothing.

 HOW THE COMPOSITE WORKS. Two AVCaptureVideoDataOutputs feed one serial queue.
 The back camera's frame is the canvas and drives the timeline; the newest
 front-camera frame is held in a property and drawn into the corner of
 whichever back frame arrives next. Compositing on the back frame's clock —
 rather than trying to pair frames by timestamp — is what keeps the output at a
 steady frame rate when the two cameras deliver at slightly different times,
 which they always do.

 HARDWARE. Multi-cam is A12 and newer (iPhone XS onward) and it is not
 emulated: `isMultiCamSupported` is false on the Simulator and on older
 phones. Callers must check `isSupported` and fall back to front-only capture,
 which is what shipped before this.
 */
final class DualCamRecorder: NSObject {
  enum RecorderError: LocalizedError {
    case unsupported
    case deviceUnavailable
    case configurationFailed(String)
    case notRecording

    var errorDescription: String? {
      switch self {
      case .unsupported:
        return "This iPhone can't record both cameras at once."
      case .deviceUnavailable:
        return "Couldn't get to the cameras."
      case .configurationFailed(let why):
        return why
      case .notRecording:
        return "Not recording."
      }
    }
  }

  static var isSupported: Bool { AVCaptureMultiCamSession.isMultiCamSupported }

  let session = AVCaptureMultiCamSession()

  private let sessionQueue = DispatchQueue(label: "com.sidehuddle.dualcam.session")
  private let bufferQueue = DispatchQueue(label: "com.sidehuddle.dualcam.buffers")

  private let backOutput = AVCaptureVideoDataOutput()
  private let frontOutput = AVCaptureVideoDataOutput()
  private let audioOutput = AVCaptureAudioDataOutput()

  private var writer: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var audioInput: AVAssetWriterInput?
  private var pixelAdaptor: AVAssetWriterInputPixelBufferAdaptor?

  private var isWriting = false
  private var sessionStarted = false
  private var startTime: CMTime = .zero

  /// The newest front frame, drawn into the next back frame that arrives.
  /// False: back camera is the frame, your face is the inset. True swaps
  /// them. Set from JS by the flip button on the capture screen, and read on
  /// the buffer queue, so it has to be atomic with respect to it.
  /// Selfie leads. See DualCamScreen: the reaction is the thing only this
  /// person can film; the game is on television.
  var swapped = true

  private var latestFrontImage: CIImage?
  /// The newest back frame, kept so a still can be taken without spinning up a
  /// separate AVCapturePhotoOutput. A photo here is one composited frame of the
  /// same thing the preview is already showing, which is also the only way the
  /// still and the clip can be guaranteed to look alike.
  private var latestBackImage: CIImage?

  private let ciContext = CIContext(options: [.cacheIntermediates: false])

  /// Output canvas. 720x1280 keeps a ten second clip comfortably under the
  /// 10 MB ceiling the upload path enforces, and it is more than enough for a
  /// clip that plays back inside a chat bubble.
  private let renderSize = CGSize(width: 720, height: 1280)

  // MARK: - Session

  func configure() throws {
    guard Self.isSupported else { throw RecorderError.unsupported }

    session.beginConfiguration()
    defer { session.commitConfiguration() }

    try addCamera(position: .back, output: backOutput)
    try addCamera(position: .front, output: frontOutput)
    try addMicrophone()

    backOutput.setSampleBufferDelegate(self, queue: bufferQueue)
    frontOutput.setSampleBufferDelegate(self, queue: bufferQueue)
    audioOutput.setSampleBufferDelegate(self, queue: bufferQueue)
  }

  func startSession() {
    sessionQueue.async { [weak self] in
      guard let self, !self.session.isRunning else { return }
      self.session.startRunning()
    }
  }

  func stopSession() {
    sessionQueue.async { [weak self] in
      guard let self, self.session.isRunning else { return }
      self.session.stopRunning()
    }
  }

  private func addCamera(position: AVCaptureDevice.Position, output: AVCaptureVideoDataOutput) throws {
    guard
      let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
      let input = try? AVCaptureDeviceInput(device: device)
    else { throw RecorderError.deviceUnavailable }

    // addInput/addOutput would reconfigure the whole session and drop the
    // multi-cam arrangement; the WithNoConnections variants let us wire the
    // two paths up explicitly and keep both alive.
    guard session.canAddInput(input) else {
      throw RecorderError.configurationFailed("Couldn't add the \(position == .back ? "back" : "front") camera.")
    }
    session.addInputWithNoConnections(input)

    output.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    output.alwaysDiscardsLateVideoFrames = true

    guard session.canAddOutput(output) else {
      throw RecorderError.configurationFailed("Couldn't add a video output.")
    }
    session.addOutputWithNoConnections(output)

    guard let port = input.ports(
      for: .video,
      sourceDeviceType: device.deviceType,
      sourceDevicePosition: position
    ).first else {
      throw RecorderError.configurationFailed("No video port on the \(position == .back ? "back" : "front") camera.")
    }

    let connection = AVCaptureConnection(inputPorts: [port], output: output)
    guard session.canAddConnection(connection) else {
      throw RecorderError.configurationFailed("Couldn't connect a camera.")
    }
    session.addConnection(connection)

    connection.videoOrientation = .portrait
    if position == .front, connection.isVideoMirroringSupported {
      // Your own face should read the way it does in a mirror. The back
      // camera must NOT be mirrored — a mirrored scoreboard is unreadable.
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = true
    }
  }

  private func addMicrophone() throws {
    guard
      let mic = AVCaptureDevice.default(for: .audio),
      let input = try? AVCaptureDeviceInput(device: mic),
      session.canAddInput(input)
    else { throw RecorderError.deviceUnavailable }

    session.addInputWithNoConnections(input)

    guard session.canAddOutput(audioOutput) else {
      throw RecorderError.configurationFailed("Couldn't add audio.")
    }
    session.addOutputWithNoConnections(audioOutput)

    guard let port = input.ports(for: .audio, sourceDeviceType: mic.deviceType, sourceDevicePosition: .unspecified).first else {
      throw RecorderError.configurationFailed("No audio port.")
    }
    let connection = AVCaptureConnection(inputPorts: [port], output: audioOutput)
    guard session.canAddConnection(connection) else {
      throw RecorderError.configurationFailed("Couldn't connect audio.")
    }
    session.addConnection(connection)
  }

  // MARK: - Recording

  func startRecording() throws -> URL {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("reaction-\(UUID().uuidString).mp4")

    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)

    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: Int(renderSize.width),
      AVVideoHeightKey: Int(renderSize.height),
      AVVideoCompressionPropertiesKey: [
        // ~3 Mbps: ten seconds lands near 3.5 MB, well inside the cap, and
        // survives the re-encode a chat client does on playback.
        AVVideoAverageBitRateKey: 3_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
      ]
    ]

    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    videoInput.expectsMediaDataInRealTime = true

    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: Int(renderSize.width),
        kCVPixelBufferHeightKey as String: Int(renderSize.height)
      ]
    )

    let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVNumberOfChannelsKey: 1,
      AVSampleRateKey: 44_100,
      AVEncoderBitRateKey: 64_000
    ])
    audioInput.expectsMediaDataInRealTime = true

    if writer.canAdd(videoInput) { writer.add(videoInput) }
    if writer.canAdd(audioInput) { writer.add(audioInput) }

    bufferQueue.sync {
      self.writer = writer
      self.videoInput = videoInput
      self.audioInput = audioInput
      self.pixelAdaptor = adaptor
      self.sessionStarted = false
      self.isWriting = true
    }

    writer.startWriting()
    return url
  }

  func stopRecording(completion: @escaping (Result<URL, Error>) -> Void) {
    bufferQueue.async { [weak self] in
      guard let self, let writer = self.writer, self.isWriting else {
        completion(.failure(RecorderError.notRecording))
        return
      }

      self.isWriting = false
      self.videoInput?.markAsFinished()
      self.audioInput?.markAsFinished()

      writer.finishWriting {
        let url = writer.outputURL
        self.writer = nil
        self.videoInput = nil
        self.audioInput = nil
        self.pixelAdaptor = nil
        self.latestFrontImage = nil

        if writer.status == .completed {
          completion(.success(url))
        } else {
          completion(.failure(writer.error ?? RecorderError.configurationFailed("Recording failed.")))
        }
      }
    }
  }

  /**
   A still: one composited frame, written as a JPEG.

   Taken off the video data output rather than a separate AVCapturePhotoOutput.
   A photo output would give a higher-resolution frame, but it would also be a
   different framing from the preview and from the clip — a still and a video of
   the same moment ought to look like the same moment, and on a multi-cam
   session a third output is more contention for a session already running two.
   */
  func capturePhoto(completion: @escaping (Result<URL, Error>) -> Void) {
    capturePhoto(retriesLeft: 6, completion: completion)
  }

  /**
   WAIT FOR THE FACE.

   composite() drops the inset entirely when there is no front frame, and the
   two cameras do not start delivering at the same instant — the back is
   usually first. Tap quickly enough after the camera opens, or straight after
   a recording (which clears the last front frame on finishWriting), and the
   still came out as a plain back-camera photo with no selfie in it at all.

   The whole point of this capture is that both cameras are in it, so a missing
   front frame is worth waiting a few frames for rather than silently shipping
   half the picture. Six tries at 50ms is 300ms — under the shutter delay
   anybody notices, and if the front camera genuinely is not running we still
   produce the photo rather than failing.
   */
  private func capturePhoto(
    retriesLeft: Int,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    bufferQueue.async { [weak self] in
      guard let self, let back = self.latestBackImage else {
        completion(.failure(RecorderError.notRecording))
        return
      }

      if self.latestFrontImage == nil && retriesLeft > 0 {
        self.bufferQueue.asyncAfter(deadline: .now() + 0.05) { [weak self] in
          self?.capturePhoto(retriesLeft: retriesLeft - 1, completion: completion)
        }
        return
      }

      let frame = self.swapped
        ? self.composite(back: self.latestFrontImage ?? back, front: back)
        : self.composite(back: back, front: self.latestFrontImage)
      guard let cg = self.ciContext.createCGImage(frame, from: CGRect(origin: .zero, size: self.renderSize)) else {
        completion(.failure(RecorderError.configurationFailed("Couldn't render the photo.")))
        return
      }

      let image = UIImage(cgImage: cg)
      let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("reaction-\(UUID().uuidString).jpg")

      guard let data = image.jpegData(compressionQuality: 0.9) else {
        completion(.failure(RecorderError.configurationFailed("Couldn't encode the photo.")))
        return
      }

      do {
        try data.write(to: url)
        completion(.success(url))
      } catch {
        completion(.failure(error))
      }
    }
  }

  // MARK: - Composite

  /**
   Back camera fills the frame; your face sits in the top-left corner.

   Top-LEFT rather than the usual bottom-right: the reaction card renders the
   score along the bottom edge on playback, and a face tucked under a score
   chip is a face nobody can see.
   */
  private func composite(back: CIImage, front: CIImage?) -> CIImage {
    let canvas = CGRect(origin: .zero, size: renderSize)

    // Aspect-fill the back camera into the canvas.
    let backScale = max(canvas.width / back.extent.width, canvas.height / back.extent.height)
    var output = back
      .transformed(by: CGAffineTransform(scaleX: backScale, y: backScale))
    output = output.transformed(by: CGAffineTransform(
      translationX: (canvas.width - output.extent.width) / 2 - output.extent.origin.x,
      y: (canvas.height - output.extent.height) / 2 - output.extent.origin.y
    ))
    output = output.cropped(to: canvas)

    guard let front else { return output }

    let inset: CGFloat = 16
    let pipWidth = canvas.width * 0.34
    let pipHeight = pipWidth * 4.0 / 3.0
    let pipRect = CGRect(
      x: inset,
      y: canvas.height - pipHeight - inset,
      width: pipWidth,
      height: pipHeight
    )

    let frontScale = max(pipRect.width / front.extent.width, pipRect.height / front.extent.height)
    var pip = front.transformed(by: CGAffineTransform(scaleX: frontScale, y: frontScale))
    pip = pip.transformed(by: CGAffineTransform(
      translationX: pipRect.midX - pip.extent.midX,
      y: pipRect.midY - pip.extent.midY
    ))
    pip = pip.cropped(to: pipRect)

    // A hairline behind the inset so a dark face on a dark broadcast still
    // reads as a separate panel rather than a smudge.
    let border = CIImage(color: CIColor(red: 0.96, green: 0.77, blue: 0.09))
      .cropped(to: pipRect.insetBy(dx: -2, dy: -2))

    return pip
      .composited(over: border)
      .composited(over: output)
  }
}

// MARK: - Sample buffers

extension DualCamRecorder: AVCaptureVideoDataOutputSampleBufferDelegate,
                           AVCaptureAudioDataOutputSampleBufferDelegate {
  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    if output === frontOutput {
      guard let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
      latestFrontImage = CIImage(cvPixelBuffer: pixels)
      return
    }

    if output === backOutput, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) {
      latestBackImage = CIImage(cvPixelBuffer: pixels)
    }

    guard isWriting, let writer, writer.status == .writing else { return }

    if output === audioOutput {
      guard sessionStarted, let audioInput, audioInput.isReadyForMoreMediaData else { return }
      audioInput.append(sampleBuffer)
      return
    }

    guard output === backOutput,
          let pixels = CMSampleBufferGetImageBuffer(sampleBuffer),
          let adaptor = pixelAdaptor,
          let videoInput, videoInput.isReadyForMoreMediaData
    else { return }

    let time = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

    if !sessionStarted {
      writer.startSession(atSourceTime: time)
      startTime = time
      sessionStarted = true
    }

    let live = CIImage(cvPixelBuffer: pixels)
    let frame = swapped
      ? composite(back: latestFrontImage ?? live, front: live)
      : composite(back: live, front: latestFrontImage)

    guard let pool = adaptor.pixelBufferPool else { return }
    var out: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &out)
    guard let out else { return }

    ciContext.render(frame, to: out)
    adaptor.append(out, withPresentationTime: time)
  }
}
