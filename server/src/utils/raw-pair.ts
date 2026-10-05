import { parse } from 'node:path';
import { mimeTypes } from 'src/utils/mime-types.js';

// Pixel names RAW+JPEG captures `PXL_<timestamp>.RAW-01[.MP][.COVER].jpg` and `PXL_<timestamp>.RAW-02.ORIGINAL.dng`.
// Edits exported from the DNG (e.g. by Lightroom) keep its name: `PXL_<timestamp>.RAW-02.ORIGINAL[ (1)].jpg`
const PIXEL_RAW_PATTERN = /^(.+)\.RAW-\d+\..+$/i;
const PIXEL_CAMERA_IMAGE_PATTERN = /\.RAW-01\./i;
// the suffix added to a duplicate file name, e.g. `IMG_1234 (1).jpg`
const DUPLICATE_SUFFIX_PATTERN = / \(\d+\)$/;

/**
 * Returns the name shared by an image, the RAW captured with it and any edits exported from them,
 * e.g. `pxl_20261003_213200200` or `img_1234`, or null if the file is not an image.
 */
export const getRawPairKey = (originalFileName: string): string | null => {
  if (!mimeTypes.isImage(originalFileName)) {
    return null;
  }

  const pixelMatch = PIXEL_RAW_PATTERN.exec(originalFileName);
  const key = pixelMatch ? pixelMatch[1] : parse(originalFileName).name.replace(DUPLICATE_SUFFIX_PATTERN, '');
  return key ? key.toLowerCase() : null;
};

type RawStackMember = { originalFileName: string; createdAt: Date };

/**
 * Orders the files of a RAW stack so the best cover comes first: processed images before RAWs,
 * the Pixel camera's own image before edits exported from its DNG, then the earliest upload,
 * which is the camera's image rather than an edit made from it later.
 */
export const compareRawStackCover = (a: RawStackMember, b: RawStackMember): number =>
  Number(mimeTypes.isRaw(a.originalFileName)) - Number(mimeTypes.isRaw(b.originalFileName)) ||
  Number(!PIXEL_CAMERA_IMAGE_PATTERN.test(a.originalFileName)) -
    Number(!PIXEL_CAMERA_IMAGE_PATTERN.test(b.originalFileName)) ||
  a.createdAt.getTime() - b.createdAt.getTime();
