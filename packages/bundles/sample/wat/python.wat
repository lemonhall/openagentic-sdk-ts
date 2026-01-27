(module
  (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

  (data (i32.const 1024) "\n")

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

  ;; Minimal placeholder "python" runtime for bundle plumbing tests:
  ;; - supports: python -c "<code>"
  ;; - behavior: prints <code> + newline
  (func (export "_start")
    (local $argc i32)
    (local $flag i32)
    (local $code i32)
    (local $len i32)

    (call $args_sizes_get (i32.const 900) (i32.const 904))
    drop
    (call $args_get (i32.const 0) (i32.const 256))
    drop

    (local.set $argc (i32.load (i32.const 900)))
    (if (i32.lt_u (local.get $argc) (i32.const 3)) (then (call $proc_exit (i32.const 1))))

    (local.set $flag (i32.load (i32.const 4))) ;; argv[1]
    ;; require "-c"
    (if (i32.ne (i32.load8_u (local.get $flag)) (i32.const 45)) (then (call $proc_exit (i32.const 2)))) ;; '-'
    (if (i32.ne (i32.load8_u (i32.add (local.get $flag) (i32.const 1))) (i32.const 99)) (then (call $proc_exit (i32.const 2)))) ;; 'c'

    (local.set $code (i32.load (i32.const 8))) ;; argv[2]
    (local.set $len (call $strlen (local.get $code)))

    ;; iovec[0] = code
    (i32.store (i32.const 32) (local.get $code))
    (i32.store (i32.const 36) (local.get $len))
    ;; iovec[1] = "\\n"
    (i32.store (i32.const 40) (i32.const 1024))
    (i32.store (i32.const 44) (i32.const 1))

    (call $fd_write (i32.const 1) (i32.const 32) (i32.const 2) (i32.const 120))
    drop
    (call $proc_exit (i32.const 0))
  )
)

