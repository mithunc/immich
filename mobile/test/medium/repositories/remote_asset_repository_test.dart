import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immich_mobile/data/db/main/table/remote/asset.drift.dart';
import 'package:immich_mobile/data/db/main/table/remote/stack.drift.dart';
import 'package:immich_mobile/infrastructure/repositories/remote_asset.repository.dart';

import '../repository_context.dart';

void main() {
  late MediumRepositoryContext ctx;
  late RemoteAssetRepository sut;

  setUp(() {
    ctx = MediumRepositoryContext();
    sut = RemoteAssetRepository(ctx.db);
  });

  tearDown(() async {
    await ctx.dispose();
  });

  group('getByChecksum', () {
    late String userId;

    setUp(() async {
      final user = await ctx.newUser();
      userId = user.id;
      await ctx.newAuthUser(id: userId);
    });

    test('returns all assets when a partner shares the checksum', () async {
      const checksum = 'shared-partner-checksum';
      final mine = await ctx.newRemoteAsset(ownerId: userId, checksum: checksum);
      final partner = await ctx.newUser();
      final theirs = await ctx.newRemoteAsset(ownerId: partner.id, checksum: checksum);

      final result = await sut.getAllDebugForChecksum(checksum);
      final mineResult = result.firstWhere((asset) => asset.id == mine.id);
      final theirResult = result.firstWhere((asset) => asset.id == theirs.id);

      expect(result, isNotEmpty);
      expect(mineResult.id, mine.id);
      expect(mineResult.ownerId, userId);

      expect(theirResult.id, theirs.id);
      expect(theirResult.ownerId, partner.id);
    });

    test('returns partner asset only if there is no matching user asset', () async {
      const checksum = 'partner-only';
      final partner = await ctx.newUser();
      final theirs = await ctx.newRemoteAsset(ownerId: partner.id, checksum: checksum);

      final result = await sut.getAllDebugForChecksum(checksum);

      expect(result.length, 1);
      expect(result[0].id, theirs.id);
    });

    test('returns the current user\'s asset', () async {
      const checksum = 'simple';
      final remote = await ctx.newRemoteAsset(ownerId: userId, checksum: checksum);

      final result = await sut.getAllDebugForChecksum(checksum);

      expect(result.length, 1);
      expect(result[0].id, remote.id);
    });
  });

  group('updateAssets', () {
    Future<String?> groupDate(String id) async =>
        (await (ctx.db.remoteAssetEntity.select()..where((row) => row.id.equals(id))).getSingle()).groupDate;

    test('a created_at edit moves group_date only for rows without local_date_time', () async {
      final user = await ctx.newUser();
      final withLocal = await ctx.newRemoteAsset(ownerId: user.id, localDateTime: DateTime.utc(2024, 1, 5, 12));
      final noLocal = await ctx.newRemoteAsset(ownerId: user.id, createdAt: DateTime.utc(2024, 1, 1, 12));
      final clearLocal = ctx.db.update(ctx.db.remoteAssetEntity)..where((row) => row.id.equals(noLocal.id));
      await clearLocal.write(const RemoteAssetEntityCompanion(localDateTime: Value(null)));

      await sut.updateAssets([withLocal.id, noLocal.id], createdAt: .some(DateTime.utc(2026, 7, 24, 12)));

      expect(await groupDate(withLocal.id), '2024-01-05');
      expect(await groupDate(noLocal.id), '2026-07-24');
    });

    test('a favorite edit leaves group_date alone', () async {
      final user = await ctx.newUser();
      final asset = await ctx.newRemoteAsset(ownerId: user.id, createdAt: DateTime.utc(2024, 1, 1, 12));
      final clearLocal = ctx.db.update(ctx.db.remoteAssetEntity)..where((row) => row.id.equals(asset.id));
      await clearLocal.write(const RemoteAssetEntityCompanion(localDateTime: Value(null)));

      await sut.updateAssets([asset.id], isFavorite: const .some(true));

      expect(await groupDate(asset.id), '2024-01-01');
    });
  });
  group('watchStackChildren', () {
    test('drops a member from the stream once it is trashed', () async {
      final user = await ctx.newUser();
      final primary = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      final older = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack', createdAt: DateTime.utc(2026, 1, 1));
      final newer = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack', createdAt: DateTime.utc(2026, 1, 2));
      await ctx.newRemoteAsset(ownerId: user.id);

      final stream = sut.watchStackChildren((await sut.get(primary.id))!).map((s) => s.map((a) => a.id).toList());

      final expectation = expectLater(
        stream,
        emitsInOrder([
          [newer.id, older.id],
          [older.id],
        ]),
      );
      await pumpEventQueue();
      await sut.trash([newer.id]);
      await expectation;
    });

    test('leaves out members already in the trash', () async {
      final user = await ctx.newUser();
      final primary = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      final kept = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack', deletedAt: DateTime.utc(2026, 1, 1));

      final children = await sut.watchStackChildren((await sut.get(primary.id))!).first;

      expect(children.map((a) => a.id), [kept.id]);
    });
  });
  group('stack members', () {
    test('getStackAssetIds returns the members not in the trash', () async {
      final user = await ctx.newUser();
      final primary = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      final child = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack', deletedAt: DateTime.utc(2026, 1, 1));
      await ctx.newRemoteAsset(ownerId: user.id, stackId: 'other');

      expect(await sut.getStackAssetIds('stack'), unorderedEquals([primary.id, child.id]));
    });

    test('setStackPrimary moves the primary and the watcher sees it', () async {
      final user = await ctx.newUser();
      final first = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      final second = await ctx.newRemoteAsset(ownerId: user.id, stackId: 'stack');
      await ctx.db
          .into(ctx.db.stackEntity)
          .insert(StackEntityCompanion.insert(id: 'stack', ownerId: user.id, primaryAssetId: first.id));

      final expectation = expectLater(sut.watchStackPrimaryId('stack'), emitsInOrder([first.id, second.id]));
      await pumpEventQueue();
      await sut.setStackPrimary('stack', second.id);
      await expectation;
    });
  });
}
