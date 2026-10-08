import { beforeEach, describe, expect, it, vi } from "vitest";

/* 直传只跟两个外部东西打交道：本项目的 `/syai/oss/*` 三个接口，和真在传文件的 ali-oss。
   两个都换成替身，测的就是「拿到凭证之后，把哪个键传到哪、返回哪个地址、失败了怎么办」——
   这几件事错了，作者那边看到的就是上传成功、市场里破图。 */
const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  ossStsToken: vi.fn(),
  ossUploadStart: vi.fn(),
  ossUploadSuccess: vi.fn(),
}));

vi.mock("ali-oss", () => ({
  default: class {
    put = mocks.put;
  },
}));
vi.mock("./syai", () => ({
  ossStsToken: mocks.ossStsToken,
  ossUploadStart: mocks.ossUploadStart,
  ossUploadSuccess: mocks.ossUploadSuccess,
}));

import { thumbnailKey, toCdnUrl, uploadThumbnailToOss, dataUrlBlob } from "./ossUpload";

/** 后端下发的凭证形状（见 lib/syai.ts 的 OssStsToken） */
const TOKEN = {
  accessKeyId: "STS.ak",
  accessKeySecret: "sk",
  securityToken: "token",
  region: "oss-cn-shenzhen",
  bucket: "syaii-dev",
  dirPrefix: "user/5/",
  endpoint: "https://syaii-dev.oss-cn-shenzhen.aliyuncs.com",
};
const OSS_URL = "https://syaii-dev.oss-cn-shenzhen.aliyuncs.com/user/5/market-thumbnail-1-abcd1234.png";
const CDN_URL = "https://aiimg.vxwebgame.com/user/5/market-thumbnail-1-abcd1234.png";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ossStsToken.mockResolvedValue(TOKEN);
  mocks.ossUploadStart.mockResolvedValue(7);
  mocks.ossUploadSuccess.mockResolvedValue(true);
  mocks.put.mockResolvedValue({ url: OSS_URL });
});

/* bucket 是私有读的：直接取 OSS 域名是 403 AccessDenied，只有 CDN 域名拿得到对象。
   直传回来的地址不过这一遍映射，市场上的卡片就是破图。 */
describe("the address a direct upload comes back with", () => {
  it("puts the CDN host in place of the OSS one", () => {
    expect(toCdnUrl(OSS_URL)).toBe(CDN_URL);
  });

  it("replaces every occurrence, not just the first", () => {
    expect(toCdnUrl(`${OSS_URL}?from=${OSS_URL}`)).toBe(`${CDN_URL}?from=${CDN_URL}`);
  });

  it("leaves an address that is already public alone", () => {
    expect(toCdnUrl(CDN_URL)).toBe(CDN_URL);
    expect(toCdnUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});

/* 键同时出现在请求路径和签名里，中文/空格/百分号一路编解码最容易对不上；
   而临时凭证的权限只覆盖后端下发的 `user/<uid>/` 前缀。 */
describe("the key a thumbnail is stored under", () => {
  it("stays inside the prefix the STS policy allows", () => {
    expect(thumbnailKey("user/5/", 1791361049743, "abcd1234")).toBe("user/5/market-thumbnail-1791361049743-abcd1234.png");
  });

  it("does not double the slash when the prefix already ends with one", () => {
    expect(thumbnailKey("user/5", 1, "r")).toBe("user/5/market-thumbnail-1-r.png");
    expect(thumbnailKey("/user/5/", 1, "r")).toBe("user/5/market-thumbnail-1-r.png");
  });

  it("falls back to a bare name when the backend sends no prefix", () => {
    expect(thumbnailKey(undefined, 1, "r")).toBe("market-thumbnail-1-r.png");
    expect(thumbnailKey("", 1, "r")).toBe("market-thumbnail-1-r.png");
  });

  it("is pure ASCII and always a PNG", () => {
    expect(thumbnailKey("user/5/", 1, "r")).toMatch(/^[\x20-\x7e]+\.png$/);
  });
});

describe("uploading a thumbnail", () => {
  const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  it("returns the CDN address, not the OSS one", async () => {
    expect(await uploadThumbnailToOss(blob())).toBe(CDN_URL);
  });

  it("stores it under the prefix the credentials came with", async () => {
    await uploadThumbnailToOss(blob());
    const key = mocks.put.mock.calls[0][0] as string;
    expect(key.startsWith("user/5/")).toBe(true);
    expect(key.endsWith(".png")).toBe(true);
  });

  it("tells the backend the CDN address, so the file library has a usable link", async () => {
    await uploadThumbnailToOss(blob());
    expect(mocks.ossUploadSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 7, fileUrl: CDN_URL }),
    );
  });

  it("registers the upload before sending it, with the size that was sent", async () => {
    await uploadThumbnailToOss(blob());
    expect(mocks.ossUploadStart).toHaveBeenCalledWith(expect.objectContaining({ fileSize: 3, fileType: "png" }));
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  /* 上传失败要抛出去：调用方（上传对话框）据此退回「data URL 交给后端转存」那条老路，
     而不是把一个不存在的地址写进市场。 */
  it("throws when the transfer itself fails", async () => {
    mocks.put.mockRejectedValue(new Error("403"));
    await expect(uploadThumbnailToOss(blob())).rejects.toThrow("403");
    expect(mocks.ossUploadSuccess).not.toHaveBeenCalled();
  });

  it("refuses to upload when the credentials are incomplete", async () => {
    mocks.ossStsToken.mockResolvedValue({ ...TOKEN, securityToken: "" });
    await expect(uploadThumbnailToOss(blob())).rejects.toThrow("STS");
    expect(mocks.put).not.toHaveBeenCalled();
  });

  /* 记账（素材库 + 当天配额）不该拦住缩略图：登记不上就照传，收尾那一步自然也不用做了 */
  it("still uploads when the bookkeeping cannot register the file", async () => {
    mocks.ossUploadStart.mockRejectedValue(new Error("quota"));
    expect(await uploadThumbnailToOss(blob())).toBe(CDN_URL);
    expect(mocks.ossUploadSuccess).not.toHaveBeenCalled();
  });
});

/* 缩略图是 canvas 画完直接给的 data URL，直传前要把它变回字节 —— 这一段错了，
   传到 OSS 的就不是 PNG（或者干脆传不了）。 */
describe("the bytes behind a still", () => {
  const dataUrl = (bytes: number[], type = "image/png") =>
    `data:${type};base64,${btoa(String.fromCharCode(...bytes))}`;

  it("decodes the same bytes the canvas encoded, and keeps the type", async () => {
    const blob = dataUrlBlob(dataUrl([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(blob.type).toBe("image/png");
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  /* 解不开就抛：调用方据此退回「把 data URL 原样交给后端」，而不是传一张空图/坏图上去 */
  it("refuses anything that is not a base64 data URL", () => {
    expect(() => dataUrlBlob("https://example.com/a.png")).toThrow();
    expect(() => dataUrlBlob("data:image/png;base64")).toThrow();
    /* 非 base64 的那种是百分号编码的文本，拿 atob 解会得到错字节 */
    expect(() => dataUrlBlob("data:image/png,ABC")).toThrow();
  });
});
