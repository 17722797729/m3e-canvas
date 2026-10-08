/**
 * 市场缩略图直传 OSS
 * ---------------------------------------------------------------------------
 * 从 syai_web（官网）的 `utils/oss-upload.js` + `utils/ossUrl.js` 搬过来的同一条路：
 * 拿 STS 临时凭证 → 通知后端「开始上传」→ ali-oss 直传 → 通知后端「上传完成」→
 * 把 OSS 域名换成 CDN 域名。平台其它前端都这么做，后端的 `/syai/oss/*` 就是为它准备的。
 *
 * 为什么市场缩略图要走这条路：后端 `fileService.createFileApp()` 写的是
 * `infra_file_config` 里 master 那一条存储。master 一旦被改成「本地存储」
 * （storage = 10，域名 127.0.0.1），缩略图就变成
 * `http://127.0.0.1:58080/admin-api/infra/file/29/get/market-component/xxx.png`，
 * 市场和后台都拿它当 `<img src>` —— 破图。直传不经过那份配置，只认 STS 权限，
 * 落下来的地址就是 CDN 上能直接打开的那种：
 * `https://aiimg.vxwebgame.com/user/<uid>/market-thumbnail-<时间戳>-<随机>.png`
 *
 * bucket 是**私有读**的：OSS 域名（syaii-dev.oss-cn-shenzhen.aliyuncs.com）单独取对象是
 * 403 AccessDenied，只有走 `aiimg.vxwebgame.com`（CDN 带回源鉴权）才拿得到，
 * 所以直传回来的地址必须过一遍 `toCdnUrl()`。这也是 syai_web 那张映射表存在的理由。
 *
 * ali-oss 是**按需**加载的：一个 640×640 的 PNG 直传只在上传组件时发生一次，
 * 不该让它的体积压进编辑器的首屏（`await import()` 会把它单独切成一块）。
 * 另外它的默认入口是 Node 版（`lib/client.js` → `urllib` → 装不到的 `proxy-agent`），
 * 客户端组件的 SSR 那一趟会因此构建失败 —— 所以 next.config.ts 里有一条指向它浏览器产物的
 * `turbopack.resolveAlias`，别删。
 */

import { ossStsToken, ossUploadStart, ossUploadSuccess } from "./syai";

/** 直传回来的地址落在 OSS 上，而 bucket 私有读，对外要用 CDN 域名 */
const OSS_HOST = "syaii-dev.oss-cn-shenzhen.aliyuncs.com";
const CDN_HOST = "aiimg.vxwebgame.com";
/** 后端没下发 region 时的兜底（与 syai_web 的写死值一致） */
const FALLBACK_REGION = "oss-cn-shenzhen";

/**
 * 把 OSS 直传回来的地址换成 CDN 地址
 *
 * 不含 OSS 域名时原样返回（比如后端某天换成了别的公开域名，这里不该乱改）。
 */
export const toCdnUrl = (url: string): string =>
  url.includes(OSS_HOST) ? url.replaceAll(OSS_HOST, CDN_HOST) : url;

/**
 * 对象键
 *
 * 只用 ASCII：键会同时出现在请求路径和签名里，中文/空格/`%` 一路编解码太容易对不上，
 * 而缩略图本来也不需要保留原来的名字。落在后端下发的 `dirPrefix`（`user/<uid>/`）下，
 * 临时凭证的权限也只覆盖那一段前缀。
 */
export function thumbnailKey(dirPrefix: string | undefined, stamp: number, rand: string): string {
  const dir = (dirPrefix ?? "").replace(/^\/+|\/+$/g, "");
  const name = `market-thumbnail-${stamp}-${rand}.png`;
  return dir ? `${dir}/${name}` : name;
}

/**
 * 数据 URL → Blob
 *
 * 不用 `fetch(dataUrl)`：那要过一次网络栈（还得指望 CSP 放行 `data:`），而这段 base64 本来
 * 就在手上 —— 缩略图是 canvas 刚画出来的，解码是纯计算。
 */
export function dataUrlBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) throw new Error("不是一个 data URL");
  const meta = dataUrl.slice(0, comma);
  /* 只认 base64：canvas.toDataURL() 给的一直是它，而非 base64 的那种是百分号编码的文本，
     拿 atob 解会得到错字节 —— 与其悄悄传一张坏图上去，不如在这里失败、让调用方退回后端转存 */
  if (!meta.includes(";base64")) throw new Error("只认 base64 的 data URL");
  const type = /^data:([^;,]+)/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 直传一个 PNG，返回 CDN 上能直接打开的地址；任何一步失败都抛错，由调用方决定怎么退 */
export async function uploadThumbnailToOss(blob: Blob): Promise<string> {
  const { accessKeyId, accessKeySecret, securityToken, region, bucket, dirPrefix, endpoint } = await ossStsToken();
  if (!accessKeyId || !accessKeySecret || !securityToken || !bucket) {
    throw new Error("STS 凭证不完整");
  }

  const key = thumbnailKey(dirPrefix, Date.now(), Math.random().toString(36).slice(2, 10));
  /* 记一条素材，拿不到 id 也照样传：簿记不该拦住缩略图（它的成败与配额在 upload-success 里结） */
  const md5Hash = `${key}-${blob.size}`;
  const fileId = await ossUploadStart({ fileName: key, fileSize: blob.size, fileType: "png", md5Hash }).catch(
    () => null,
  );

  const { default: OSS } = await import("ali-oss");
  const client = new OSS({
    region: region || FALLBACK_REGION,
    bucket,
    accessKeyId,
    accessKeySecret,
    stsToken: securityToken,
    /* 凭证过期时 ali-oss 会回头找这里要新的：会话够久的话（比如上传前对话框开着很久）用得上 */
    refreshSTSToken: async () => {
      const fresh = await ossStsToken();
      return { accessKeyId: fresh.accessKeyId, accessKeySecret: fresh.accessKeySecret, stsToken: fresh.securityToken };
    },
  });

  const put = await client.put(key, blob, { mime: "image/png" });
  /* `url` 是 ali-oss 给的访问地址；`res.requestUrls` 是它底层那次请求的记录 ——
     类型里没有这一项、运行时在，两个都认（syai_web 也是这么兜的），再兜一层自己拼 */
  const asked = (put?.res as { requestUrls?: string[] } | undefined)?.requestUrls?.[0];
  const base = (endpoint ?? `https://${bucket}.${region || FALLBACK_REGION}.aliyuncs.com`).replace(/\/+$/, "");
  const raw = put?.url || asked?.split("?")[0] || `${base}/${key}`;
  const fileUrl = toCdnUrl(raw);

  if (fileId) {
    /* 记账失败不该让已经传上去的图作废：地址已经拿到了，调用方照用 */
    void ossUploadSuccess({ fileId, fileUrl, fileType: "png", md5Hash, filePath: key }).catch(() => {});
  }
  return fileUrl;
}
