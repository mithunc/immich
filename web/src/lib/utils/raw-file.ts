// Mirrors the server's RAW extensions (server/src/utils/mime-types.ts), minus .psd which isn't a camera RAW
const rawExtensions = new Set([
  '.3fr',
  '.ari',
  '.arw',
  '.cap',
  '.cin',
  '.cr2',
  '.cr3',
  '.crw',
  '.dcr',
  '.dng',
  '.erf',
  '.fff',
  '.iiq',
  '.k25',
  '.kdc',
  '.mrw',
  '.nef',
  '.nrw',
  '.orf',
  '.ori',
  '.pef',
  '.raf',
  '.raw',
  '.rw2',
  '.rwl',
  '.sr2',
  '.srf',
  '.srw',
  '.x3f',
]);

export const isRawFileName = (fileName: string) => {
  const dot = fileName.lastIndexOf('.');
  return dot !== -1 && rawExtensions.has(fileName.slice(dot).toLowerCase());
};
