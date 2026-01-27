(module
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

  ;; layout:
  ;; 0..7: iovec for read/write {ptr,len}
  ;; 16..19: nread / nwritten
  ;; 1024..: buffer

  (func (export "_start") (local $n i32)
    (block $done
      (loop $read
        ;; iovec = { buf=1024, len=4096 }
        (i32.store (i32.const 0) (i32.const 1024))
        (i32.store (i32.const 4) (i32.const 4096))
        (call $fd_read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 16))
        drop
        (local.set $n (i32.load (i32.const 16)))
        (br_if $done (i32.eqz (local.get $n)))

        ;; write exactly n bytes from buffer
        (i32.store (i32.const 0) (i32.const 1024))
        (i32.store (i32.const 4) (local.get $n))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 16))
        drop
        (br $read)
      )
    )
    (call $proc_exit (i32.const 0))
  )
)
