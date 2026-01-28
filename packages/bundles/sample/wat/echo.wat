(module
  (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 1)
  (export "memory" (memory 0))

  (data (i32.const 64) " ")
  (data (i32.const 68) "\n")

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
    (local $i i32)
    (local $p i32)
    (local $len i32)

    ;; argv ptrs at 0, strings at 256
    (call $args_sizes_get (i32.const 200) (i32.const 204))
    drop
    (call $args_get (i32.const 0) (i32.const 256))
    drop
    (local.set $argc (i32.load (i32.const 200)))

    ;; echo argv[1..] joined by spaces, then newline
    (local.set $i (i32.const 1))
    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $argc)))
        (local.set $p (i32.load (i32.mul (local.get $i) (i32.const 4))))
        (local.set $len (call $strlen (local.get $p)))

        ;; iovec[0] = arg
        (i32.store (i32.const 0) (local.get $p))
        (i32.store (i32.const 4) (local.get $len))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 16))
        drop

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $done (i32.ge_u (local.get $i) (local.get $argc)))

        ;; write space between args
        (i32.store (i32.const 0) (i32.const 64))
        (i32.store (i32.const 4) (i32.const 1))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 16))
        drop

        (br $loop)
      )
    )

    ;; newline
    (i32.store (i32.const 0) (i32.const 68))
    (i32.store (i32.const 4) (i32.const 1))
    (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 16))
    drop
    (call $proc_exit (i32.const 0))
  )
)
