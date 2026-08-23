import { expect } from "expect";
import path from "node:path";
import {
  encodeAssetRelativePath,
  isInsideProjectRoot,
  outputDirs,
} from "../src/index.ts";

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

Deno.test("Utils - isInsideProjectRoot rejects the project root and above", () => {
  for (const dir of ["", ".", "./", "..", "../..", "build/..", "/"]) {
    expect(isInsideProjectRoot(dir)).toBe(false);
  }
});

Deno.test("Utils - isInsideProjectRoot accepts directories under the root", () => {
  for (const dir of [".deno-deploy", "build", "dist/deno", "./build"]) {
    expect(isInsideProjectRoot(dir)).toBe(true);
  }
});

Deno.test("Utils - outputDirs never escapes to the filesystem root", () => {
  for (const out of ["", ".", "./", "build/.."]) {
    const dirs = outputDirs(out, "");
    expect(path.isAbsolute(dirs.static)).toBe(false);
    expect(path.isAbsolute(dirs.server)).toBe(false);
  }
});

Deno.test("Utils - outputDirs folds the base path into the static dir", () => {
  expect(outputDirs(".deno-deploy", "")).toEqual({
    static: path.join(".deno-deploy", "static"),
    server: path.join(".deno-deploy", "server"),
  });
  expect(outputDirs(".deno-deploy", "/myapp").static).toEqual(
    path.join(".deno-deploy", "static", "myapp"),
  );
});
