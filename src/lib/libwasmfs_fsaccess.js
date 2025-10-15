addToLibrary({
  $FSAccessHandles__deps: ['$HandleAllocator'],
  $FSAccessHandles: "new HandleAllocator()",

  _fsaccess_show_directory_picker__deps: ['$FSAccessHandles', 'emscripten_proxy_finish'],
  _fsaccess_show_directory_picker__async: true,
  _fsaccess_show_directory_picker: async function(ctx) {
    if (FSAccessHandles.allocated.length == 1) {  // Only show picker if not already picked
      try {
        const dirHandle = await window.showDirectoryPicker();
        FSAccessHandles.allocated.push(dirHandle);  // Stores at index 1
      } catch (e) {
        console.log('Picker cancelled');
      }
    }
    _emscripten_proxy_finish(ctx);
  }
});