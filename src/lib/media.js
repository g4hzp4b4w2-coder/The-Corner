const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

// Downscales/recompresses an image client-side before it ever hits Storage —
// phone camera photos are routinely 10x larger than a feed needs.
export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_INPUT_BYTES) {
      reject(new Error("File too large"));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))), "image/jpeg", JPEG_QUALITY);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
