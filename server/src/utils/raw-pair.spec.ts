import { compareRawStackCover, getRawPairKey } from 'src/utils/raw-pair.js';

describe('getRawPairKey', () => {
  it.each([
    ['PXL_20261003_213200200.RAW-01.COVER.jpg', 'pxl_20261003_213200200'],
    ['PXL_20261003_213154988.RAW-01.MP.COVER.jpg', 'pxl_20261003_213154988'],
    ['PXL_20260825_185123355.RAW-01.MP.jpg', 'pxl_20260825_185123355'],
    ['PXL_20260825_112736406.RAW-01.jpg', 'pxl_20260825_112736406'],
    ['PXL_20261003_213200200.RAW-02.ORIGINAL.dng', 'pxl_20261003_213200200'],
    ['PXL_20261003_213200200.RAW-02.ORIGINAL.jpg', 'pxl_20261003_213200200'],
    ['PXL_20261003_213200200.RAW-02.ORIGINAL (1).jpg', 'pxl_20261003_213200200'],
    ['IMG_1234.JPG', 'img_1234'],
    ['IMG_1234.CR3', 'img_1234'],
    ['IMG_1234 (2).jpg', 'img_1234'],
    ['DSC01234.heic', 'dsc01234'],
  ])('should return the shared name for %s', (fileName, expected) => {
    expect(getRawPairKey(fileName)).toBe(expected);
  });

  it.each(['PXL_20261003_213200200.mp4', 'IMG_1234', 'notes.txt'])('should return null for %s', (fileName) => {
    expect(getRawPairKey(fileName)).toBeNull();
  });
});

describe('compareRawStackCover', () => {
  const uploadedAt = new Date('2026-10-03T21:35:00.000Z');
  const sortNames = (...members: Array<[string, Date?]>) =>
    members
      .map(([originalFileName, createdAt = uploadedAt]) => ({ originalFileName, createdAt }))
      .toSorted(compareRawStackCover)
      .map(({ originalFileName }) => originalFileName);

  it('should put a processed image before its RAW', () => {
    expect(sortNames(['IMG_1234.DNG'], ['IMG_1234.heic'])).toEqual(['IMG_1234.heic', 'IMG_1234.DNG']);
  });

  it("should put the Pixel camera's image before edits exported from its DNG, whenever they were uploaded", () => {
    expect(
      sortNames(
        ['PXL_20261003_213200200.RAW-02.ORIGINAL.jpg', new Date('2026-10-03T21:32:01.000Z')],
        ['PXL_20261003_213200200.RAW-02.ORIGINAL.dng'],
        ['PXL_20261003_213200200.RAW-01.MP.COVER.jpg'],
      ),
    ).toEqual([
      'PXL_20261003_213200200.RAW-01.MP.COVER.jpg',
      'PXL_20261003_213200200.RAW-02.ORIGINAL.jpg',
      'PXL_20261003_213200200.RAW-02.ORIGINAL.dng',
    ]);
  });

  it('should otherwise put the earliest upload first', () => {
    expect(sortNames(['IMG_1234.jpg', new Date('2026-10-04T18:00:00.000Z')], ['IMG_1234.JPG'])).toEqual([
      'IMG_1234.JPG',
      'IMG_1234.jpg',
    ]);
  });
});
