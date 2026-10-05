import { Kysely } from 'kysely';
import { Stats } from 'node:fs';
import { mkdtempDisposable, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssetJobRepository } from 'src/repositories/asset-job.repository.js';
import { AssetRepository } from 'src/repositories/asset.repository.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { EventRepository } from 'src/repositories/event.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { MetadataRepository } from 'src/repositories/metadata.repository.js';
import { StackRepository } from 'src/repositories/stack.repository.js';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { SystemMetadataRepository } from 'src/repositories/system-metadata.repository.js';
import { TagRepository } from 'src/repositories/tag.repository.js';
import { DB } from 'src/schema/index.js';
import { MetadataService } from 'src/services/metadata.service.js';
import { newMediumService } from 'test/medium.factory.js';
import { getKyselyDB, newRandomImage } from 'test/utils.js';

type TimeZoneTest = {
  description: string;
  serverTimeZone?: string;
  exifData: Record<string, any>;
  expected: {
    localDateTime: string;
    dateTimeOriginal: string;
    timeZone: string | null;
  };
};

let defaultDatabase: Kysely<DB>;

const setup = (db?: Kysely<DB>, { realStorage = false } = {}) => {
  const { sut, ctx } = newMediumService(MetadataService, {
    database: db || defaultDatabase,
    real: [
      AssetRepository,
      AssetJobRepository,
      ConfigRepository,
      MetadataRepository,
      StackRepository,
      SystemMetadataRepository,
      TagRepository,
      ...(realStorage ? [StorageRepository] : []),
    ],
    mock: [EventRepository, LoggingRepository, ...(realStorage ? [] : [StorageRepository])],
  });

  if (!realStorage) {
    ctx.getMock(StorageRepository).stat.mockResolvedValue({
      size: 123_456,
      mtime: new Date(654_321),
      mtimeMs: 654_321,
      birthtimeMs: 654_322,
    } as Stats);
  }

  return { sut, ctx };
};

const createTestFile = async (exifData: Record<string, any>) => {
  const { ctx } = setup();
  const data = newRandomImage();
  const filePath = join(tmpdir(), 'test.png');
  await writeFile(filePath, data);
  await ctx.get(MetadataRepository).writeTags(filePath, exifData);
  return { filePath };
};

beforeAll(async () => {
  defaultDatabase = await getKyselyDB();
});

