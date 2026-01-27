export type KeydownLike = {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
};

export function shouldSubmitOnKeydown(e: KeydownLike): boolean {
  if (e.key !== "Enter") return false;
  if (e.shiftKey) return false;
  if (e.isComposing) return false;
  return true;
}

