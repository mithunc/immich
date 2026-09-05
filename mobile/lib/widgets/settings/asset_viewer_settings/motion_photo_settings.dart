import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/providers/infrastructure/settings.provider.dart';
import 'package:immich_ui/immich_ui.dart';

class MotionPhotoSettings extends HookConsumerWidget {
  const MotionPhotoSettings({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewer = ref.watch(appConfigProvider).viewer;
    final useAutoPlayMotionPhoto = useState(viewer.autoPlayMotionPhoto);
    final useLoopMotionPhoto = useState(viewer.loopMotionPhoto);

    useValueChanged<bool, void>(useAutoPlayMotionPhoto.value, (_, _) {
      unawaited(ref.read(settingsProvider).write(.viewerAutoPlayMotionPhoto, useAutoPlayMotionPhoto.value));
    });
    useValueChanged<bool, void>(useLoopMotionPhoto.value, (_, _) {
      unawaited(ref.read(settingsProvider).write(.viewerLoopMotionPhoto, useLoopMotionPhoto.value));
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SettingGroupTitle(title: context.t.motion_photos, icon: Icons.motion_photos_on_outlined),
        SettingsSwitchListTile(
          valueNotifier: useAutoPlayMotionPhoto,
          title: context.t.setting_motion_photo_auto_play_title,
          subtitle: context.t.setting_motion_photo_auto_play_subtitle,
        ),
        SettingsSwitchListTile(
          valueNotifier: useLoopMotionPhoto,
          title: context.t.setting_motion_photo_looping_title,
          subtitle: context.t.setting_motion_photo_looping_subtitle,
        ),
      ],
    );
  }
}