describe(MetadataService.name, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should be defined', () => {
    const { sut } = setup();
    expect(sut).toBeDefined();
  });

  describe('sidecar metadata extraction', () => {
    it('should persist metadata read from a discovered XMP sidecar', async () => {
      await using tempDir = await mkdtempDisposable(join(tmpdir(), 'immich-sidecar-'));
      const { sut, ctx } = setup(undefined, { realStorage: true });
      const originalPath = join(tempDir.path, 'photo.png');
      await writeFile(originalPath, newRandomImage());
      const metadata = ctx.get(MetadataRepository);
      await metadata.writeTags(originalPath, { Rating: 1 });
      await metadata.writeTags(`${originalPath}.xmp`, { Rating: 5, DateTimeOriginal: '2024:07:11 10:32:52+00:00' });
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });
      ctx.getMock(EventRepository).emit.mockResolvedValue();

      await sut.handleSidecarCheck({ id: asset.id });
      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(
        ctx.database
          .selectFrom('asset_exif')
          .where('assetId', '=', asset.id)
          .select(['rating', 'dateTimeOriginal'])
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ rating: 5, dateTimeOriginal: new Date('2024-07-11T10:32:52.000Z') });
    });
  });

  describe('handleMetadataExtraction', () => {
    const timeZoneTests: TimeZoneTest[] = [
      {
        description: 'should handle no time zone information',
        exifData: {
          DateTimeOriginal: '2022:01:01 00:00:00',
        },
        expected: {
          localDateTime: '2022-01-01T00:00:00.000Z',
          dateTimeOriginal: '2022-01-01T00:00:00.000Z',
          timeZone: null,
        },
      },
      {
        description: 'should handle a +13:00 time zone',
        exifData: {
          DateTimeOriginal: '2022:01:01 00:00:00+13:00',
        },
        expected: {
          localDateTime: '2022-01-01T00:00:00.000Z',
          dateTimeOriginal: '2021-12-31T11:00:00.000Z',
          timeZone: 'UTC+13',
        },
      },
    ];

    it.each(timeZoneTests)('$description', async ({ exifData, serverTimeZone, expected }) => {
      vi.stubEnv('TZ', serverTimeZone);

      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile(exifData);
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });

      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(
        ctx.database
          .selectFrom('asset_exif')
          .select(['dateTimeOriginal', 'timeZone', 'lockedProperties'])
          .where('assetId', '=', asset.id)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({
        dateTimeOriginal: new Date(expected.dateTimeOriginal),
        timeZone: expected.timeZone,
        lockedProperties: null,
      });

      await expect(ctx.get(AssetRepository).getById(asset.id)).resolves.toEqual(
        expect.objectContaining({ localDateTime: new Date(expected.localDateTime) }),
      );
    });

    it('should handle dates far in the future', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ CreateDate: '42603:05:04 04:12:48' });
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });

      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(
        ctx.database
          .selectFrom('asset_exif')
          .where('assetId', '=', asset.id)
          .select('dateTimeOriginal')
          .executeTakeFirstOrThrow(),
        // note that this date is technically wrong. it does not throw though and should get the user's attention either way.
      ).resolves.toEqual({ dateTimeOriginal: new Date('4260-03-05T04:04:12.000Z') });
    });

    it('should ignore IFD1 thumbnail orientation when extracting metadata', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ 'IFD1:Orientation#': 6 });
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });

      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(
        ctx.database
          .selectFrom('asset_exif')
          .select('orientation')
          .where('assetId', '=', asset.id)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ orientation: null });
    });

    it('should ignore IFD1 thumbnail dimensions when extracting metadata', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ 'IFD1:ImageWidth#': 160, 'IFD1:ImageHeight#': 120 });
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });

      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(ctx.get(AssetRepository).getById(asset.id)).resolves.toEqual(
        expect.objectContaining({ width: 1, height: 1 }),
      );
    });

    it('should keep IFD0 orientation when extracting metadata', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ 'IFD0:Orientation#': 6 });
      const { user } = await ctx.newUser();
      const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
      await ctx.newExif({ assetId: asset.id, description: '' });

      await sut.handleMetadataExtraction({ id: asset.id });

      await expect(
        ctx.database
          .selectFrom('asset_exif')
          .select('orientation')
          .where('assetId', '=', asset.id)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ orientation: '6' });
    });

    it('should stack a JPEG with its RAW, with the JPEG on top', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ DateTimeOriginal: '2026:10:03 14:32:00.200-07:00' });
      const { user } = await ctx.newUser();
      const { asset: raw } = await ctx.newAsset({
        ownerId: user.id,
        originalFileName: 'PXL_20261003_213200200.RAW-02.ORIGINAL.dng',
        fileCreatedAt: new Date('2026-10-03T21:31:59.989Z'),
      });
      const { asset: unrelated } = await ctx.newAsset({
        ownerId: user.id,
        originalFileName: 'PXL_20261003_213206951.RAW-02.ORIGINAL.dng',
        fileCreatedAt: new Date('2026-10-03T21:32:06.951Z'),
      });
      const { asset: jpeg } = await ctx.newAsset({
        ownerId: user.id,
        originalPath: filePath,
        originalFileName: 'PXL_20261003_213200200.RAW-01.COVER.jpg',
      });
      await ctx.newExif({ assetId: jpeg.id, description: '' });

      await sut.handleMetadataExtraction({ id: jpeg.id });
      // running extraction again (e.g. Extract Metadata → All) must not create another stack
      await sut.handleMetadataExtraction({ id: jpeg.id });

      const stacks = await ctx.database.selectFrom('stack').selectAll().where('ownerId', '=', user.id).execute();
      expect(stacks).toEqual([expect.objectContaining({ primaryAssetId: jpeg.id })]);
      const assets = await ctx.database
        .selectFrom('asset')
        .select(['id', 'stackId'])
        .where('id', 'in', [jpeg.id, raw.id, unrelated.id])
        .execute();
      expect(assets).toEqual(
        expect.arrayContaining([
          { id: jpeg.id, stackId: stacks[0].id },
          { id: raw.id, stackId: stacks[0].id },
          { id: unrelated.id, stackId: null },
        ]),
      );
    });

    it('should gather edits exported from the RAW into its stack, with the camera image on top', async () => {
      const { sut, ctx } = setup();
      ctx.getMock(EventRepository).emit.mockResolvedValue();
      const { filePath } = await createTestFile({ DateTimeOriginal: '2026:10:03 14:32:00.200-07:00' });
      const { user } = await ctx.newUser();
      const { asset: raw } = await ctx.newAsset({
        ownerId: user.id,
        originalFileName: 'PXL_20261003_213200200.RAW-02.ORIGINAL.dng',
        fileCreatedAt: new Date('2026-10-03T21:32:00.200Z'),
      });
      const { asset: edit } = await ctx.newAsset({
        ownerId: user.id,
        originalFileName: 'PXL_20261003_213200200.RAW-02.ORIGINAL (1).jpg',
        fileCreatedAt: new Date('2026-10-03T21:32:00.200Z'),
      });
      // stacked before the camera's image was extracted, with the edit as the cover
      await ctx.get(StackRepository).create({ ownerId: user.id }, [edit.id, raw.id]);
      const { asset: jpeg } = await ctx.newAsset({
        ownerId: user.id,
        originalPath: filePath,
        originalFileName: 'PXL_20261003_213200200.RAW-01.MP.COVER.jpg',
      });
      await ctx.newExif({ assetId: jpeg.id, description: '' });
      const { asset: laterEdit } = await ctx.newAsset({
        ownerId: user.id,
        originalPath: filePath,
        originalFileName: 'PXL_20261003_213200200.RAW-02.ORIGINAL.jpg',
      });
      await ctx.newExif({ assetId: laterEdit.id, description: '' });

      await sut.handleMetadataExtraction({ id: jpeg.id });
      await sut.handleMetadataExtraction({ id: laterEdit.id });

      const stacks = await ctx.database.selectFrom('stack').selectAll().where('ownerId', '=', user.id).execute();
      expect(stacks).toEqual([expect.objectContaining({ primaryAssetId: jpeg.id })]);
      const assets = await ctx.database
        .selectFrom('asset')
        .select(['id', 'stackId'])
        .where('id', 'in', [jpeg.id, raw.id, edit.id, laterEdit.id])
        .execute();
      expect(assets).toHaveLength(4);
      expect(assets.every(({ stackId }) => stackId === stacks[0].id)).toBe(true);
    });
  });

  it('should handle float lens models (#30492)', async () => {
    const { sut, ctx } = setup();
    ctx.getMock(EventRepository).emit.mockResolvedValue();
    const { filePath } = await createTestFile({ LensModel: 1.8 });
    const { user } = await ctx.newUser();
    const { asset } = await ctx.newAsset({ originalPath: filePath, ownerId: user.id });
    await ctx.newExif({ assetId: asset.id, description: '' });

    await sut.handleMetadataExtraction({ id: asset.id });

    await expect(
      ctx.database
        .selectFrom('asset_exif')
        .where('assetId', '=', asset.id)
        .select('lensModel')
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ lensModel: '1.8' });
  });
});
