import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Crop, Minus, Plus } from '@/lib/icons'

/** Aspect ratio used for recipe images (matches server 4:3 variants). */
const CROP_ASPECT = 4 / 3
/** Cap output width to the largest server variant to keep file size sane. */
const MAX_OUTPUT_WIDTH = 1920

interface ImageCropperProps {
  /** Object URL or data URL of the image to crop. */
  src: string
  /** Original file name, reused for the cropped output. */
  fileName: string
  /** Called with the cropped image as a File. */
  onCropComplete: (file: File) => void
  /** Called when the user cancels cropping. */
  onCancel: () => void
}

/**
 * Loads an image and draws the selected crop region onto a canvas,
 * returning the result as a JPEG File. Works with mouse and touch.
 */
async function getCroppedFile(
  src: string,
  area: Area,
  fileName: string
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  // Scale down if the crop is larger than the max output width.
  const scale = area.width > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH / area.width : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  )
  if (!blob) throw new Error('Could not create image blob')

  const name = fileName.replace(/\.[^./]+$/, '') || 'bild'
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
}

export function ImageCropper({
  src,
  fileName,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const onCropAreaChange = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedArea) return
    setIsSaving(true)
    try {
      const file = await getCroppedFile(src, croppedArea, fileName)
      onCropComplete(file)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-4 w-4" />
            Beskär bild
          </DialogTitle>
          <DialogDescription>
            Dra för att flytta och nyp eller använd reglaget för att zooma.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-muted sm:h-96">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={CROP_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            showGrid
          />
        </div>

        <div className="flex items-center gap-3">
          <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={(v) => setZoom(v[0])}
            aria-label="Zooma"
          />
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Avbryt
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSaving || !croppedArea}>
            {isSaving ? 'Beskär…' : 'Använd bild'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
