import { describe, expect, it, vi } from "vite-plus/test";

const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
  readFileSync: mockReadFileSync,
}));

const { readPackageVersion } = await import("../../src/utils/read-package-version.js");

describe("readPackageVersion", () => {
  it("extracts the version string from package.json", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: "0.0.15" }));

    const version = readPackageVersion();
    expect(version).toBe("0.0.15");
  });

  it("throws when version is missing", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}));

    expect(() => readPackageVersion()).toThrow("version is missing or empty");
  });

  it("throws when version is an empty string", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: "" }));

    expect(() => readPackageVersion()).toThrow("version is missing or empty");
  });

  it("throws when version is not a string", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 42 }));

    expect(() => readPackageVersion()).toThrow("version is missing or empty");
  });
});
