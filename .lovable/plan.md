

## Add Photo Upload to Mobile Chat Input

### The Problem
There's no way to upload an existing photo from your phone's gallery. The Camera button correctly opens the native camera for video, but there's no photo library picker. Copy-pasting photos also doesn't work.

### The Solution
Add a small image/photo icon **inside the text input area** (right side) instead of adding another button to the already-crowded row. This is the same pattern iMessage and WhatsApp use. Also add paste support for images.

### Layout (before vs after)

```text
BEFORE:  [Camera] [Coach] [____text input____] [Send]

AFTER:   [Camera] [Coach] [____text input___📷] [Send]
                                              ^
                                    small icon inside input
```

### What Changes

**File: `src/components/room/RoomChatInput.tsx`**

1. Add a second hidden file input (without `capture` attribute) so it opens the photo library instead of the camera
2. Add an `ImagePlus` icon (from lucide-react) positioned absolutely inside the textarea wrapper, right-aligned
3. Tapping that icon triggers the photo library file picker (accepts images only)
4. Reuse the existing `handleFileUpload` function -- it already uploads to Supabase storage and sends the message
5. Add an `onPaste` handler on the textarea that detects image data on the clipboard and uploads it automatically
6. Show a small loading spinner on the icon while uploading

### Technical Details

- Import `ImagePlus` from lucide-react (small photo icon, distinct from Camera)
- New hidden input: `<input type="file" accept="image/*" />` (no `capture` attribute = opens gallery)
- Position the icon with `absolute right-3 top-1/2 -translate-y-1/2` inside the textarea wrapper
- Add right padding to the textarea (`pr-10`) so text doesn't overlap the icon
- Paste handler: listen for `onPaste`, check `e.clipboardData.files`, if an image is found call `handleFileUpload`
- While uploading, swap the icon for a small spinner and disable the input

### Single file changed
Only `src/components/room/RoomChatInput.tsx` needs to be modified. No new files, no new dependencies.

