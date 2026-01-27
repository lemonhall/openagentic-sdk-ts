(module
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 4)
  (export "memory" (memory 0))

  ;; stdin-only: last 10 lines (reads all stdin up to ~120k)
  ;; layout:
  ;; 0..7 iovec
  ;; 8..11 nread/nwritten
  ;; 4096.. data

  (func (export "_start")
    (local $len i32)
    (local $n i32)
    (local $i i32)
    (local $lines i32)
    (local $start i32)

    (local.set $len (i32.const 0))
    (block $doneRead
      (loop $read
        (i32.store (i32.const 0) (i32.add (i32.const 4096) (local.get $len)))
        (i32.store (i32.const 4) (i32.const 4096))
        (call $fd_read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 8))
        drop
        (local.set $n (i32.load (i32.const 8)))
        (br_if $doneRead (i32.eqz (local.get $n)))
        (local.set $len (i32.add (local.get $len) (local.get $n)))
        (br $read)
      )
    )

    ;; find start index of last 10 lines by scanning backwards for newlines
    (local.set $lines (i32.const 0))
    (local.set $i (local.get $len))
    ;; If input ends with '\n', don't count the trailing terminator as an extra empty line.
    (if (i32.gt_u (local.get $len) (i32.const 0))
      (then
        (if (i32.eq (i32.load8_u (i32.add (i32.const 4096) (i32.sub (local.get $len) (i32.const 1)))) (i32.const 10))
          (then (local.set $i (i32.sub (local.get $len) (i32.const 1))))
        )
      )
    )
    (local.set $start (i32.const 0))
    (block $found
      (loop $back
        (br_if $found (i32.eqz (local.get $i)))
        (local.set $i (i32.sub (local.get $i) (i32.const 1)))
        (if (i32.eq (i32.load8_u (i32.add (i32.const 4096) (local.get $i))) (i32.const 10))
          (then
            (local.set $lines (i32.add (local.get $lines) (i32.const 1)))
            (if (i32.ge_u (local.get $lines) (i32.const 10))
              (then
                (local.set $start (i32.add (local.get $i) (i32.const 1)))
                (br $found)
              )
            )
          )
        )
        (br $back)
      )
    )

    ;; write from start..len
    (i32.store (i32.const 0) (i32.add (i32.const 4096) (local.get $start)))
    (i32.store (i32.const 4) (i32.sub (local.get $len) (local.get $start)))
    (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8))
    drop

    (call $proc_exit (i32.const 0))
  )
)
