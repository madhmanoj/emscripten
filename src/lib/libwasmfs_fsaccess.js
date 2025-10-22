addToLibrary({
  $FSAccessHandles__deps: ['$HandleAllocator'],
  $FSAccessHandles: "new HandleAllocator()",

  _wasmfs_fsaccess_show_directory_picker__deps: ['$FSAccessHandles', 'emscripten_proxy_finish'],
  // For JSPI or Asyncify:
  // Emscripten generates wrapper code that handles the async/await properly, 
  // allowing C++ code to call this async JS function and wait for it to complete 
  // before continuing
  // Not useful in our case since we forego this by calling in pthread
  // _wasmfs_fsaccess_show_directory_picker__async: false,
  _wasmfs_fsaccess_show_directory_picker: async function(ctx, resultPtr) {
    if (FSAccessHandles.allocated.length == 1) { 
      try {
        const dirHandle = await window.showDirectoryPicker();
        FSAccessHandles.allocated.push(dirHandle);
      } catch (e) {
        console.log('Picker cancelled or failed:', e);
        let result = - {{{ cDefs.EIO }}};
        {{{ makeSetValue('resultPtr', 0, 'result', 'i32') }}}
      }
    }
    _emscripten_proxy_finish(ctx);
  },

  _wasmfs_fsaccess_get_entries__deps: [
    '$FSAccessHandles',
    '$stackSave',
    '$stackRestore',
    'emscripten_proxy_finish'
  ],
  _wasmfs_fsaccess_get_entries: async function(ctx, dirID, entriesPtr, errPtr) {
    try {
      const dirHandle = FSAccessHandles.get(dirID);
      for await (const entry of dirHandle.values()) {
        let sp = stackSave();
        let namePtr = stringToUTF8OnStack(entry.name);
        let type = entry.kind == "file" ?
            {{{ cDefine('File::DataFileKind') }}} :
        {{{ cDefine('File::DirectoryKind') }}};
        __wasmfs_fsaccess_record_entry(entriesPtr, namePtr, type);
        stackRestore(sp);
      }
    } catch (e) {
      console.error('Error getting entries:', e);
      let err = - {{{ cDefs.EIO }}};
      {{{ makeSetValue('errPtr', 0, 'err', 'i32') }}}
    }
    
    _emscripten_proxy_finish(ctx);
  },

  _wasmfs_fsaccess_get_child__deps: [
    '$FSAccessHandles',
    'emscripten_proxy_finish'
  ],
  _wasmfs_fsaccess_get_child: async function(ctx, parent, namePtr, childTypePtr, childIDPtr) {
    let name = UTF8ToString(namePtr);
    let parentHandle = FSAccessHandles.get(parent);
    
    let childType = 2; // DirectoryKind
    let childID = -1;
    
    try {
      let dirHandle = await parentHandle.getDirectoryHandle(name);
      childID = FSAccessHandles.allocate(dirHandle);
    } catch (e) {
      if (e.name === 'TypeMismatchError') {
        try {
          let fileHandle = await parentHandle.getFileHandle(name);
          childType = 1; // DataFileKind
          childID = FSAccessHandles.allocate(fileHandle);
        } catch (e2) {
          // Doesn't exist at all
          childID = -{{{ cDefs.ENOENT }}};
        }
      } else if (e.name === 'NotFoundError') {
        // Doesn't exist
        childID = -{{{ cDefs.ENOENT }}};
      } else {
        // Other error
        childID = -{{{ cDefs.EIO }}};
      }
    }
    
    {{{ makeSetValue('childTypePtr', 0, 'childType', 'i32') }}};
    {{{ makeSetValue('childIDPtr', 0, 'childID', 'i32') }}};
    
    _emscripten_proxy_finish(ctx);
  }
});