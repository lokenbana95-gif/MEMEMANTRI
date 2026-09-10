/* MemeMantri share tools: share links, WhatsApp, Instagram Story cards, and downloads. */
(function () {
  "use strict";

  function shareIdFor(meme) {
    const raw = String(meme?.id || "meme");
    const serverId = raw.match(/^srv(\d+)$/)?.[1] || raw.match(/^\d+$/)?.[0];
    return serverId || raw;
  }

  function sharePathFor(meme) {
    const url = new URL(shareUrlFor(meme));
    return `${url.host}${url.pathname}${url.search}`;
  }

  function shareUrlFor(meme) {
    const raw = String(meme?.id || "meme");
    const serverId = raw.match(/^srv(\d+)$/)?.[1] || raw.match(/^\d+$/)?.[0];
    if (serverId) return new URL(`/m/${serverId}`, location.origin).href;
    const page = location.pathname || "/";
    return new URL(`${page}?meme=${encodeURIComponent(raw)}`, location.href)
      .href;
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line)
        line = candidate;
      else {
        lines.push(line);
        line = word;
      }
      if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    const consumed = lines.join(" ").length;
    const original = String(text || "").trim();
    if (original.length > consumed && lines.length) {
      let last = lines[lines.length - 1];
      while (last.length && ctx.measureText(`${last}…`).width > maxWidth)
        last = last.slice(0, -1);
      lines[lines.length - 1] = `${last.trim()}…`;
    }
    return lines;
  }

  function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const lines = wrapLines(ctx, text, maxWidth, maxLines);
    lines.forEach((line, index) =>
      ctx.fillText(line, x, y + index * lineHeight),
    );
    return y + lines.length * lineHeight;
  }

  function makeShareCard(meme) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    const pad = 78;
    const width = canvas.width;
    const height = canvas.height;
    const category = String(meme?.category || meme?.label || "global").toLowerCase();
    const themes = {
      cricket: ["#146c3b", "#0b2633", "🏏", "LAST OVER ENERGY"],
      student: ["#304b86", "#1c233c", "📚", "EXAM NIGHT FILES"],
      bollywood: ["#8b174c", "#29134a", "🎬", "FULL FILMY MODE"],
      politics: ["#7e2828", "#2f1717", "🏛️", "LIVE FROM SANSAD"],
      tech: ["#07546a", "#111827", "💻", "TECH SUPPORT DESK"],
      gaming: ["#26347d", "#421b62", "🎮", "RANK PUSH LIVE"],
      love: ["#9e2c65", "#35152b", "💘", "DIL KI COMMITTEE"],
      funny: ["#a36522", "#3a2919", "😂", "LAUGHTER MINISTRY"],
      hindi: ["#9b4b17", "#4c1d2c", "🪔", "हिंदी विभाग"],
      desi: ["#9a4c1d", "#352018", "☕", "DESI DEPARTMENT"],
      world: ["#6d3a89", "#202346", "🌍", "GLOBAL MEME"],
    };
    const [from, to, emoji, kicker] = themes[category] || ["#ff9933", "#5a2417", "🇮🇳", "MEME MINISTRY"];
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, from);
    background.addColorStop(1, to);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(width - 30, 180, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(70, height - 260, 290, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9933"; ctx.fillRect(0, 0, width / 3, 14);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(width / 3, 0, width / 3, 14);
    ctx.fillStyle = "#138808"; ctx.fillRect((width / 3) * 2, 0, width / 3, 14);
    ctx.fillStyle = "rgba(0,0,0,.22)"; roundedRect(ctx, pad - 20, 62, width - (pad - 20) * 2, 92, 22); ctx.fill();
    ctx.fillStyle = "#ffd45e"; ctx.font = "700 30px 'Space Grotesk', Arial, sans-serif"; ctx.fillText("MEMEMANTRI", pad, 105);
    ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.font = "500 21px 'Space Grotesk', Arial, sans-serif"; ctx.fillText("VISUAL PARLIAMENT OF INDIAN MEMES", pad, 137);
    ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.font = "700 22px 'Space Grotesk', Arial, sans-serif"; ctx.fillText(String(kicker).toUpperCase(), pad, 238);
    ctx.font = "90px Arial, sans-serif"; ctx.fillText(emoji, pad, 350);
    ctx.fillStyle = "#fff"; ctx.font = "700 54px 'Bebas Neue', Impact, sans-serif";
    const textStart = 445;
    const nextY = drawTextBlock(ctx, meme?.text || meme?.title || "", pad, textStart, width - pad * 2, 66, 12);
    ctx.fillStyle = "rgba(255,255,255,.13)"; roundedRect(ctx, pad, Math.min(nextY + 36, height - 310), width - pad * 2, 3, 2); ctx.fill();
    const footerY = height - 170;
    ctx.fillStyle = "rgba(255,255,255,.76)"; ctx.font = "500 25px 'Space Grotesk', Arial, sans-serif"; ctx.fillText(String(meme?.creator || "@anonymous"), pad, footerY);
    ctx.fillStyle = "#ffd45e"; ctx.font = "700 24px 'Space Grotesk', Arial, sans-serif"; ctx.fillText(sharePathFor(meme), pad, footerY + 52);
    ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "700 24px 'Space Grotesk', Arial, sans-serif"; ctx.fillText("🇮🇳 SHARE THE LAUGHTER", width - pad, footerY); ctx.textAlign = "left";
    return canvas;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Image card generate nahi ho saka.")),
        "image/png",
      ),
    );
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }

  async function shareMeme(meme, platform) {
    const url = shareUrlFor(meme);
    const title = String(meme?.title || "MemeMantri meme");
    const text = `${title}\n${url}`;

    if (platform === "link") {
      await copyText(url);
      return { message: "✅ Unique meme link copy ho gaya." };
    }

    if (platform === "whatsapp") {
      if (navigator.share && navigator.canShare) {
        const canvas = makeShareCard(meme);
        const blob = await canvasBlob(canvas);
        const file = new File([blob], `mememantri-${shareIdFor(meme)}.png`, {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title,
              text: `MemeMantri meme — ${url}`,
              files: [file],
            });
            return {
              message: "✅ Image card WhatsApp/share sheet ke liye ready hai.",
            };
          } catch (error) {
            if (error?.name === "AbortError")
              return { message: "Share cancel kar diya gaya." };
          }
        }
      }
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return { message: "✅ Share sheet open ho gaya." };
        } catch (error) {
          if (error?.name === "AbortError")
            return { message: "Share cancel kar diya gaya." };
        }
      }
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return { message: "✅ WhatsApp share window open ho gayi." };
    }

    if (platform === "instagram") {
      const canvas = makeShareCard(meme);
      const blob = await canvasBlob(canvas);
      const file = new File([blob], `mememantri-${shareIdFor(meme)}.png`, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title,
            text: `MemeMantri Story Card — ${url}`,
            files: [file],
          });
          return { message: "✅ Story card share sheet mein ready hai." };
        } catch (error) {
          if (error?.name === "AbortError")
            return { message: "Story share cancel kar diya gaya." };
        }
      }
      downloadBlob(blob, file.name);
      try {
        await copyText(url);
      } catch {}
      return {
        message:
          "✅ Story card download ho gaya — Instagram Story mein upload karo. Link bhi copy ho gaya.",
      };
    }

    return { message: "Share option available nahi hai." };
  }

  window.MemeShare = { makeShareCard, shareMeme, shareUrlFor };
})();
