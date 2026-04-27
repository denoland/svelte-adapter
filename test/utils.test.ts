import { expect } from "expect";
import { encodeAssetRelativePath } from "../src/index.ts";

Deno.test("Utils - encodeAssetRelativePath encodes path segments", () => {
  expect(encodeAssetRelativePath("foo bar/baz qux.txt")).toEqual(
    "foo%20bar/baz%20qux.txt",
  );
});

Deno.test("Utils - encodeAssetRelativePath normalizes Windows separators before URL-encoding", () => {
  expect(encodeAssetRelativePath("foo bar\\baz\\qux.txt")).toEqual(
    "foo%20bar/baz/qux.txt",
  );
  expect(encodeAssetRelativePath("a\\b\\c.txt")).toEqual("a/b/c.txt");
});
