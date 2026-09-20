import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/settings_key.dart';
import 'package:immich_mobile/providers/asset_viewer/is_motion_video_playing.provider.dart';
import 'package:immich_mobile/providers/infrastructure/settings.provider.dart';
import 'package:mocktail/mocktail.dart';

import '../../infrastructure/repository.mock.dart';

void main() {
  late MockSettingsRepository settingsRepository;
  late ProviderContainer container;

  setUpAll(() => registerFallbackValue(SettingsKey.viewerAutoPlayMotionPhoto));

  setUp(() {
    settingsRepository = MockSettingsRepository();
    when(() => settingsRepository.write<bool, bool>(any(), any())).thenAnswer((_) async {});

    container = ProviderContainer(overrides: [settingsProvider.overrideWithValue(settingsRepository)]);
    addTearDown(container.dispose);
  });

  group('IsPlayingMotionVideo', () {
    test('toggle flips the in-memory state and persists it as the sticky default', () {
      final notifier = container.read(isPlayingMotionVideoProvider.notifier);

      notifier.toggle();
      expect(container.read(isPlayingMotionVideoProvider), isTrue);
      verify(() => settingsRepository.write<bool, bool>(SettingsKey.viewerAutoPlayMotionPhoto, true)).called(1);

      notifier.toggle();
      expect(container.read(isPlayingMotionVideoProvider), isFalse);
      verify(() => settingsRepository.write<bool, bool>(SettingsKey.viewerAutoPlayMotionPhoto, false)).called(1);
    });

    test('the playing setter seeds state without persisting', () {
      final notifier = container.read(isPlayingMotionVideoProvider.notifier);

      notifier.playing = true;

      expect(container.read(isPlayingMotionVideoProvider), isTrue);
      verifyNever(() => settingsRepository.write<bool, bool>(any(), any()));
    });
  });
}
