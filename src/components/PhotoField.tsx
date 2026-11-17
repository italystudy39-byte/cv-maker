"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function cropToDataUrl(src: string, area: Area, ratio: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const outW = 600;
  const outH = Math.round(outW / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function PhotoField({
  photo,
  ratio,
  onChange,
}: {
  photo: string | null;
  ratio: "1:1" | "3:4";
  onChange: (photo: string | null, ratio: "1:1" | "3:4") => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [r, setR] = useState<"1:1" | "3:4">(ratio);
  const [error, setError] = useState("");

  const onFile = (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Поддерживаются JPG, PNG и WEBP");
    if (f.size > MAX_BYTES) return setError("Файл больше 5 МБ");
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(f);
  };

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const save = async () => {
    if (!src || !area) return;
    const out = await cropToDataUrl(src, area, r === "1:1" ? 1 : 3 / 4);
    onChange(out, r);
    setSrc(null);
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 ${ratio === "3:4" ? "h-24 w-[72px]" : "h-20 w-20"}`}>
          {photo ? <img src={photo} alt="Фото" className="h-full w-full object-cover" /> : <span className="text-xs">нет фото</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label className="btn-secondary cursor-pointer">
            {photo ? "Заменить фото" : "Загрузить фото"}
            <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
          {photo ? (
            <button type="button" className="text-left text-sm text-red-600 hover:underline" onClick={() => onChange(null, ratio)}>
              Удалить
            </button>
          ) : null}
        </div>
      </div>
      <p className="hint mt-2">JPG, PNG или WEBP до 5 МБ. Необязательно.</p>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}

      {src ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Кадрирование фото">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Кадрирование</h3>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                {(["1:1", "3:4"] as const).map((x) => (
                  <button key={x} type="button" onClick={() => setR(x)} className={`rounded-md px-3 py-1 ${r === x ? "bg-white shadow" : "text-slate-600"}`}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative h-80 overflow-hidden rounded-lg bg-slate-900">
              <Cropper image={src} crop={crop} zoom={zoom} aspect={r === "1:1" ? 1 : 3 / 4} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
            </div>
            <p className="hint mt-2">Перетащите фото, чтобы лицо было по центру.</p>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-2 w-full" aria-label="Масштаб" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSrc(null)}>
                Отмена
              </button>
              <button type="button" className="btn-primary" onClick={save}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
