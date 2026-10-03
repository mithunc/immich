import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/utils/raw_file.dart';

void main() {
  group('isRawFileName', () {
    test('recognises camera RAW files regardless of case', () {
      expect(isRawFileName('PXL_20261003_213200200.RAW-02.ORIGINAL.dng'), isTrue);
      expect(isRawFileName('IMG_1234.CR3'), isTrue);
      expect(isRawFileName('DSC01234.arw'), isTrue);
    });

    test('rejects processed images, including Pixel RAW+JPEG covers', () {
      expect(isRawFileName('PXL_20261003_213200200.RAW-01.COVER.jpg'), isFalse);
      expect(isRawFileName('PXL_20261003_213154988.RAW-01.MP.COVER.jpg'), isFalse);
      expect(isRawFileName('IMG_1234.HEIC'), isFalse);
      expect(isRawFileName('artwork.psd'), isFalse);
      expect(isRawFileName('no_extension'), isFalse);
    });
  });
}
