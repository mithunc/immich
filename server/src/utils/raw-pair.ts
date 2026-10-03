import { parse } from 'node:path';
import { mimeTypes } from 'src/utils/mime-types.js';

// Pixel names RAW+JPEG captures `PXL_<timestamp>.RAW-01[.MP][.COVER].jpg` and `PXL_<timestamp>.RAW-02.ORIGINAL.dng`
const PIXEL_RAW_PATTERN = /^(.+)\.RAW-\d+\..+$/i;

/**
 * Returns the name shared by an image and its RAW counterpart, e.g. `pxl_20261003_213200200` or `img_1234`,
 * or null if the file is not an image.
 */
export const getRawPairKey = (originalFileName: string): string | null => {
  if (!mimeTypes.isImage(originalFileName)) {
    return null;
  }

  const pixelMatch = PIXEL_RAW_PATTERN.exec(originalFileName);
  const key = pixelMatch ? pixelMatch[1] : parse(originalFileName).name;
  return key ? key.toLowerCase() : null;
};

/** Whether two file names are a processed image (JPEG, HEIC, ...) and the RAW it was developed from */
export const isRawPair = (fileNameA: string, fileNameB: string): boolean => {
  const keyA = getRawPairKey(fileNameA);
  return (
    keyA !== null && keyA === getRawPairKey(fileNameB) && mimeTypes.isRaw(fileNameA) !== mimeTypes.isRaw(fileNameB)
  );
};
