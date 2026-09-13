import { Alert, Share } from "react-native";
import { DualCam } from "../../modules/dual-cam";

/**
 * Share a photo or clip out of a room, with the Side Huddle mark on it.
 *
 * ONE BUTTON. Not "Share to Instagram / Save / Copy link / Invite" — the
 * person just made something they feel strongly about, and a menu of four
 * choices is where that feeling goes to die. The OS sheet already has
 * Instagram, Messages, AirDrop and Save Image on it, maintained by Apple, in
 * the order this particular person actually uses. Building our own version of
 * that list is work that makes it worse.
 *
 * The mark is burned into a COPY. What the room sees stays clean.
 *
 * The composer returns a LOCAL file. That matters beyond the watermark: hand
 * iOS an https URL and it shares it as a link, which posts a URL nobody can
 * open instead of the video.
 */
export async function shareMedia(args: {
  url: string;
  type: "image" | "video" | "audio" | string | null;
  /**
   * What to say alongside it — normally the scoreline the moment was
   * captured at.
   *
   * Without this iOS has nothing but the file, and when the composer fails
   * and we fall through to the remote URL it renders as a LINK PREVIEW: the
   * picture with "dejuwyeypiggvlyfliap.supabase.co" underneath it as the
   * caption. A storage hostname is the least shareable string in the app.
   */
  caption?: string | null;
}): Promise<void> {
  const { url, type, caption } = args;
  if (!url) return;

  const isVideo = type === "video";
  if (type === "audio") {
    // A voice note has nothing to watermark and nothing to look at. Share the
    // file plainly rather than pretending there's a picture to brand.
    await Share.share({ url }).catch(() => {});
    return;
  }

  try {
    // No download step here. AVURLAsset and Data(contentsOf:) both take a
    // remote URL, so the native composer fetches it itself and hands back a
    // local file — which is also what makes the share sheet treat the result
    // as media rather than posting a link nobody can open.
    let shareUri = url;
    try {
      shareUri = await DualCam.composeShareAsset(url, isVideo);
    } catch {
      // An overlay that won't render is not a reason to stop somebody sharing.
      // Fall through with the clean file — worse for us, fine for them.
    }

    const text = (caption ?? "").trim();
    await Share.share(text ? { url: shareUri, message: text } : { url: shareUri });
  } catch (err: any) {
    // A cancelled share sheet rejects on some iOS versions. That isn't an error
    // and must not raise an alert at somebody who simply changed their mind.
    const msg = String(err?.message ?? "");
    if (/cancel/i.test(msg)) return;
    Alert.alert("Couldn't share that", "Try again in a moment.");
  }
}
