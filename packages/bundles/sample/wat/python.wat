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

  (func $is_ws (param $b i32) (result i32)
    (if (result i32)
      (i32.or
        (i32.eq (local.get $b) (i32.const 32))  ;; space
        (i32.or
          (i32.eq (local.get $b) (i32.const 9))   ;; \t
          (i32.or
            (i32.eq (local.get $b) (i32.const 10)) ;; \n
            (i32.eq (local.get $b) (i32.const 13)) ;; \r
          )
        )
      )
      (then (i32.const 1))
      (else (i32.const 0))
    )
  )

  (func $skip_ws (param $p i32) (result i32)
    (local $b i32)
    (block $break
      (loop $loop
        (local.set $b (i32.load8_u (local.get $p)))
        (br_if $break (i32.eqz (call $is_ws (local.get $b))))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $loop)
      )
    )
    (local.get $p)
  )

  (func $is_digit (param $b i32) (result i32)
    (i32.and
      (i32.ge_u (local.get $b) (i32.const 48))
      (i32.le_u (local.get $b) (i32.const 57))
    )
  )

  ;; parse unsigned int at p; writes updated pointer to *out_p; returns value
  (func $parse_u32 (param $p i32) (param $out_p i32) (result i32)
    (local $b i32)
    (local $v i32)
    (local.set $v (i32.const 0))
    (block $break
      (loop $loop
        (local.set $b (i32.load8_u (local.get $p)))
        (br_if $break (i32.eqz (call $is_digit (local.get $b))))
        (local.set $v (i32.add (i32.mul (local.get $v) (i32.const 10)) (i32.sub (local.get $b) (i32.const 48))))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $loop)
      )
    )
    (i32.store (local.get $out_p) (local.get $p))
    (local.get $v)
  )

  ;; itoa for non-negative i32; writes ptr/len to out_ptr/out_len
  (func $itoa (param $v i32) (param $out_ptr i32) (param $out_len i32)
    (local $p i32)
    (local $n i32)
    (local $digit i32)
    ;; write backwards starting at 1800
    (local.set $p (i32.const 1800))
    (local.set $n (local.get $v))
    (if (i32.eqz (local.get $n))
      (then
        (i32.store8 (i32.sub (local.get $p) (i32.const 1)) (i32.const 48))
        (i32.store (local.get $out_ptr) (i32.sub (local.get $p) (i32.const 1)))
        (i32.store (local.get $out_len) (i32.const 1))
        (return)
      )
    )
    (block $done
      (loop $loop
        (br_if $done (i32.eqz (local.get $n)))
        (local.set $digit (i32.rem_u (local.get $n) (i32.const 10)))
        (local.set $p (i32.sub (local.get $p) (i32.const 1)))
        (i32.store8 (local.get $p) (i32.add (i32.const 48) (local.get $digit)))
        (local.set $n (i32.div_u (local.get $n) (i32.const 10)))
        (br $loop)
      )
    )
    (i32.store (local.get $out_ptr) (local.get $p))
    (i32.store (local.get $out_len) (i32.sub (i32.const 1800) (local.get $p)))
  )

  ;; Minimal "python -c" runtime for agent demos:
  ;; - supports: python -c "print(<int expr>)"
  ;; - expr supports: digits, + - * /, whitespace
  (func (export "_start")
    (local $argc i32)
    (local $flag i32)
    (local $code i32)
    (local $p i32)
    (local $b i32)
    (local $tmp i32)
    (local $val i32)
    (local $rhs i32)
    (local $op i32)
    (local $out_ptr i32)
    (local $out_len i32)

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

    ;; parse: print ( expr )
    (local.set $p (call $skip_ws (local.get $code)))

    ;; require "print"
    (if (i32.ne (i32.load8_u (local.get $p)) (i32.const 112)) (then (call $proc_exit (i32.const 2)))) ;; p
    (if (i32.ne (i32.load8_u (i32.add (local.get $p) (i32.const 1))) (i32.const 114)) (then (call $proc_exit (i32.const 2)))) ;; r
    (if (i32.ne (i32.load8_u (i32.add (local.get $p) (i32.const 2))) (i32.const 105)) (then (call $proc_exit (i32.const 2)))) ;; i
    (if (i32.ne (i32.load8_u (i32.add (local.get $p) (i32.const 3))) (i32.const 110)) (then (call $proc_exit (i32.const 2)))) ;; n
    (if (i32.ne (i32.load8_u (i32.add (local.get $p) (i32.const 4))) (i32.const 116)) (then (call $proc_exit (i32.const 2)))) ;; t
    (local.set $p (i32.add (local.get $p) (i32.const 5)))
    (local.set $p (call $skip_ws (local.get $p)))
    (if (i32.ne (i32.load8_u (local.get $p)) (i32.const 40)) (then (call $proc_exit (i32.const 2)))) ;; '('
    (local.set $p (i32.add (local.get $p) (i32.const 1)))
    (local.set $p (call $skip_ws (local.get $p)))

    ;; parse first int
    (local.set $tmp (i32.const 920))
    (local.set $val (call $parse_u32 (local.get $p) (local.get $tmp)))
    (local.set $p (i32.load (local.get $tmp)))
    (local.set $p (call $skip_ws (local.get $p)))

    (block $expr_done
      (loop $expr_loop
        (local.set $b (i32.load8_u (local.get $p)))
        (br_if $expr_done (i32.eq (local.get $b) (i32.const 41))) ;; ')'
        (local.set $op (local.get $b))
        ;; require operator
        (if
          (i32.and
            (i32.ne (local.get $op) (i32.const 43))  ;; '+'
            (i32.and
              (i32.ne (local.get $op) (i32.const 45)) ;; '-'
              (i32.and
                (i32.ne (local.get $op) (i32.const 42)) ;; '*'
                (i32.ne (local.get $op) (i32.const 47)) ;; '/'
              )
            )
          )
          (then (call $proc_exit (i32.const 2)))
        )
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $p (call $skip_ws (local.get $p)))

        (local.set $rhs (call $parse_u32 (local.get $p) (local.get $tmp)))
        (local.set $p (i32.load (local.get $tmp)))
        (local.set $p (call $skip_ws (local.get $p)))

        (if (i32.eq (local.get $op) (i32.const 43)) (then (local.set $val (i32.add (local.get $val) (local.get $rhs)))))
        (if (i32.eq (local.get $op) (i32.const 45)) (then (local.set $val (i32.sub (local.get $val) (local.get $rhs)))))
        (if (i32.eq (local.get $op) (i32.const 42)) (then (local.set $val (i32.mul (local.get $val) (local.get $rhs)))))
        (if (i32.eq (local.get $op) (i32.const 47)) (then (local.set $val (i32.div_u (local.get $val) (local.get $rhs)))))

        (br $expr_loop)
      )
    )

    ;; require ')'
    (if (i32.ne (i32.load8_u (local.get $p)) (i32.const 41)) (then (call $proc_exit (i32.const 2))))

    ;; write result + newline
    (local.set $out_ptr (i32.const 940))
    (local.set $out_len (i32.const 944))
    (call $itoa (local.get $val) (local.get $out_ptr) (local.get $out_len))

    ;; iovec[0] = digits
    (i32.store (i32.const 32) (i32.load (local.get $out_ptr)))
    (i32.store (i32.const 36) (i32.load (local.get $out_len)))
    ;; iovec[1] = "\\n"
    (i32.store (i32.const 40) (i32.const 1024))
    (i32.store (i32.const 44) (i32.const 1))

    (call $fd_write (i32.const 1) (i32.const 32) (i32.const 2) (i32.const 120))
    drop
    (call $proc_exit (i32.const 0))
  )
)
