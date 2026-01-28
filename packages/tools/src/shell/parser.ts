export type WordToken = { kind: "word"; value: string; quote: "none" | "single" | "double" | "mixed" };
export type OpToken = { kind: "op"; value: "(" | ")" | "|" | "&&" | "||" | "<" | ">" | ">>" | "2>" | "2>>" | "2>&1" | "1>&2" | ";" };
export type Token = WordToken | OpToken;

export type Redir =
  | { kind: "in" | "out" | "append" | "err" | "errAppend"; path: WordToken }
  | { kind: "errToOut" | "outToErr" };

export type CommandNode = {
  argv: WordToken[];
  redirs: Redir[];
  subshell?: ScriptNode;
  assigns?: WordToken[];
};

export type PipelineNode = {
  commands: CommandNode[];
};

export type SequenceNode = {
  head: PipelineNode;
  tail: { op: "&&" | "||"; pipeline: PipelineNode }[];
};

export type ScriptNode = {
  sequences: SequenceNode[];
};

function isOp(tok: Token | undefined, v: OpToken["value"]): tok is OpToken {
  if (!tok) return false;
  return tok.kind === "op" && tok.value === v;
}

export function tokenize(script: string): Token[] {
  const s = String(script ?? "");
  const out: Token[] = [];

  let i = 0;
  const pushWord = (value: string, quote: WordToken["quote"]) => {
    if (value.length || quote !== "none") out.push({ kind: "word", value, quote });
  };

  const readSingleQuoted = (): string => {
    i++; // opening '
    let buf = "";
    while (i < s.length && s[i] !== "'") {
      buf += s[i];
      i++;
    }
    if (i >= s.length) throw new Error("Shell: unterminated quote");
    i++; // closing '
    return buf;
  };

  const readDoubleQuoted = (): string => {
    i++; // opening "
    let buf = "";
    while (i < s.length && s[i] !== "\"") {
      const c = s[i]!;
      if (c === "\\") {
        const next = s[i + 1];
        if (next === undefined) {
          buf += "\\";
          i++;
          continue;
        }
        if (next === "\n") {
          i += 2;
          continue;
        }
        // POSIX-ish: inside double quotes, backslash escapes only a small set.
        if (next === "\"" || next === "\\" || next === "$" || next === "`") {
          buf += next;
          i += 2;
          continue;
        }
        buf += `\\${next}`;
        i += 2;
        continue;
      }
      buf += c;
      i++;
    }
    if (i >= s.length) throw new Error("Shell: unterminated quote");
    i++; // closing "
    return buf;
  };

  const readWord = (): WordToken => {
    let buf = "";
    let hasUnquoted = false;
    let hasSingle = false;
    let hasDouble = false;

    const readCommandSubstitution = (): string => {
      const start = i;
      i += 2; // "$("
      let depth = 1;
      while (i < s.length && depth > 0) {
        const ch = s[i]!;

        if (ch === "'") {
          i++; // opening '
          while (i < s.length && s[i] !== "'") i++;
          if (i >= s.length) throw new Error("Shell: unterminated command substitution");
          i++; // closing '
          continue;
        }

        if (ch === "\"") {
          i++; // opening "
          while (i < s.length && s[i] !== "\"") {
            if (s[i] === "\\" && i + 1 < s.length) {
              i += 2;
              continue;
            }
            i++;
          }
          if (i >= s.length) throw new Error("Shell: unterminated command substitution");
          i++; // closing "
          continue;
        }

        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        i++;
      }
      if (depth !== 0) throw new Error("Shell: unterminated command substitution");
      return s.slice(start, i);
    };

    while (i < s.length) {
      const c = s[i]!;

      if (c === "$" && s[i + 1] === "(") {
        buf += readCommandSubstitution();
        hasUnquoted = true;
        continue;
      }

      if (c === " " || c === "\t" || c === "\r" || c === "\n") break;
      if (c === ";" || c === "(" || c === ")") break;
      if (s.startsWith("&&", i) || s.startsWith("||", i) || s.startsWith(">>", i)) break;
      if (c === "|" || c === "<" || c === ">") break;

      if (c === "'") {
        buf += readSingleQuoted();
        hasSingle = true;
        continue;
      }

      if (c === "\"") {
        buf += readDoubleQuoted();
        hasDouble = true;
        continue;
      }

      if (c === "\\") {
        const next = s[i + 1];
        if (next === undefined) {
          buf += "\\";
          hasUnquoted = true;
          i++;
          continue;
        }
        if (next === "\n") {
          i += 2;
          continue;
        }
        buf += next;
        hasUnquoted = true;
        i += 2;
        continue;
      }

      buf += c;
      hasUnquoted = true;
      i++;
    }

    const quote: WordToken["quote"] =
      hasSingle && !hasUnquoted && !hasDouble
        ? "single"
        : hasDouble && !hasUnquoted && !hasSingle
          ? "double"
          : !hasSingle && !hasDouble
            ? "none"
            : "mixed";
    return { kind: "word", value: buf, quote };
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      out.push({ kind: "op", value: ";" });
      i++;
      continue;
    }
    if (ch === ";") {
      out.push({ kind: "op", value: ";" });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      out.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "#") {
      // Comments start with an unquoted '#' token and run until newline.
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }

    // operators (longest first)
    if (s.startsWith("2>&1", i)) {
      out.push({ kind: "op", value: "2>&1" });
      i += 4;
      continue;
    }
    if (s.startsWith("1>&2", i)) {
      out.push({ kind: "op", value: "1>&2" });
      i += 4;
      continue;
    }
    if (s.startsWith("2>>", i)) {
      out.push({ kind: "op", value: "2>>" });
      i += 3;
      continue;
    }
    if (s.startsWith("2>", i)) {
      out.push({ kind: "op", value: "2>" });
      i += 2;
      continue;
    }
    if (s.startsWith("&&", i)) {
      out.push({ kind: "op", value: "&&" });
      i += 2;
      continue;
    }
    if (s.startsWith("||", i)) {
      out.push({ kind: "op", value: "||" });
      i += 2;
      continue;
    }
    if (s.startsWith(">>", i)) {
      out.push({ kind: "op", value: ">>" });
      i += 2;
      continue;
    }
    if (ch === "|" || ch === "<" || ch === ">") {
      out.push({ kind: "op", value: ch as "|" | "<" | ">" });
      i += 1;
      continue;
    }

    const w = readWord();
    pushWord(w.value, w.quote);
  }

  return out;
}

