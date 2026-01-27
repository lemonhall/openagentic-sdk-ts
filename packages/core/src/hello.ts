export type Hello = {
  text: string;
};

export function hello(): Hello {
  return { text: "hello world" };
}
