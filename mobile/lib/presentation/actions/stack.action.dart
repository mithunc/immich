import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:immich_mobile/constants/enums.dart';
import 'package:immich_mobile/generated/translations.g.dart';
import 'package:immich_mobile/presentation/actions/action.dart';
import 'package:immich_mobile/presentation/widgets/asset_viewer/asset_stack.provider.dart';
import 'package:immich_mobile/providers/infrastructure/asset.provider.dart';
import 'package:immich_mobile/providers/infrastructure/toast.provider.dart';
import 'package:immich_mobile/providers/user.provider.dart';
import 'package:immich_mobile/utils/error_handler.dart';
import 'package:immich_mobile/widgets/common/confirm_dialog.dart';

typedef _State = ({bool shouldStack, List<String> assetIds, List<String> stackIds});

final _stateProvider = Provider.family.autoDispose<_State?, ActionSource>((ref, source) {
  final assets = ref.watch(ownedAssetsActionProvider(source));
  final shouldStack = assets.stacked(isStacked: false).isNotEmpty;
  // Stacking needs at least two assets; unstacking needs at least one stack.
  if (shouldStack ? assets.elementAtOrNull(1) == null : assets.isEmpty) {
    return null;
  }

  return (
    shouldStack: shouldStack,
    assetIds: assets.map((asset) => asset.id).toList(growable: false),
    stackIds: assets.map((asset) => asset.stackId).nonNulls.toList(growable: false),
  );
}, dependencies: [ownedAssetsActionProvider]);

class StackAction extends AssetActionBuilder {
  const StackAction({required super.source});

  @override
  ActionItem? create(BuildContext context, WidgetRef ref) {
    final shouldStack = ref.watch(_stateProvider(source).select((state) => state?.shouldStack));
    if (shouldStack == null) {
      return null;
    }

    return .new(
      icon: shouldStack ? Icons.filter_none_rounded : Icons.layers_clear_outlined,
      label: shouldStack ? context.t.stack : context.t.unstack,
      onAction: () => _stack(context, ref),
    );
  }

  Future<void> _stack(BuildContext context, WidgetRef ref) async {
    final state = ref.read(_stateProvider(source));
    if (state == null) {
      return;
    }

    final (:shouldStack, :assetIds, :stackIds) = state;
    final message = shouldStack
        ? context.t.stacked_assets_count(count: assetIds.length)
        : context.t.unstacked_assets_count(count: assetIds.length);
    final assetService = ref.read(assetServiceProvider);
    final userId = ref.read(authUserProvider).id;
    final toastService = ref.read(toastServiceProvider);
    final clearSelection = ref.read(clearSelectionProvider(source));

    try {
      if (shouldStack) {
        await assetService.stack(userId, assetIds);
      } else {
        await assetService.unstack(stackIds);
      }
      toastService.success(message);
      clearSelection();
    } catch (error, stack) {
      handleError(error, stack: stack, description: "Failed to update the stack for assets");
    }
  }
}

typedef _MemberState = ({String assetId, String stackId});

// A single owned, stacked asset (the one open in the viewer). Null for any other selection.
final _memberProvider = Provider.family.autoDispose<_MemberState?, ActionSource>((ref, source) {
  final assets = ref.watch(ownedAssetsActionProvider(source));
  if (assets.length != 1) {
    return null;
  }

  final asset = assets.first;
  final stackId = asset.stackId;
  return stackId == null ? null : (assetId: asset.id, stackId: stackId);
}, dependencies: [ownedAssetsActionProvider]);

class SetStackPrimaryAction extends AssetActionBuilder {
  const SetStackPrimaryAction({required super.source});

  @override
  ActionItem? create(BuildContext context, WidgetRef ref) {
    final member = ref.watch(_memberProvider(source));
    if (member == null) {
      return null;
    }

    // Hidden until the primary is known, and for the primary itself.
    final primaryId = ref.watch(stackPrimaryIdProvider(member.stackId)).valueOrNull;
    if (primaryId == null || primaryId == member.assetId) {
      return null;
    }

    return .new(
      icon: Icons.image_outlined,
      label: context.t.set_stack_primary_asset,
      onAction: () => _setPrimary(ref, member),
    );
  }

  Future<void> _setPrimary(WidgetRef ref, _MemberState member) async {
    try {
      await ref.read(assetServiceProvider).setStackPrimary(member.stackId, member.assetId);
    } catch (error, stack) {
      handleError(error, stack: stack, description: "Failed to set the stack primary asset");
    }
  }
}

class KeepThisDeleteOthersAction extends AssetActionBuilder {
  const KeepThisDeleteOthersAction({required super.source});

  @override
  ActionItem? create(BuildContext context, WidgetRef ref) {
    final member = ref.watch(_memberProvider(source));
    if (member == null) {
      return null;
    }

    return .new(
      icon: Icons.layers_clear_outlined,
      label: context.t.keep_this_delete_others,
      onAction: () => _keepThis(context, ref, member),
    );
  }

  Future<void> _keepThis(BuildContext context, WidgetRef ref, _MemberState member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => ConfirmDialog(
        title: context.t.keep_this_delete_others,
        content: context.t.confirm_keep_this_delete_others,
        ok: context.t.delete_others,
      ),
    );
    if (confirmed != true || !context.mounted) {
      return;
    }

    final assetService = ref.read(assetServiceProvider);
    final toastService = ref.read(toastServiceProvider);
    final message = context.t;

    try {
      final count = await assetService.keepOnlyInStack(member.stackId, member.assetId);
      toastService.success(message.kept_this_deleted_others(count: count));
    } catch (error, stack) {
      handleError(error, stack: stack, description: "Failed to keep this asset and delete the others");
    }
  }
}
