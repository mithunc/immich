import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/domain/models/asset/base_asset.model.dart';
import 'package:immich_mobile/providers/infrastructure/asset.provider.dart';

// A live query, so trashing a member drops it from the strip while the viewer is open.
class StackChildrenNotifier extends AutoDisposeFamilyStreamNotifier<List<RemoteAsset>, BaseAsset> {
  @override
  Stream<List<RemoteAsset>> build(BaseAsset asset) {
    if (asset is! RemoteAsset || asset.stackId == null) {
      return Stream.value(const []);
    }

    return ref.watch(assetServiceProvider).watchStack(asset);
  }
}

final stackChildrenNotifier = StreamNotifierProvider.autoDispose
    .family<StackChildrenNotifier, List<RemoteAsset>, BaseAsset>(StackChildrenNotifier.new);
