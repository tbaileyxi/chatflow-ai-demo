import AVFoundation
import CoreImage
import UIKit

/**
 Burns the Side Huddle mark onto a copy of a photo or video, for sharing out.

 A COPY, ALWAYS. The version in the thread stays clean — a watermark is for
 strangers on someone else's feed, and stamping it on what your own room sees
 would be an advert shown to people who already installed the app.

 WHAT GOES ON IT. Just "SIDE HUDDLE" and the domain. An earlier plan put the
 room's name up top — "CLEMSON HUDDLE" — on the theory that a tribe's name is a
 better hook than a product's. It is, but almost every room here is private and
 named for the people in it, so that would have printed "Bailey buffs" onto a
 stranger's Instagram feed: meaningless to them, and a leak of a private room's
 name. The product name is the only thing that is always safe and always
 legible.

 SMALL, BOTTOM-LEFT. The point is a stranger asking what Side Huddle is, not a
 banner ad. Bottom-left because Instagram and TikTok both put their own UI
 bottom-right, and a mark underneath a Story's reply box is a mark nobody sees.
 */
final class ShareComposer {
  enum ComposerError: LocalizedError {
    case badInput
    case exportFailed(String)

    var errorDescription: String? {
      switch self {
      case .badInput: return "Couldn't read that file."
      case .exportFailed(let why): return why
      }
    }
  }

  static let wordmark = "SIDE HUDDLE"
  static let domain = "sidehuddlesports.com"

  // MARK: - Overlay

  /**
   The mark, drawn at a size proportional to the canvas.

   Proportional and not fixed: the same overlay has to sit on a 720x1280
   reaction and on a 4032x3024 photo out of the camera roll, and a 14pt label
   on the second one is invisible.
   */
  private static func overlayLayer(for size: CGSize) -> CALayer {
    let scale = min(size.width, size.height) / 720.0
    let pad = 28 * scale
    let markSize = 26 * scale
    let domainSize = 15 * scale

    let container = CALayer()
    container.frame = CGRect(origin: .zero, size: size)

    let mark = CATextLayer()
    mark.string = NSAttributedString(string: wordmark, attributes: [
      .font: UIFont.systemFont(ofSize: markSize, weight: .black),
      .foregroundColor: UIColor.white,
      .kern: 2.0 * scale,
    ])
    mark.alignmentMode = .left
    mark.contentsScale = 2
    mark.isWrapped = false

    let domainLayer = CATextLayer()
    domainLayer.string = NSAttributedString(string: domain, attributes: [
      .font: UIFont.systemFont(ofSize: domainSize, weight: .semibold),
      .foregroundColor: UIColor(red: 0.96, green: 0.77, blue: 0.09, alpha: 1),
      .kern: 0.8 * scale,
    ])
    domainLayer.alignmentMode = .left
    domainLayer.contentsScale = 2
    domainLayer.isWrapped = false

    let markWidth = markSize * CGFloat(wordmark.count) * 0.72
    let domainWidth = domainSize * CGFloat(domain.count) * 0.56

    // CALayer's origin is bottom-left, which is what we want here anyway.
    domainLayer.frame = CGRect(x: pad, y: pad, width: domainWidth, height: domainSize * 1.4)
    mark.frame = CGRect(x: pad, y: pad + domainSize * 1.5,
                        width: markWidth, height: markSize * 1.4)

    // A soft shadow rather than a plate: the mark has to stay legible over a
    // white jersey and a night sky without putting a black box on the picture.
    for layer in [mark, domainLayer] {
      layer.shadowColor = UIColor.black.cgColor
      layer.shadowOpacity = 0.6
      layer.shadowRadius = 4 * scale
      layer.shadowOffset = .zero
    }

    container.addSublayer(mark)
    container.addSublayer(domainLayer)
    return container
  }

  // MARK: - Photo

  static func compose(imageAt url: URL) throws -> URL {
    guard let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
      throw ComposerError.badInput
    }

    let size = image.size
    let renderer = UIGraphicsImageRenderer(size: size)
    let output = renderer.image { ctx in
      image.draw(in: CGRect(origin: .zero, size: size))

      let overlay = overlayLayer(for: size)
      // CALayer draws bottom-up; UIImage's context is top-down. Flip once so
      // the mark lands at the bottom of the picture rather than the top.
      ctx.cgContext.saveGState()
      ctx.cgContext.translateBy(x: 0, y: size.height)
      ctx.cgContext.scaleBy(x: 1, y: -1)
      overlay.render(in: ctx.cgContext)
      ctx.cgContext.restoreGState()
    }

    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("share-\(UUID().uuidString).jpg")
    guard let jpeg = output.jpegData(compressionQuality: 0.92) else {
      throw ComposerError.exportFailed("Couldn't encode the image.")
    }
    try jpeg.write(to: out)
    return out
  }

  // MARK: - Video

  static func compose(videoAt url: URL, completion: @escaping (Result<URL, Error>) -> Void) {
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .video).first else {
      completion(.failure(ComposerError.badInput))
      return
    }

    // The track's natural size ignores its orientation; a portrait clip reports
    // landscape dimensions with a rotation transform. Applying the transform is
    // the difference between a mark in the corner and a mark rotated off-screen.
    let natural = track.naturalSize.applying(track.preferredTransform)
    let size = CGSize(width: abs(natural.width), height: abs(natural.height))

    let composition = AVMutableVideoComposition(propertiesOf: asset)
    composition.renderSize = size

    let parent = CALayer()
    let videoLayer = CALayer()
    parent.frame = CGRect(origin: .zero, size: size)
    videoLayer.frame = parent.frame
    parent.addSublayer(videoLayer)
    parent.addSublayer(overlayLayer(for: size))

    composition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parent
    )

    guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
      completion(.failure(ComposerError.exportFailed("Couldn't start the export.")))
      return
    }

    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("share-\(UUID().uuidString).mp4")

    export.outputURL = out
    export.outputFileType = .mp4
    export.videoComposition = composition
    export.shouldOptimizeForNetworkUse = true

    export.exportAsynchronously {
      switch export.status {
      case .completed:
        completion(.success(out))
      default:
        completion(.failure(export.error ?? ComposerError.exportFailed("Export failed.")))
      }
    }
  }
}
