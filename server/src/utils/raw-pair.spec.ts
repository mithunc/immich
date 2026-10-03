import { getRawPairKey, isRawPair } from 'src/utils/raw-pair.js';

describe('getRawPairKey', () => {
  it.each([
    ['PXL_20261003_213200200.RAW-01.COVER.jpg', 'pxl_20261003_213200200'],
    ['PXL_20261003_213154988.RAW-01.MP.COVER.jpg', 'pxl_20261003_213154988'],
    ['PXL_20260825_185123355.RAW-01.MP.jpg', 'pxl_20260825_185123355'],
    ['PXL_20260825_112736406.RAW-01.jpg', 'pxl_20260825_112736406'],
    ['PXL_20261003_213200200.RAW-02.ORIGINAL.dng', 'pxl_20261003_213200200'],
    ['IMG_1234.JPG', 'img_1234'],
    ['IMG_1234.CR3', 'img_1234'],
    ['DSC01234.heic', 'dsc01234'],
  ])('should return the shared name for %s', (fileName, expected) => {
    expect(getRawPairKey(fileName)).toBe(expected);
  });

  it.each(['PXL_20261003_213200200.mp4', 'IMG_1234', 'notes.txt'])('should return null for %s', (fileName) => {
    expect(getRawPairKey(fileName)).toBeNull();
  });
});

describe('isRawPair', () => {
  it('should pair a Pixel JPEG with its DNG', () => {
    expect(isRawPair('PXL_20261003_213200200.RAW-01.COVER.jpg', 'PXL_20261003_213200200.RAW-02.ORIGINAL.dng')).toBe(
      true,
    );
  });

  it('should pair a plain image with a same-name RAW in either order', () => {
    expect(isRawPair('IMG_1234.ARW', 'IMG_1234.jpg')).toBe(true);
    expect(isRawPair('img_1234.heic', 'IMG_1234.DNG')).toBe(true);
  });

  it('should not pair two non-RAW images', () => {
    expect(isRawPair('IMG_1234.jpg', 'IMG_1234.heic')).toBe(false);
  });

  it('should not pair two RAW files', () => {
    expect(isRawPair('IMG_1234.dng', 'IMG_1234.cr3')).toBe(false);
  });

  it('should not pair different names', () => {
    expect(isRawPair('PXL_20261003_213200200.RAW-01.jpg', 'PXL_20261003_213206951.RAW-02.ORIGINAL.dng')).toBe(false);
  });
});
