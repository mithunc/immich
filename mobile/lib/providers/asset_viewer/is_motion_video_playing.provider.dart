import 'dart:async';

import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/providers/infrastructure/settings.provider.dart';

/// Whether to display the video part of a motion photo.
///
/// This is a sticky, global toggle: whatever play/pause state the play
/// button (see MotionPhotoActionButton) leaves it in persists via [toggle]
/// and seeds the next motion photo opened, in
/// AssetViewerStateNotifier._syncMotionPhotoPlayback.
final isPlayingMotionVideoProvider = StateNotifierProvider<IsPlayingMotionVideo, bool>((ref) {
  return IsPlayingMotionVideo(ref);
});

class IsPlayingMotionVideo extends StateNotifier<bool> {
  IsPlayingMotionVideo(this.ref) : super(false);

  final Ref ref;

  bool get playing => state;

  /// Seeds/overrides the in-memory play state without persisting it —
  /// used when opening a new asset, and by transient interactions (e.g.
  /// long-press preview) that should not change the sticky default.
  set playing(bool value) {
    state = value;
  }

  /// The play button was tapped: flips state and persists it as the
  /// sticky default for the next motion photo opened.
  void toggle() {
    state = !state;
    unawaited(ref.read(settingsProvider).write(.viewerAutoPlayMotionPhoto, state));
  }
}
