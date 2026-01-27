(module
  (import "wasi_snapshot_preview1" "fd_read" (func $fd_read (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
  (memory 2)
  (export "memory" (memory 0))

  ;; layout:
  ;; 0..7 iovec
  ;; 8..11 nread/nwritten
  ;; 64.. decimal output buffer
  ;; 1024.. read buffer

  (func $utoa (param $n i32) (param $out i32) (result i32)
    (local $i i32)
    (local $j i32)
    (local $q i32)
    (local $r i32)
    (local $tmp i32)

    (if (i32.eq (local.get $n) (i32.const 0))
      (then
        (i32.store8 (local.get $out) (i32.const 48))
        (return (i32.const 1))
      )
    )

    (local.set $i (i32.const 0))
    (block $done
      (loop $loop
        (br_if $done (i32.eqz (local.get $n)))
        (local.set $q (i32.div_u (local.get $n) (i32.const 10)))
        (local.set $r (i32.rem_u (local.get $n) (i32.const 10)))
        (i32.store8 (i32.add (local.get $out) (local.get $i)) (i32.add (local.get $r) (i32.const 48)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (local.set $n (local.get $q))
        (br $loop)
      )
    )

    ;; reverse digits in-place
    (local.set $j (i32.const 0))
    (block $revDone
      (loop $rev
        (br_if $revDone (i32.ge_u (local.get $j) (i32.div_u (local.get $i) (i32.const 2))))
        (local.set $tmp (i32.load8_u (i32.add (local.get $out) (local.get $j))))
        (i32.store8
          (i32.add (local.get $out) (local.get $j))
          (i32.load8_u (i32.add (local.get $out) (i32.sub (i32.sub (local.get $i) (i32.const 1)) (local.get $j))))
        )
        (i32.store8
          (i32.add (local.get $out) (i32.sub (i32.sub (local.get $i) (i32.const 1)) (local.get $j)))
          (local.get $tmp)
        )
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $rev)
      )
    )

    (local.get $i)
  )

  (func (export "_start")
    (local $bytes i32)
    (local $lines i32)
    (local $n i32)
    (local $i i32)
    (local $outLen i32)

    (local.set $bytes (i32.const 0))
    (local.set $lines (i32.const 0))

    (block $done
      (loop $read
        (i32.store (i32.const 0) (i32.const 1024))
        (i32.store (i32.const 4) (i32.const 4096))
        (call $fd_read (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 8))
        drop
        (local.set $n (i32.load (i32.const 8)))
        (br_if $done (i32.eqz (local.get $n)))
        (local.set $bytes (i32.add (local.get $bytes) (local.get $n)))

        (local.set $i (i32.const 0))
        (block $scanDone
          (loop $scan
            (br_if $scanDone (i32.ge_u (local.get $i) (local.get $n)))
            (if (i32.eq (i32.load8_u (i32.add (i32.const 1024) (local.get $i))) (i32.const 10))
              (then (local.set $lines (i32.add (local.get $lines) (i32.const 1))))
            )
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $scan)
          )
        )

        (br $read)
      )
    )

    ;; write: "<lines> <bytes>\n"
    (local.set $outLen (call $utoa (local.get $lines) (i32.const 64)))
    (i32.store8 (i32.add (i32.const 64) (local.get $outLen)) (i32.const 32)) ;; space
    (local.set $outLen (i32.add (local.get $outLen) (i32.const 1)))
    (local.set $outLen (i32.add (local.get $outLen) (call $utoa (local.get $bytes) (i32.add (i32.const 64) (local.get $outLen)))))
    (i32.store8 (i32.add (i32.const 64) (local.get $outLen)) (i32.const 10)) ;; newline
    (local.set $outLen (i32.add (local.get $outLen) (i32.const 1)))

    (i32.store (i32.const 0) (i32.const 64))
    (i32.store (i32.const 4) (local.get $outLen))
    (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 8))
    drop

    (call $proc_exit (i32.const 0))
  )
)

