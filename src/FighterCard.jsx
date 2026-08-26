import { useEffect, useRef, useState } from "react";
import { X, Share2 } from "lucide-react";

const COPY = {
  title: { tr: "Dövüşçü kartın", en: "Your fighter card" },
  subtitle: { tr: "Arkadaşlarınla paylaş.", en: "Share it with your friends." },
  generating: { tr: "Kart hazırlanıyor…", en: "Preparing your card…" },
  error: { tr: "Kart oluşturulamadı, tekrar dene.", en: "Couldn't create the card, try again." },
  share: { tr: "Paylaş", en: "Share" },
  totalSessions: { tr: "SEANS", en: "SESSIONS" },
  longestStreak: { tr: "EN UZUN SERİ", en: "LONGEST STREAK" },
  topSkill: { tr: "GÜÇLÜ YÖN", en: "TOP SKILL" },
  height: { tr: "BOY", en: "HEIGHT" },
  weight: { tr: "KİLO", en: "WEIGHT" },
  reach: { tr: "KOL UZUNLUĞU", en: "REACH" },
  weightClass: { tr: "SİKLET", en: "WEIGHT CLASS" },
  skillDistribution: { tr: "YETENEK DAĞILIMI", en: "SKILL DISTRIBUTION" },
  shareText: { tr: "The Corner'da antrenman kaydımı tutuyorum 🥊", en: "Tracking my training on The Corner 🥊" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

const CARD_W = 1080;
const CARD_H = 1500;

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
}

function upper(text, lang) {
  return (text || "").toLocaleUpperCase(lang === "en" ? "en-US" : "tr-TR");
}

function fitFontSize(ctx, text, weight, maxWidth, startPx, minPx) {
  let size = startPx;
  while (size > minPx) {
    ctx.font = `${weight} ${size}px "Space Grotesk"`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawStatTile(ctx, x, y, w, h, label, value) {
  roundedRectPath(ctx, x, y, w, h, [8, 24, 24, 24]);
  ctx.fillStyle = "#171717";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#262626";
  ctx.stroke();

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, [8, 24, 24, 24]);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 30, y);
  ctx.lineTo(x, y + 30);
  ctx.closePath();
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#737373";
  ctx.font = '600 16px "Space Grotesk"';
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 18, y + 20, w - 36);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 34px "Space Grotesk"';
  ctx.textBaseline = "bottom";
  ctx.fillText(value, x + 18, y + h - 18, w - 36);
}

function drawTapeColumn(ctx, cx, colW, label, value) {
  ctx.fillStyle = "#737373";
  ctx.font = '600 16px "Space Grotesk"';
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillText(label, cx, 0, colW - 24);

  const size = fitFontSize(ctx, value, 700, colW - 24, 38, 22);
  ctx.font = `700 ${size}px "Space Grotesk"`;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillText(value, cx, 50, colW - 24);
}

function drawRadar(ctx, cx, cy, maxR, skills) {
  const n = skills.length;
  const angleFor = (i) => -Math.PI / 2 + i * ((Math.PI * 2) / n);

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75, 1].forEach((frac) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = angleFor(i % n);
      const r = maxR * frac;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  for (let i = 0; i < n; i++) {
    const a = angleFor(i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    ctx.stroke();
  }

  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const a = angleFor(idx);
    const r = (skills[idx].value / 100) * maxR;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(220,38,38,0.35)";
  ctx.fill();
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#a3a3a3";
  ctx.font = '600 20px "Space Grotesk"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const a = angleFor(i);
    const lx = cx + Math.cos(a) * (maxR + 38);
    const ly = cy + Math.sin(a) * (maxR + 38);
    ctx.fillText(skills[i].label, lx, ly);
  }
}

