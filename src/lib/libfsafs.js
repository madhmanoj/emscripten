/**
 * @license
 * Copyright 2025 Your Name
 * SPDX-License-Identifier: MIT
 */

addToLibrary({
  $FSAFS__deps: ['wasmfs_create_fsaccess_backend'],
  $FSAFS: {
    createBackend(opts) {
      return _wasmfs_create_fsaccess_backend();
    }
  },
});

if (!WASMFS) {
  error("using -lfsa.js requires using WasmFS (-sWASMFS)");
}