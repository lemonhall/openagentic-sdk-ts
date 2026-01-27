(module
  (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "path_open" (func $path_open (param i32 i32 i32 i32 i32 i64 i64 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_close" (func $fd_close (param i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 4)
  (export "memory" (memory 0))

  ;; layout:
  ;; 0..255 argv ptrs
  ;; 256..1023 argv strings
  ;; 1024..1031 iovec
  ;; 1032..1035 nread/nwritten
  ;; 1040 srcfd
  ;; 1044 dstfd
  ;; 4096.. buffer

  (func $strlen (param $p i32) (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        (br_if $break (i32.eqz (i32.load8_u (i32.add (local.get $p) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (local.get $i)
  )

  (func (export "_start")
    (local $argc i32)
    (local $src i32)
    (local $dst i32)
    (local $srcLen i32)
    (local $dstLen i32)
    (local $n i32)

    (call $args_sizes_get (i32.const 900) (i32.const 904))
    drop
    (call $args_get (i32.const 0) (i32.const 256))
    drop
    (local.set $argc (i32.load (i32.const 900)))
    (if (i32.lt_u (local.get $argc) (i32.const 3)) (then (call $proc_exit (i32.const 1))))

    (local.set $src (i32.load (i32.const 4)))  ;; argv[1]
    (local.set $dst (i32.load (i32.const 8)))  ;; argv[2]
    (local.set $srcLen (call $strlen (local.get $src)))
    (local.set $dstLen (call $strlen (local.get $dst)))

    ;; open src (fd out at 1040)
    (call $path_open
      (i32.const 3) (i32.const 0)
      (local.get $src) (local.get $srcLen)
      (i32.const 0)
      (i64.const -1) (i64.const -1)
      (i32.const 0)
      (i32.const 1040)
    )
    drop

    ;; open dst create+trunc (fd out at 1044)
    (call $path_open
      (i32.const 3) (i32.const 0)
      (local.get $dst) (local.get $dstLen)
      (i32.const 9)
      (i64.const -1) (i64.const -1)
      (i32.const 0)
      (i32.const 1044)
    )
    drop

    (block $done
      (loop $loop
        ;; read up to 4096 bytes
        (i32.store (i32.const 1024) (i32.const 4096))
        (i32.store (i32.const 1028) (i32.const 4096))
        (call $fd_read (i32.load (i32.const 1040)) (i32.const 1024) (i32.const 1) (i32.const 1032))
        drop
        (local.set $n (i32.load (i32.const 1032)))
        (br_if $done (i32.eqz (local.get $n)))

        ;; write n bytes
        (i32.store (i32.const 1024) (i32.const 4096))
        (i32.store (i32.const 1028) (local.get $n))
        (call $fd_write (i32.load (i32.const 1044)) (i32.const 1024) (i32.const 1) (i32.const 1032))
        drop
        (br $loop)
      )
    )

    (call $fd_close (i32.load (i32.const 1040))) drop
    (call $fd_close (i32.load (i32.const 1044))) drop
    (call $proc_exit (i32.const 0))
  )
)

