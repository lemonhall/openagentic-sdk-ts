(module
  (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "path_rename" (func $path_rename (param i32 i32 i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

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
    (if (i32.ne (call $path_rename (i32.const 3) (local.get $src) (local.get $srcLen) (i32.const 3) (local.get $dst) (local.get $dstLen)) (i32.const 0))
      (then (call $proc_exit (i32.const 1)))
    )
    (call $proc_exit (i32.const 0))
  )
)

