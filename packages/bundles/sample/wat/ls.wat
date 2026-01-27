(module
  (import "wasi_snapshot_preview1" "fd_readdir" (func $fd_readdir (param i32 i32 i32 i64 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

  ;; memory layout:
  ;; 0..7: iovec scratch
  ;; 8..11: bufused
  ;; 64: "\n"
  ;; 1024..: readdir buffer

  (data (i32.const 64) "\n")

  (func (export "_start")
    (local $used i32)
    (local $off i32)
    (local $end i32)
    (local $namelen i32)

    ;; read directory entries from preopen fd=3
    (call $fd_readdir (i32.const 3) (i32.const 1024) (i32.const 4096) (i64.const 0) (i32.const 8))
    drop
    (local.set $used (i32.load (i32.const 8)))
    (local.set $off (i32.const 1024))
    (local.set $end (i32.add (i32.const 1024) (local.get $used)))

    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $off) (local.get $end)))

        ;; d_namlen at +16, name bytes at +24
        (local.set $namelen (i32.load (i32.add (local.get $off) (i32.const 16))))

        ;; write name
        (i32.store (i32.const 0) (i32.add (local.get $off) (i32.const 24)))
        (i32.store (i32.const 4) (local.get $namelen))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
        drop

        ;; write newline
        (i32.store (i32.const 0) (i32.const 64))
        (i32.store (i32.const 4) (i32.const 1))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
        drop

        ;; advance to next dirent (24 + namelen)
        (local.set $off (i32.add (local.get $off) (i32.add (i32.const 24) (local.get $namelen))))
        (br $loop)
      )
    )

    (call $proc_exit (i32.const 0))
  )
)

