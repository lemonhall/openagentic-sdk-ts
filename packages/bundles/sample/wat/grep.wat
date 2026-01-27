(module
  (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 4)
  (export "memory" (memory 0))

  ;; memory layout:
  ;; 0..255: argv pointers (up to 64 args)
  ;; 256..1023: argv strings buffer
  ;; 1024..1031: iovec scratch
  ;; 1032..1035: nread / nwritten
  ;; 4096..: stdin buffer (max ~120k)

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

  (func $contains (param $hay i32) (param $hayLen i32) (param $needle i32) (param $needleLen i32) (result i32)
    (local $i i32)
    (local $j i32)
    (if (i32.eqz (local.get $needleLen)) (then (return (i32.const 1))))
    (local.set $i (i32.const 0))
    (block $no
      (loop $outer
        (br_if $no (i32.gt_u (local.get $i) (i32.sub (local.get $hayLen) (local.get $needleLen))))
        (local.set $j (i32.const 0))
        (block $mismatch
          (loop $inner
            (br_if $mismatch (i32.eq (local.get $j) (local.get $needleLen)))
            (br_if $mismatch
              (i32.ne
                (i32.load8_u (i32.add (local.get $hay) (i32.add (local.get $i) (local.get $j))))
                (i32.load8_u (i32.add (local.get $needle) (local.get $j)))
              )
            )
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $inner)
          )
        )
        ;; if we reached needleLen, match
        (if (i32.eq (local.get $j) (local.get $needleLen)) (then (return (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $outer)
      )
    )
    (i32.const 0)
  )

  (func (export "_start")
    (local $argc i32)
    (local $patternPtr i32)
    (local $patternLen i32)
    (local $stdinLen i32)
    (local $n i32)
    (local $i i32)
    (local $lineStart i32)
    (local $lineLen i32)

    ;; argv
    (call $args_sizes_get (i32.const 900) (i32.const 904))
    drop
    (call $args_get (i32.const 0) (i32.const 256))
    drop

    (local.set $argc (i32.load (i32.const 900)))
    (if (i32.lt_u (local.get $argc) (i32.const 2))
      (then
        ;; no pattern argument: print nothing, exit 0
        (call $proc_exit (i32.const 0))
      )
    )

    (local.set $patternPtr (i32.load (i32.const 4))) ;; argv[1]
    (local.set $patternLen (call $strlen (local.get $patternPtr)))

    ;; read stdin into 4096.. (append)
    (local.set $stdinLen (i32.const 0))
    (block $doneRead
      (loop $read
        (i32.store (i32.const 1024) (i32.add (i32.const 4096) (local.get $stdinLen)))
        (i32.store (i32.const 1028) (i32.const 4096))
        (call $fd_read (i32.const 0) (i32.const 1024) (i32.const 1) (i32.const 1032))
        drop
        (local.set $n (i32.load (i32.const 1032)))
        (br_if $doneRead (i32.eqz (local.get $n)))
        (local.set $stdinLen (i32.add (local.get $stdinLen) (local.get $n)))
        (br $read)
      )
    )

    ;; process lines
    (local.set $i (i32.const 0))
    (local.set $lineStart (i32.const 0))
    (block $finish
      (loop $scan
        (br_if $finish (i32.gt_u (local.get $i) (local.get $stdinLen)))

        ;; when i == stdinLen, flush last line (no newline)
        (if (i32.eq (local.get $i) (local.get $stdinLen))
          (then
            (local.set $lineLen (i32.sub (local.get $i) (local.get $lineStart)))
            (if (i32.gt_u (local.get $lineLen) (i32.const 0))
              (then
                (if (call $contains
                      (i32.add (i32.const 4096) (local.get $lineStart))
                      (local.get $lineLen)
                      (local.get $patternPtr)
                      (local.get $patternLen)
                    )
                  (then
                    (i32.store (i32.const 1024) (i32.add (i32.const 4096) (local.get $lineStart)))
                    (i32.store (i32.const 1028) (local.get $lineLen))
                    (call $fd_write (i32.const 1) (i32.const 1024) (i32.const 1) (i32.const 1032))
                    drop
                  )
                )
              )
            )
            (br $finish)
          )
        )

        ;; newline?
        (if (i32.eq (i32.load8_u (i32.add (i32.const 4096) (local.get $i))) (i32.const 10))
          (then
            (local.set $lineLen (i32.add (i32.sub (local.get $i) (local.get $lineStart)) (i32.const 1))) ;; include newline
            (if (call $contains
                  (i32.add (i32.const 4096) (local.get $lineStart))
                  (local.get $lineLen)
                  (local.get $patternPtr)
                  (local.get $patternLen)
                )
              (then
                (i32.store (i32.const 1024) (i32.add (i32.const 4096) (local.get $lineStart)))
                (i32.store (i32.const 1028) (local.get $lineLen))
                (call $fd_write (i32.const 1) (i32.const 1024) (i32.const 1) (i32.const 1032))
                drop
              )
            )
            (local.set $lineStart (i32.add (local.get $i) (i32.const 1)))
          )
        )

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)
      )
    )

    (call $proc_exit (i32.const 0))
  )
)
