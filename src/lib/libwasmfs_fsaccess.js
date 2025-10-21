addToLibrary({
  $FSAccessHandles__deps: ['$HandleAllocator'],
  $FSAccessHandles: "new HandleAllocator()",

  _wasmfs_fsaccess_show_directory_picker__deps: ['$FSAccessHandles', 'emscripten_proxy_finish'],
  // For JSPI or Asyncify:
  // Emscripten generates wrapper code that handles the async/await properly, 
  // allowing C++ code to call this async JS function and wait for it to complete 
  // before continuing
  // Not useful in our case since we forego this by calling in pthread
  // Maybe useful in future to work around the main browser thread running issue
  // _wasmfs_fsaccess_show_directory_picker__async: false,
  _wasmfs_fsaccess_show_directory_picker: async function(ctx, resultPtr) {
    if (FSAccessHandles.allocated.length == 1) { 
      try {
        const dirHandle = await window.showDirectoryPicker();
        FSAccessHandles.allocated.push(dirHandle);
        {{{ makeSetValue('resultPtr', 0, 1, 'i32') }}}; 
      } catch (e) {
        console.log('Picker cancelled or failed:', e);
        {{{ makeSetValue('resultPtr', 0, 0, 'i32') }}};
      }
    }
    _emscripten_proxy_finish(ctx);
  }
});