async function drawCard({
  displayName,
  styleLine,
  totalSessions,
  longestStreak,
  topSkillLabel,
  heightCm,
  weightKg,
  reachCm,
  weightClassLabel,
  skills,
  lang,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");

  try {
    await Promise.all([
      document.fonts.load('700 60px "Space Grotesk"'),
      document.fonts.load('600 24px "Space Grotesk"'),
      document.fonts.load('500 20px "Space Grotesk"'),
    ]);
    await document.fonts.ready;
  } catch {
    // fall back to the browser's default font rather than failing the whole card
  }

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(320, 0);
  ctx.lineTo(0, 320);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "rgba(220,38,38,0.35)";
  ctx.lineWidth = 10;
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 34) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + CARD_H, CARD_H);
    ctx.stroke();
  }
  ctx.restore();

  let logo = null;
  try {
    logo = await loadImage("/logo-mark.png");
  } catch {
    // no logo, continue without it
  }

  const pad = 72;
  const contentW = CARD_W - pad * 2;
  let y = pad;

  const headerH = 44;
  let logoW = 0;
  if (logo) {
    logoW = (logo.width / logo.height) * headerH;
    ctx.drawImage(logo, pad, y, logoW, headerH);
  }
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 26px "Space Grotesk"';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("THE CORNER", pad + logoW + (logoW ? 16 : 0), y + headerH / 2);
  y += headerH + 56;

  const avatarR = 84;
  const avatarCx = CARD_W / 2;
  const avatarCy = y + avatarR;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = "#450a0a";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#dc2626";
  ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.font = '700 56px "Space Grotesk"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsOf(displayName), avatarCx, avatarCy + 6);
  y = avatarCy + avatarR + 36;

  const nameText = upper(displayName, lang);
  const nameSize = fitFontSize(ctx, nameText, 700, contentW, 60, 34);
  ctx.font = `700 ${nameSize}px "Space Grotesk"`;
  ctx.fillStyle = "#f5f5f5";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(nameText, CARD_W / 2, y + nameSize * 0.75, contentW);
  y += nameSize * 0.75 + 14;

  const subtitleText = upper(styleLine, lang);
  const subtitleSize = fitFontSize(ctx, subtitleText, 600, contentW, 22, 14);
  ctx.font = `600 ${subtitleSize}px "Space Grotesk"`;
  ctx.fillStyle = "#dc2626";
  ctx.fillText(subtitleText, CARD_W / 2, y + subtitleSize, contentW);
  y += subtitleSize + 36;

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(CARD_W - pad, y);
  ctx.stroke();
  y += 36;

  const tapeRowH = 74;
  const cols = [
    [c("height", lang), heightCm ? `${heightCm} cm` : "—"],
    [c("weight", lang), weightKg ? `${weightKg} kg` : "—"],
    [c("reach", lang), reachCm ? `${reachCm} cm` : "—"],
    [c("weightClass", lang), weightClassLabel || "—"],
  ];
  const colW = contentW / 4;
  ctx.save();
  ctx.translate(0, y);
  cols.forEach(([label, value], i) => {
    const colCx = pad + colW * i + colW / 2;
    drawTapeColumn(ctx, colCx, colW, label, value);
    if (i > 0) {
      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad + colW * i, -6);
      ctx.lineTo(pad + colW * i, tapeRowH - 6);
      ctx.stroke();
    }
  });
  ctx.restore();
  y += tapeRowH + 30;

  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(CARD_W - pad, y);
  ctx.stroke();
  y += 36;

  if (skills?.length) {
    ctx.fillStyle = "#737373";
    ctx.font = '600 20px "Space Grotesk"';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(c("skillDistribution", lang), CARD_W / 2, y);
    y += 24 + 50;

    const radarR = 130;
    drawRadar(ctx, CARD_W / 2, y + radarR + 20, radarR, skills);
    y += radarR * 2 + 20 + 60;

    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(CARD_W - pad, y);
    ctx.stroke();
    y += 36;
  }

  const tileGap = 24;
  const tileW = (contentW - tileGap * 2) / 3;
  const tileH = 190;
  drawStatTile(ctx, pad, y, tileW, tileH, c("totalSessions", lang), String(totalSessions));
  drawStatTile(ctx, pad + tileW + tileGap, y, tileW, tileH, c("longestStreak", lang), String(longestStreak));
  drawStatTile(ctx, pad + (tileW + tileGap) * 2, y, tileW, tileH, c("topSkill", lang), topSkillLabel);
  y += tileH + pad;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = CARD_W;
  outCanvas.height = y;
  outCanvas.getContext("2d").drawImage(canvas, 0, 0, CARD_W, y, 0, 0, CARD_W, y);
  return outCanvas;
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "the-corner-fighter-card.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FighterCardModal({
  open,
  onClose,
  displayName,
  styleLine,
  totalSessions,
  longestStreak,
  topSkillLabel,
  heightCm,
  weightKg,
  reachCm,
  weightClassLabel,
  skills,
  lang,
}) {
  const [status, setStatus] = useState("loading");
  const [previewUrl, setPreviewUrl] = useState(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    blobRef.current = null;
    drawCard({ displayName, styleLine, totalSessions, longestStreak, topSkillLabel, heightCm, weightKg, reachCm, weightClassLabel, skills, lang })
      .then(
        (canvas) =>
          new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png");
          })
      )
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setStatus("error");
          return;
        }
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, displayName, styleLine, totalSessions, longestStreak, topSkillLabel, heightCm, weightKg, reachCm, weightClassLabel, JSON.stringify(skills), lang]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const handleShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], "the-corner-fighter-card.png", { type: "image/png" });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: "The Corner", text: c("shareText", lang) });
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
    downloadBlob(blob);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5">
      <div className="w-full max-w-xs bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-neutral-100 text-sm font-bold tracking-tight">{c("title", lang)}</p>
            <p className="text-neutral-500 text-xs">{c("subtitle", lang)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex items-center justify-center mb-3"
          style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
        >
          {status === "loading" && <p className="text-neutral-600 text-xs animate-pulse">{c("generating", lang)}</p>}
          {status === "error" && <p className="text-red-400 text-xs px-4 text-center">{c("error", lang)}</p>}
          {status === "ready" && previewUrl && <img src={previewUrl} alt="" className="w-full h-full object-contain" />}
        </div>

        <button
          onClick={handleShare}
          disabled={status !== "ready"}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-neutral-950 font-semibold text-sm rounded-lg py-2.5 transition-colors"
        >
          <Share2 size={16} />
          {c("share", lang)}
        </button>
      </div>
    </div>
  );
}
