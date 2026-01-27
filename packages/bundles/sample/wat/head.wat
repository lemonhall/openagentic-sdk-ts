(module
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

  ;; stdin-only: first 10 lines
  ;; layout:
  ;; 0..7 iovec
  ;; 8..11 nread/nwritten
  ;; 1024.. read buffer

  (func (export "_start")
    (local $lines i32)
    (local $n i32)
    (local $i i32)
    (local $outLen i32)

    (local.set $lines (i32.const 0))
    (block $done
      (loop $read
        (i32.store (i32.const 0) (i32.const 1024))
        (i32.store (i32.const 4) (i32.const 4096))
        (call $fd_read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 8))
        drop
        (local.set $n (i32.load (i32.const 8)))
        (br_if $done (i32.eqz (local.get $n)))

        (local.set $i (i32.const 0))
        (local.set $outLen (local.get $n))
        (block $scanDone
          (loop $scan
            (br_if $scanDone (i32.ge_u (local.get $i) (local.get $n)))
            (if (i32.eq (i32.load8_u (i32.add (i32.const 1024) (local.get $i))) (i32.const 10))
              (then
                (local.set $lines (i32.add (local.get $lines) (i32.const 1)))
                (if (i32.ge_u (local.get $lines) (i32.const 10))
                  (then
                    (local.set $outLen (i32.add (local.get $i) (i32.const 1)))
                    (br $scanDone)
                  )
                )
              )
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
        )

        ;; write outLen bytes
        (i32.store (i32.const 0) (i32.const 1024))
        (i32.store (i32.const 4) (local.get $outLen))
        (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8))
        drop

        (br_if $done (i32.ge_u (local.get $lines) (i32.const 10)))
        (br $read)
      )
    )

    (call $proc_exit (i32.const 0))
  )
)

