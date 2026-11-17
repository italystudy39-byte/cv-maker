"use client";
/* eslint-disable @next/next/no-img-element */
import { ImagePlus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal, Segmented } from "./ui";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
type Ratio = "1:1" | "3:4";

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

/** DESIGN 6.3: 96×96 dashed drop zone, cropper in a modal, then a thumbnail with «Заменить» and «Удалить». */
export function PhotoField({ photo, ratio, onChange }: { photo: string | null; ratio: Ratio; onChange: (photo: string | null, ratio: Ratio) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [r, setR] = useState<Ratio>(ratio);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Загрузите фото в формате JPG, PNG или WEBP");
    if (f.size > MAX_BYTES) return setError("Файл больше 5 МБ. Уменьшите фото и загрузите снова");
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(f);
  };

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);
  const close = useCallback(() => setSrc(null), []);

  const save = async () => {
    if (!src || !area) return;
    onChange(await cropToDataUrl(src, area, r === "1:1" ? 1 : 3 / 4), r);
    setSrc(null);
  };

  return (
    <div>
      <div className="label">Фото</div>
      <div className="flex items-center gap-4">
        {photo ? (
          <img src={photo} alt="Ваше фото" className="size-24 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex size-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong text-[13px] leading-[16px] text-muted transition-colors duration-100 hover:text-fg ${over ? "bg-accent-soft" : "bg-raised"}`}
          >
            <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
            Добавить фото
          </button>
        )}
        <div className="flex flex-col items-start gap-1">
          {photo ? (
            <>
              <button type="button" className="btn btn-ghost btn-s" onClick={() => input.current?.click()}>
                Заменить
              </button>
              <button type="button" className="btn btn-danger btn-s" onClick={() => onChange(null, ratio)}>
                Удалить
              </button>
            </>
          ) : (
            <p className="hint">JPG, PNG или WEBP до 5 МБ. Можно без фото.</p>
          )}
        </div>
        <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
      {error ? <p className="mt-1.5 text-[13px] text-danger">{error}</p> : null}

      {src ? (
        <Modal
          title="Кадрирование"
          width={560}
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={close}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Сохранить
              </button>
            </>
          }
        >
          <Segmented label="Пропорции" size="s" value={r} onChange={setR} options={[{ id: "1:1", label: "1:1" }, { id: "3:4", label: "3:4" }]} />
          <div className="relative mt-3 h-80 overflow-hidden rounded-md bg-sunken" onPointerDown={() => setDragging(true)} onPointerUp={() => setDragging(false)}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={r === "1:1" ? 1 : 3 / 4}
              showGrid={dragging}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              style={{ cropAreaStyle: { color: "rgb(11 13 16 / 0.55)", border: "1px solid rgb(255 255 255 / 0.8)" } }}
            />
          </div>
          <label className="mt-3 flex items-center gap-3 text-sm text-muted">
            Масштаб
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--ui-accent)]" />
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
