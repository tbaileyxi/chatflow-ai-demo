import AVFoundation
import CoreImage
import CryptoKit
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
  /**
   The mark, laid out for ONE of two coordinate systems.

   AVVideoCompositionCoreAnimationTool composites in Core Animation's own
   space, where y grows upward — bottom-left origin. A UIImage context is
   top-down. The same layer tree cannot satisfy both, and trying to reconcile
   them by flipping the CONTEXT is what produced a mirrored wordmark: flipping
   the context flips the glyphs with it, so "SIDE HUDDLE" came out reversed.

   So the caller says which space it is drawing into and the frames are
   computed for that space. Nothing is flipped.
   */
  private static func overlayLayer(for size: CGSize, bottomUp: Bool) -> CALayer {
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

    // MEASURED, not estimated. The old width came from character count times
    // a fudge factor, and it under-measured — which is why the domain shipped
    // as "sidehuddlesports.co" with the last letter clipped off.
    let markWidth = ceil((mark.string as! NSAttributedString).size().width) + 2
    let domainWidth = ceil((domainLayer.string as! NSAttributedString).size().width) + 2
    let markHeight = markSize * 1.4
    let domainHeight = domainSize * 1.4

    if bottomUp {
      domainLayer.frame = CGRect(x: pad, y: pad, width: domainWidth, height: domainHeight)
      mark.frame = CGRect(x: pad, y: pad + domainHeight * 1.08,
                          width: markWidth, height: markHeight)
    } else {
      domainLayer.frame = CGRect(x: pad, y: size.height - pad - domainHeight,
                                 width: domainWidth, height: domainHeight)
      mark.frame = CGRect(x: pad, y: size.height - pad - domainHeight * 1.08 - markHeight,
                          width: markWidth, height: markHeight)
    }

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

      // No flip. render(in:) already draws in this context's orientation;
      // flipping it was what mirrored the wordmark.
      overlayLayer(for: size, bottomUp: false).render(in: ctx.cgContext)
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
    // A REMOTE URL HAS NO TRACKS YET, and that is the whole bug.
    //
    // `tracks(withMediaType:)` is synchronous. On an https asset it returns an
    // EMPTY array until the asset has loaded, so the guard below failed
    // instantly, the composer threw, and shareMedia fell back to sharing the
    // remote URL — which iOS renders as a link preview captioned
    // "dejuwyeypiggvlyfliap.supabase.co".
    //
    // The image path never hit this because Data(contentsOf:) blocks until it
    // has the bytes. This one has to fetch first and compose from a local
    // file, which is also what makes the share sheet treat the result as a
    // video rather than a link.
    if url.scheme == "http" || url.scheme == "https" {
      // COMPOSE EACH CLIP ONCE.
      //
      // Sharing the same moment twice — to Messages, then to Instagram —
      // downloaded and re-exported the whole thing again. The composed copy
      // depends only on the source, so it is kept under a digest of the URL
      // and reused. The second share of a clip is then immediate.
      let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        .prefix(8).map { String(format: "%02x", $0) }.joined()
      let cached = FileManager.default.temporaryDirectory
        .appendingPathComponent("shared-\(digest).mp4")
      if FileManager.default.fileExists(atPath: cached.path) {
        completion(.success(cached))
        return
      }

      // downloadTask, not dataTask: dataTask holds the whole file in memory
      // before writing it — 57MB of RAM on a phone that is also playing video.
      // downloadTask streams it to disk.
      URLSession.shared.downloadTask(with: url) { temp, _, error in
        guard let temp else {
          completion(.failure(error ?? ComposerError.badInput))
          return
        }
        let local = FileManager.default.temporaryDirectory
          .appendingPathComponent("dl-\(UUID().uuidString).mp4")
        do {
          try? FileManager.default.removeItem(at: local)
          try FileManager.default.moveItem(at: temp, to: local)
        } catch {
          completion(.failure(error))
          return
        }
        compose(videoAt: local) { result in
          // The raw download has done its job either way; only the marked
          // copy is worth keeping, under the cache name.
          try? FileManager.default.removeItem(at: local)
          guard case .success(let out) = result else {
            completion(result)
            return
          }
          try? FileManager.default.removeItem(at: cached)
          do {
            try FileManager.default.moveItem(at: out, to: cached)
            completion(.success(cached))
          } catch {
            // Caching is an optimisation, never a reason to fail a share.
            completion(.success(out))
          }
        }
      }.resume()
      return
    }

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
    parent.addSublayer(overlayLayer(for: size, bottomUp: true))

    composition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parent
    )

    // 720p, not HighestQuality.
    //
    // This is a copy bound for someone else's feed, where Instagram or
    // Messages re-encodes it again anyway. Exporting a 4K source at full
    // quality is a minute of phone time and a file too big to send — on a
    // long clip the export, not the download, is most of the wait.
    // AVFoundation never upscales, so a smaller source exports at its own
    // size.
    guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
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