export function parseScript(script: string): ScriptNode {
  const toks = tokenize(script);
  let idx = 0;

  const peek = () => toks[idx];
  const take = () => toks[idx++];

  const parseScriptFromTokens = (stopAt?: ")" ): ScriptNode => {
    const parseRedirs = (redirs: Redir[]) => {
      while (idx < toks.length) {
        const t = peek();
        if (t.kind !== "op") break;
        if (t.value !== "<" && t.value !== ">" && t.value !== ">>" && t.value !== "2>" && t.value !== "2>>" && t.value !== "2>&1" && t.value !== "1>&2") break;
        const op = take() as OpToken;
        if (op.value === "2>&1") {
          redirs.push({ kind: "errToOut" });
          continue;
        }
        if (op.value === "1>&2") {
          redirs.push({ kind: "outToErr" });
          continue;
        }
        const next = take() as Token | undefined;
        if (!next || next.kind !== "word") throw new Error("Shell: expected path after redirect");
        redirs.push({
          kind:
            op.value === "<"
              ? "in"
              : op.value === ">"
                ? "out"
                : op.value === ">>"
                  ? "append"
                  : op.value === "2>"
                    ? "err"
                    : "errAppend",
          path: next as WordToken,
        });
      }
    };

    const parseCommand = (): CommandNode => {
      const assigns: WordToken[] = [];
      const argv: WordToken[] = [];
      const redirs: Redir[] = [];

      const isAssign = (w: WordToken): boolean => {
        const eq = w.value.indexOf("=");
        if (eq <= 0) return false;
        const name = w.value.slice(0, eq);
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
      };

      while (idx < toks.length) {
        const t = peek();
        if (!t || t.kind !== "word") break;
        if (!isAssign(t)) break;
        assigns.push(take() as WordToken);
      }

      if (isOp(peek(), "(")) {
        take(); // (
        const inner = parseScriptFromTokens(")");
        if (!isOp(peek(), ")")) throw new Error("Shell: expected ')'");
        take(); // )
        parseRedirs(redirs);
        return { argv, redirs, subshell: inner, assigns };
      }

      while (idx < toks.length) {
        const t = peek();
        if (t.kind === "op") break;
        argv.push(take() as WordToken);
      }
      if (argv.length === 0 && assigns.length === 0) throw new Error("Shell: expected command");

      parseRedirs(redirs);
      return { argv, redirs, assigns };
    };

    const parsePipeline = (): PipelineNode => {
      const commands: CommandNode[] = [parseCommand()];
      while (idx < toks.length && isOp(peek(), "|")) {
        take();
        commands.push(parseCommand());
      }
      return { commands };
    };

    const parseSequence = (): SequenceNode => {
      const head = parsePipeline();
      const tail: SequenceNode["tail"] = [];
      while (idx < toks.length) {
        if (stopAt && isOp(peek(), stopAt)) break;
        const t = peek();
        if (!t || t.kind !== "op") break;
        if (t.value !== "&&" && t.value !== "||") break;
        take();
        tail.push({ op: t.value, pipeline: parsePipeline() });
      }
      return { head, tail };
    };

    const sequences: SequenceNode[] = [];
    while (idx < toks.length) {
      if (stopAt && isOp(peek(), stopAt)) break;
      while (idx < toks.length && isOp(peek(), ";")) take();
      if (stopAt && isOp(peek(), stopAt)) break;
      if (idx >= toks.length) break;
      sequences.push(parseSequence());
      while (idx < toks.length && isOp(peek(), ";")) take();
    }

    if (sequences.length === 0) throw new Error("Shell: expected command");
    return { sequences };
  };

  const ast = parseScriptFromTokens();
  if (idx < toks.length) throw new Error("Shell: unexpected token");
  return ast;
}

export function parse(script: string): ScriptNode {
  return parseScript(script);
}
