import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/data/db/main/database.dart';
import 'package:immich_mobile/domain/models/config/app_config.dart';
import 'package:immich_mobile/domain/models/store.model.dart';
import 'package:immich_mobile/domain/services/store.service.dart';
import 'package:immich_mobile/domain/services/timeline.service.dart';
import 'package:immich_mobile/infrastructure/repositories/store.repository.dart';
import 'package:immich_mobile/presentation/widgets/asset_viewer/asset_stack.widget.dart';
import 'package:immich_mobile/providers/asset_viewer/asset_viewer.provider.dart';
import 'package:immich_mobile/providers/infrastructure/asset.provider.dart';
import 'package:immich_mobile/providers/infrastructure/settings.provider.dart';
import 'package:immich_mobile/providers/infrastructure/timeline.provider.dart';
import 'package:mocktail/mocktail.dart';

import '../../../service.mocks.dart';
import '../../../unit/factories/remote_asset_factory.dart';
import '../../../widget_tester_extensions.dart';

class MockTimelineService extends Mock implements TimelineService {}

void main() {
  final jpeg = RemoteAssetFactory.create(name: 'PXL_20261003_213200200.RAW-01.COVER.jpg', stackId: 'stack');
  final raw = RemoteAssetFactory.create(name: 'PXL_20261003_213200200.RAW-02.ORIGINAL.dng', stackId: 'stack');

  late WidgetRef ref;

  Future<void> pumpStack(WidgetTester tester) async {
    final assetService = MockAssetService();
    final timeline = MockTimelineService();
    when(() => assetService.watchAsset(any())).thenAnswer((_) => const Stream.empty());
    when(() => timeline.origin).thenReturn(.main);

    await tester.pumpConsumerWidget(
      Consumer(
        builder: (context, widgetRef, _) {
          ref = widgetRef;
          return AssetStackRow(stack: [jpeg, raw]);
        },
      ),
      overrides: [
        appConfigProvider.overrideWithValue(const AppConfig()),
        assetServiceProvider.overrideWithValue(assetService),
        timelineServiceProvider.overrideWithValue(timeline),
      ],
    );
  }

  setUpAll(() async {
    registerFallbackValue(jpeg);
    // thumbnails build their URL from the server endpoint
    final db = Drift(DatabaseConnection(NativeDatabase.memory(), closeStreamsSynchronously: true));
    await StoreService.init(storeRepository: StoreRepository(db), listenUpdates: false);
    await StoreService.I.put(StoreKey.serverEndpoint, 'http://localhost:3000');
  });

  testWidgets('labels only the RAW member of the stack', (tester) async {
    await pumpStack(tester);

    expect(find.text('RAW'), findsOneWidget);
  });

  testWidgets('tapping the RAW member shows it', (tester) async {
    await pumpStack(tester);

    await tester.tap(find.text('RAW'));
    await tester.pump();

    final state = ref.read(assetViewerProvider);
    expect(state.currentAsset, raw);
    expect(state.stackIndex, 1);
  });
}
