import { useEffect, useRef, useState } from "react";
import { X, Share2 } from "lucide-react";

const COPY = {
  title: { tr: "Dövüşçü kartın", en: "Your fighter card" },
  subtitle: { tr: "Arkadaşlarınla paylaş.", en: "Share it with your friends." },
  generating: { tr: "Kart hazırlanıyor…", en: "Preparing your card…" },
  error: { tr: "Kart oluşturulamadı, tekrar dene.", en: "Couldn't create the card, try again." },
  share: { tr: "Paylaş", en: "Share" },
  totalSessions: { tr: "TOPLAM SEANS", en: "TOTAL SESSIONS" },
  longestStreak: { tr: "EN UZUN SERİ", en: "LONGEST STREAK" },
  topSkill: { tr: "GÜÇLÜ YÖN", en: "TOP SKILL" },
  shareText: { tr: "The Corner'da antrenman kaydımı tutuyorum 🥊", en: "Tracking my training on The Corner 🥊" },
  footer: { tr: "PROFESYONEL GİBİ ANTRENMAN YAP — THE CORNER", en: "TRAIN LIKE A PRO — THE CORNER" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

const CARD_W = 1080;
const CARD_H = 1080;

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
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
  roundedRectPath(ctx, x, y, w, h, [8, 28, 28, 28]);
  ctx.fillStyle = "#171717";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#262626";
  ctx.stroke();

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, [8, 28, 28, 28]);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 34, y);
  ctx.lineTo(x, y + 34);
  ctx.closePath();
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#737373";
  ctx.font = '600 18px "Space Grotesk"';
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 20, y + 46, w - 40);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 38px "Space Grotesk"';
  ctx.textBaseline = "bottom";
  ctx.fillText(value, x + 20, y + h - 22, w - 40);
}

async function drawCard({ displayName, styleLine, totalSessions, longestStreak, topSkillLabel, lang }) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");

  try {
    await Promise.all([
      document.fonts.load('700 56px "Space Grotesk"'),
      document.fonts.load('600 28px "Space Grotesk"'),
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
  ctx.lineTo(360, 0);
  ctx.lineTo(0, 360);
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

  const pad = 72;
  let logo = null;
  try {
    logo = await loadImage("/logo-mark.png");
  } catch {
    // no logo, continue without it
  }

  let y = pad;
  const headerH = 64;
  let logoW = 0;
  if (logo) {
    logoW = (logo.width / logo.height) * headerH;
    ctx.drawImage(logo, pad, y, logoW, headerH);
  }
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 34px "Space Grotesk"';
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("THE CORNER", pad + logoW + (logoW ? 20 : 0), y + 6);
  ctx.fillStyle = "#525252";
  ctx.font = '500 20px "Space Grotesk"';
  ctx.fillText("FIGHTER'S HUB", pad + logoW + (logoW ? 20 : 0), y + 46);
  y += headerH + 64;

  const avatarR = 96;
  const avatarCx = pad + avatarR;
  const avatarCy = y + avatarR;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = "#450a0a";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#7f1d1d";
  ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.font = '700 60px "Space Grotesk"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initialsOf(displayName), avatarCx, avatarCy + 6);

  const nameX = avatarCx + avatarR + 40;
  const nameMaxW = CARD_W - nameX - pad;
  ctx.textAlign = "left";
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 50px "Space Grotesk"';
  ctx.fillText(displayName, nameX, avatarCy - 22, nameMaxW);
  ctx.fillStyle = "#737373";
  ctx.font = '500 26px "Space Grotesk"';
  ctx.fillText(styleLine, nameX, avatarCy + 30, nameMaxW);
  y = avatarCy + avatarR + 64;

  const tileGap = 24;
  const tileW = (CARD_W - pad * 2 - tileGap * 2) / 3;
  const tileH = 240;
  drawStatTile(ctx, pad, y, tileW, tileH, c("totalSessions", lang), String(totalSessions));
  drawStatTile(ctx, pad + tileW + tileGap, y, tileW, tileH, c("longestStreak", lang), String(longestStreak));
  drawStatTile(ctx, pad + (tileW + tileGap) * 2, y, tileW, tileH, c("topSkill", lang), topSkillLabel);
  y += tileH;

  const footerH = 100;
  const footerY = CARD_H - footerH;
  if (logo && footerY - y > 60) {
    const bandH = footerY - y;
    const wmH = Math.min(bandH * 1.5, 460);
    const wmW = (logo.width / logo.height) * wmH;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.translate(CARD_W / 2, y + bandH / 2);
    ctx.rotate((-6 * Math.PI) / 180);
    ctx.drawImage(logo, -wmW / 2, -wmH / 2, wmW, wmH);
    ctx.restore();
  }

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(0, footerY, CARD_W, footerH);
  ctx.fillStyle = "#0a0a0a";
  ctx.font = '700 28px "Space Grotesk"';
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(c("footer", lang), CARD_W / 2, footerY + footerH / 2);

  return canvas;
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

export default function FighterCardModal({ open, onClose, displayName, styleLine, totalSessions, longestStreak, topSkillLabel, lang }) {
  const [status, setStatus] = useState("loading");
  const [previewUrl, setPreviewUrl] = useState(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    blobRef.current = null;
    drawCard({ displayName, styleLine, totalSessions, longestStreak, topSkillLabel, lang })
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
  }, [open, displayName, styleLine, totalSessions, longestStreak, topSkillLabel, lang]);

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
