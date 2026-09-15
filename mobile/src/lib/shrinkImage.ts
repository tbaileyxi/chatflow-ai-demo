// Make the picture small enough to actually arrive.
//
// Nothing resized before this. ImagePicker's `quality` only compresses JPEG,
// and it does nothing at all to a PNG — so a profile picture went up as a
// 470 KB PNG and took over THIRTY SECONDS to come back down, for a circle
// drawn at 62 points. A camera-roll photo is worse: a full-resolution iPhone
// shot is 3-4 MB before it is touched.
//
// That is the "avatar not showing" and the "photo never loads". The app was
// not broken, it was moving several megabytes over a connection that had no
// chance, and rendering nothing until it finished.

import * as ImageManipulator from "expo-image-manipulator";

type Shrunk = { uri: string };

async function shrink(uri: string, maxDim: number, quality: number): Promise<Shrunk> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDim } }],
      {
        compress: quality,
        // JPEG ALWAYS. A PNG ignores `compress` entirely, which is exactly how
        // a half-megabyte avatar happened.
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return { uri: result.uri };
  } catch (err) {
    // A picture that fails to shrink is still a picture. Send the original
    // rather than losing what someone chose.
    console.warn("[image] resize failed, sending original", err);
    return { uri };
  }
}

/**
 * A profile picture. Drawn at 62 points at the largest, so 512 is already
 * generous on a 3x screen.
 */
export function shrinkAvatar(uri: string) {
  return shrink(uri, 512, 0.8);
}

/**
 * A photo posted into a room. Wide enough to fill a phone and hold up when
 * someone taps it; small enough to arrive while the moment is still live.
 */
export function shrinkPhoto(uri: string) {
  return shrink(uri, 1440, 0.75);
}
