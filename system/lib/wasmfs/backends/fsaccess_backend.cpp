// fsaccess_backend.cpp
#include "backend.h"
#include "file.h"
#include "wasmfs.h"
#include <emscripten/threading.h>
#include <emscripten/proxying.h>

extern "C" {
  void _wasmfs_fsaccess_show_directory_picker(em_proxying_ctx* ctx, int* resultPtr);
  void _wasmfs_fsaccess_get_entries(em_proxying_ctx* ctx, int dirID, std::vector<wasmfs::Directory::Entry>* entriesPtr, int* errPtr);
  void _wasmfs_fsaccess_get_child(em_proxying_ctx* ctx, int parent, const char* name, int* childTypePtr, int* childIDPtr);
}

namespace wasmfs {

class MainThreadProxy {
  emscripten::ProxyingQueue queue;
  static inline pthread_t mainThread = emscripten_main_runtime_thread_id();

public:
  MainThreadProxy() = default;

  template<typename Func>
  void operator()(Func&& func) {
    if (emscripten_is_main_runtime_thread()) {
      emscripten_console_error("Error: FSAccess backend operations must be called from a pthread, not main thread");
      return;
    }
    queue.proxySyncWithCtx(mainThread, std::forward<Func>(func));
  }       
};

class FSAccessFile : public DataFile {
  [[maybe_unused]] int fileID;
  [[maybe_unused]] MainThreadProxy& proxy;

protected:
  int open(oflags_t flags) override {
    return 0;
  }
  
  int close() override {
    return 0;
  }
  
  ssize_t read(uint8_t* buf, size_t len, off_t offset) override {
    return 0;
  }
  
  ssize_t write(const uint8_t* buf, size_t len, off_t offset) override {
    return 0;
  }
  
  int setSize(off_t size) override {
    return 0;
  }
  
  int flush() override {
    return 0;
  }
  
  off_t getSize() override {
    return 0;
  }

public:
  FSAccessFile(mode_t mode, backend_t backend, int fileID, MainThreadProxy& proxy)
    : DataFile(mode, backend), fileID(fileID), proxy(proxy) {}
};

class FSAccessDirectory : public Directory {
  [[maybe_unused]] int dirID;
  [[maybe_unused]] MainThreadProxy& proxy;

protected:
  std::shared_ptr<File> getChild(const std::string& name) override {
    int childType = 0;
    int childID = 0;
    proxy([&](auto ctx) {
      _wasmfs_fsaccess_get_child(ctx.ctx, dirID, name.c_str(), &childType, &childID);
    });
    if (childID < 0) {
      // Error or not found
      return nullptr;
    }
    // Create appropriate file type based on childType
    if (childType == File::DataFileKind) {
      return std::make_shared<FSAccessFile>(0777, getBackend(), childID, proxy);
    } else if (childType == File::DirectoryKind) {
      return std::make_shared<FSAccessDirectory>(0777, getBackend(), childID, proxy);
    }
    
    return nullptr;
  }
  
  std::shared_ptr<DataFile> insertDataFile(const std::string& name, mode_t mode) override {
    return nullptr;
  }
  
  std::shared_ptr<Directory> insertDirectory(const std::string& name, mode_t mode) override {
    return nullptr;
  }
  
  std::shared_ptr<Symlink> insertSymlink(const std::string& name, const std::string& target) override {
    return nullptr;
  }
  
  int insertMove(const std::string& name, std::shared_ptr<File> file) override {
    return -1;
  }
  
  int removeChild(const std::string& name) override {
    return -1;
  }
  
  ssize_t getNumEntries() override {
    auto entries = getEntries();
    if (int err = entries.getError()) {
      return err;
    }
    return entries->size();
  }
  
  Directory::MaybeEntries getEntries() override {
    std::vector<Directory::Entry> entries;
    int err = 0;
    proxy([&](auto ctx) {
      _wasmfs_fsaccess_get_entries(ctx.ctx, dirID, &entries, &err);
    });
    if (err) {
      return {err};
    }
    return {entries};
  }

public:
  FSAccessDirectory(mode_t mode, backend_t backend, int dirID, MainThreadProxy& proxy)
    : Directory(mode, backend), dirID(dirID), proxy(proxy) {}
};

class FSAccessBackend : public Backend {
  MainThreadProxy proxy;

public:
  std::shared_ptr<DataFile> createFile(mode_t mode) override {
    return nullptr;
  }
  
  std::shared_ptr<Directory> createDirectory(mode_t mode) override {
    // Success = 0
    // Failure = 1
    int result = 0;
    proxy([&](auto ctx) { _wasmfs_fsaccess_show_directory_picker(ctx.ctx, &result); });
    if (result) {
      return nullptr;
    }
    return std::make_shared<FSAccessDirectory>(mode, this, 1, proxy);
  }
  
  std::shared_ptr<Symlink> createSymlink(std::string target) override {
    return nullptr;
  }
};

} // namespace wasmfs

extern "C" {
  wasmfs::backend_t wasmfs_create_fsaccess_backend() {
    return wasmfs::wasmFS.addBackend(std::make_unique<wasmfs::FSAccessBackend>());
  }

  void EMSCRIPTEN_KEEPALIVE _wasmfs_fsaccess_record_entry(
    std::vector<wasmfs::Directory::Entry>* entries, const char* name, int type
  ) {
    entries->push_back({name, wasmfs::File::FileKind(type), 0});
  }
}