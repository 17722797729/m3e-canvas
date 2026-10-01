"use client";

import { useState } from "react";
import { Palette } from "@/lib/tokens";

/**
 * 作者头像
 * ---------------------------------------------------------------------------
 * 市场里的每个组件都带着上传者的 `userAvatar`（后端在 www.syai 那边存好了），
 * 所以这里画真实头像；只有对方没设过头像时，才退回首字母 + 一块按用户编号取色的底，
 * 让同一个人在列表里始终是同一个颜色。
 */
export function UserAvatar({
  p,
  src,
  name,
  size = 20,
  seed,
}: {
  p: Palette;
  /** 头像地址，来自组件的 userAvatar */
  src?: string;
  /** 昵称或手机号，用来取首字母 */
  name?: string;
  size?: number;
  /** 用户编号：没有头像时用它挑一个稳定的底色 */
  seed?: number | string;
}) {
  const [broken, setBroken] = useState(false);
  const radius = size / 2;

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block", flex: "0 0 auto" }}
      />
    );
  }

  const initial = (name || "").trim().charAt(0).toUpperCase() || "·";
  /* 用编号挑色调，而不是颜色名：换配色方案时它们仍然成对，不会撞成一片 */
  const palette = [p.primaryContainer, p.secondaryContainer, p.tertiaryContainer];
  const index = typeof seed === "number" ? seed : String(seed ?? initial).length + (name?.length ?? 0);
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flex: "0 0 auto",
        background: palette[index % palette.length],
        color: p.onPrimaryContainer,
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(9, Math.round(size * 0.5)),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );
}
