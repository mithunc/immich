import 'package:path/path.dart' as p;

// Mirrors the server's RAW extensions (server/src/utils/mime-types.ts), minus .psd which isn't a camera RAW
const _rawExtensions = {
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
};

bool isRawFileName(String fileName) => _rawExtensions.contains(p.extension(fileName).toLowerCase());
