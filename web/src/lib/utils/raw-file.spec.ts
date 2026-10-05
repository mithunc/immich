import { isRawFileName } from '$lib/utils/raw-file';

describe('isRawFileName', () => {
  it.each(['PXL_20261003_201512345.RAW-02.ORIGINAL.dng', 'IMG_1234.CR3', 'DSC_0001.nef', 'photo.ARW'])(
    'should be true for %s',
    (fileName) => {
      expect(isRawFileName(fileName)).toBe(true);
    },
  );

  it.each(['PXL_20261003_201512345.RAW-01.MP.COVER.jpg', 'IMG_1234.HEIC', 'design.psd', 'dng', 'video.mp4', ''])(
    'should be false for %s',
    (fileName) => {
      expect(isRawFileName(fileName)).toBe(false);
    },
  );
});
