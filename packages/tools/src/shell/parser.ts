export type WordToken = { kind: "word"; value: string; quote: "none" | "single" | "double" };
export type OpToken = { kind: "op"; value: "|" | "&&" | "||" | "<" | ">" | ">>" };
export type Token = WordToken | OpToken;

export type Redir = { kind: "in" | "out" | "append"; path: WordToken };

export type CommandNode = {
  argv: WordToken[];
  redirs: Redir[];
};

export type PipelineNode = {
  commands: CommandNode[];
};

export type SequenceNode = {
  head: PipelineNode;
  tail: { op: "&&" | "||"; pipeline: PipelineNode }[];
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
    if (value.length) out.push({ kind: "word", value, quote });
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // operators (longest first)
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

    // quoted word
    if (ch === "'" || ch === "\"") {
      const quote = ch;
      i++;
      let buf = "";
      while (i < s.length && s[i] !== quote) {
        buf += s[i];
        i++;
      }
      if (i >= s.length) throw new Error("Shell: unterminated quote");
      i++; // closing quote
      pushWord(buf, quote === "'" ? "single" : "double");
      continue;
    }

    // unquoted word
    let buf = "";
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") break;
      if (c === "'" || c === "\"") break;
      if (s.startsWith("&&", i) || s.startsWith("||", i) || s.startsWith(">>", i)) break;
      if (c === "|" || c === "<" || c === ">") break;
      buf += c;
      i++;
    }
    pushWord(buf, "none");
  }

  return out;
}

export function parse(script: string): SequenceNode {
  const toks = tokenize(script);
  let idx = 0;

  const peek = () => toks[idx];
  const take = () => toks[idx++];

  const parseCommand = (): CommandNode => {
    const argv: WordToken[] = [];
    const redirs: Redir[] = [];

    while (idx < toks.length) {
      const t = peek();
      if (t.kind === "op") break;
      argv.push(take() as WordToken);
    }
    if (argv.length === 0) throw new Error("Shell: expected command");

    while (idx < toks.length) {
      const t = peek();
      if (t.kind !== "op") break;
      if (t.value !== "<" && t.value !== ">" && t.value !== ">>") break;
      const op = take() as OpToken;
      const next = take() as Token | undefined;
      if (!next || next.kind !== "word") throw new Error("Shell: expected path after redirect");
      redirs.push({
        kind: op.value === "<" ? "in" : op.value === ">" ? "out" : "append",
        path: next as WordToken,
      });
    }

    return { argv, redirs };
  };

  const parsePipeline = (): PipelineNode => {
    const commands: CommandNode[] = [parseCommand()];
    while (idx < toks.length && isOp(peek(), "|")) {
      take();
      commands.push(parseCommand());
    }
    return { commands };
  };

  const head = parsePipeline();
  const tail: SequenceNode["tail"] = [];
  while (idx < toks.length) {
    const t = peek();
    if (!t || t.kind !== "op") throw new Error("Shell: unexpected token");
    if (t.value !== "&&" && t.value !== "||") throw new Error("Shell: unexpected token");
    take();
    tail.push({ op: t.value, pipeline: parsePipeline() });
  }

  return { head, tail };
}
