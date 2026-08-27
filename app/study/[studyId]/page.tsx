'use client'

/* =====================================================
   [1] IMPORTS
===================================================== */

import { getStudyById } from '@/lib/atlas/studies'
import { StructurePicker } from "@/lib/atlas/components/StructurePicker"


import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

import { downloadJson } from '@/lib/atlas/downloadJson'

import { 
  getProfileById, 
  getStructureColor, 
  getStructureLabel, 
  getCategoryColor,
 } from "@/lib/anatomy/resolve"

import { buildSliceUrl } from '@/lib/atlas/loader'

import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/anatomy/profiles/palette"


/* END [1] IMPORTS */


/* =====================================================
   [2] TYPES
   ===================================================== */

/* [2.1] Annotation point */
type Annotation = { structureId: string; x: number; y: number }

/* [2.2] Annotations by slice index (string key) */
type AnnotationsBySlice = Record<string, Annotation[] | undefined>

/* [2.3] Geometry helpers */
type Rect = {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

/* [2.4] Callouts (layout items) */
type CalloutItem = {
  idx: number
  structureId: string
  x: number
  y: number
  px: number
  py: number
  isLeft: boolean
  label: string
}


type CalloutPlaced = CalloutItem & {
  endX: number
  endY: number
}

type UIStructure = {
  id: string
  label: string
  side?: "L" | "R" | "M"
  category?: string
}


/* END [2] TYPES */


/* =====================================================
   [3] COMPONENT :: Page
   ===================================================== */
export default function Page() {
  /* =====================================================
     [3.1] PARAMS & STUDY
     ===================================================== */
 
     
  const { studyId } = useParams<{ studyId: string }>()

  const study = useMemo(() => getStudyById(studyId), [studyId])

  const [selectedStructureId, setSelectedStructureId] = useState<string>("")

useEffect(() => {
  try {
    const saved = localStorage.getItem(`anatoslice:lastStructure:${study?.id}`)
    if (saved) setSelectedStructureId(saved)
  } catch {}
}, [study?.id])

useEffect(() => {
  try {
    if (selectedStructureId && study?.id) {
      localStorage.setItem(
        `anatoslice:lastStructure:${study.id}`,
        selectedStructureId
      )
    }
  } catch {}
}, [selectedStructureId, study?.id])


  const anatomyProfile = useMemo(
    () => getProfileById(study?.anatomyProfileId),
    [study?.anatomyProfileId]
  )

  const uiStructures = useMemo<UIStructure[]>(() => {
   if (Array.isArray(anatomyProfile) && anatomyProfile.length) {
    return anatomyProfile.map((s) => ({
      id: s.id,
      label: (s as any).labelEs ?? (s as any).label ?? s.id,
      side: (s as any).side,
      category: (s as any).category,
    }))
  }

  // fallback: lo viejo
  return (study?.structures ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    side: s.side,
    category: (s as any).category,
  }))
}, [anatomyProfile, study])


  const TOTAL_SLICES = study?.slicesCount ?? 0
 
  /* END [3.1] PARAMS & STUDY */



  /* =====================================================
     [3.2] MODE :: AUTHOR (?author=1)
     ===================================================== */
    const searchParams = useSearchParams()
    const isAuthor = searchParams.get('author') === '1'
  /* END [3.2] MODE :: AUTHOR */


  /* =====================================================
     [3.3] STATE :: CORE UI
     ===================================================== */
  const [slice, setSlice] = useState(0)
const [labelFilters, setLabelFilters] = useState({
   airway: studyId !== "rx_chest_normal_v1",
  artery: studyId !== "rx_chest_normal_v1",
  vein: studyId !== "rx_chest_normal_v1",
  organ: studyId !== "rx_chest_normal_v1",
})

  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [displayedImageUrl, setDisplayedImageUrl] = useState("")
  const [displayedSlice, setDisplayedSlice] = useState(0)

  /* END [3.3] STATE :: CORE UI */

  useEffect(() => {
  const labelsOnByDefault = studyId !== "rx_chest_normal_v1"

  setLabelFilters({
    airway: labelsOnByDefault,
    artery: labelsOnByDefault,
    vein: labelsOnByDefault,
    organ: labelsOnByDefault,
  })
}, [studyId])

  /* =====================================================
     [3.4] STATE :: ANNOTATIONS / AUTHOR
     ===================================================== */
  const [activeStructure, setActiveStructure] = useState<string>('')
  const [annotationsBySlice, setAnnotationsBySlice] = useState<AnnotationsBySlice>({})
  
  const [lastLoadedFile, setLastLoadedFile] = useState('')


  /* [3.4.x] STATE :: CALLOUTS GEOMETRY */
  const [geom, setGeom] = useState<{ v: Rect; i: Rect } | null>(null)
  const [imageReady, setImageReady] = useState(false)
  /* END [3.4.x] STATE :: CALLOUTS GEOMETRY */
  /* END [3.4] STATE :: ANNOTATIONS / AUTHOR */


  /* =====================================================
     [3.5] REFS :: DOM + TOUCH + PRELOAD
     ===================================================== */
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  
  const preloadedRef = useRef<Set<string>>(new Set())

// Mobile touch / pointer scrub
const touchLastStepYRef = useRef<number | null>(null)
const touchIsSwipingRef = useRef(false)
const activeTouchPointerRef = useRef<number | null>(null)


// funcion para mantener click izq mantenido y cambiar slices //
const mouseIsDraggingRef = useRef(false)
const mouseLastStepYRef = useRef<number | null>(null)
const mouseDidDragRef = useRef(false)


  /* END [3.5] REFS :: DOM + TOUCH + PRELOAD */


 /* =====================================================
   [3.6] MEMOS :: DERIVED
   ===================================================== */
const imageUrl = useMemo(() => {
  if (!study) return ''
  return buildSliceUrl(study, slice)
}, [study, slice])

useEffect(() => {
  if (!imageUrl) return

  const requestedSlice = slice
  const nextImg = new Image()

  nextImg.onload = () => {
    setDisplayedImageUrl(imageUrl)
    setDisplayedSlice(requestedSlice)
  }

  nextImg.src = imageUrl

  return () => {
    nextImg.onload = null
  }
}, [imageUrl, slice])


const labelById = useMemo(() => {
  const m = new Map<string, string>()
  for (const s of uiStructures) {
    if (s?.id && s?.label) m.set(s.id, s.label)
  }
  return m
}, [uiStructures])

const categoryById = useMemo(() => {
  const m = new Map<string, string>()
  for (const s of uiStructures) {
    if (s?.id && s?.category) m.set(s.id, String(s.category))
  }
  return m
}, [uiStructures])

function isStructureVisible(structureId: string) {
  const raw = (categoryById.get(structureId) ?? "").trim().toLowerCase()

  if (raw === "airway") return labelFilters.airway
  if (raw === "artery") return labelFilters.artery
  if (raw === "vein") return labelFilters.vein
  if (raw === "organ") return labelFilters.organ

  return true
}

const annotations = useMemo(() => {
  const arr = annotationsBySlice[String(displayedSlice)] ?? []

  return arr.filter((a) =>
    isStructureVisible(a.structureId)
  )
}, [
  annotationsBySlice,
  displayedSlice,
  labelFilters,
  categoryById,
])

const callouts: CalloutPlaced[] = useMemo(() => {
  const g = geom
  if (!g) return []
  if (!study) return []
  if (!annotations.length) return []

  const MIN_GAP_PX = 26

  const items: CalloutItem[] = annotations.map((a, idx) => {
    
      const anatomyStructures = Array.isArray(anatomyProfile)
    ? anatomyProfile
    : (anatomyProfile as { structures?: readonly any[] } | null)?.structures ?? null

    const label =
      labelById.get(a.structureId) ??
      getStructureLabel(anatomyStructures, a.structureId) ??
      a.structureId


    const px = g.i.left - g.v.left + a.x * g.i.width
    const py = g.i.top - g.v.top + a.y * g.i.height

    return {
      idx,
      structureId: a.structureId,
      x: a.x,
      y: a.y,
      px,
      py,
      isLeft: a.x < 0.5,
      label,
    }
  })

  const placed = layoutCallouts(items, g.v.height, MIN_GAP_PX)

const LABEL_GAP = isMobile ? 8 : 12

return placed.map((p) => {
  const imageLeft = g.i.left - g.v.left
  const imageRight = imageLeft + g.i.width

  const endX = isMobile
    ? p.isLeft
      ? 8
      : g.v.width - 8
    : p.isLeft
      ? imageLeft - LABEL_GAP
      : imageRight + LABEL_GAP

  return { ...p, endX, endY: p.endY }
})
}, [geom, annotations, study, anatomyProfile, labelById])

function getColorForStructureId(structureId: string) {
  const raw = (categoryById.get(structureId) ?? "").trim().toLowerCase()

  if (raw === "airway") return CATEGORY_COLORS.airway
  if (raw === "artery") return CATEGORY_COLORS.artery
  if (raw === "vein") return CATEGORY_COLORS.vein
  if (raw === "organ") return CATEGORY_COLORS.organ

  // fallback si la estructura no tiene categoría
  return "#999"
}
/* END [3.6] MEMOS :: DERIVED */


  /* =====================================================
     [3.6.x] HELPERS :: safeParseAnnotations
     ===================================================== */
  function safeParseAnnotations(json: string): AnnotationsBySlice | null {
    try {
      const data = JSON.parse(json)

      // Caso 1: wrapper con annotationsBySlice
      if (data && typeof data === 'object' && (data as any).annotationsBySlice) {
        return (data as any).annotationsBySlice as AnnotationsBySlice
      }

      // Caso 2: plano (Record<string, Annotation[]>)
      if (data && typeof data === 'object') {
        return data as AnnotationsBySlice
      }

      return null
    } catch {
      return null
    }
  }
  /* END [3.6.x] HELPERS :: safeParseAnnotations */


  /* =====================================================
     [3.6.x] HELPERS :: labels
     ===================================================== */
  
  const KEY_SLICE_LABELS_ES: Record<number, string> = {
    14: 'Arco aórtico',
    21: 'Carina',
    27: 'Hilios',
    33: 'Corazón (medio)',
    39: 'VCI / Bases',
  }
  /* END [3.6.x] HELPERS :: labels */


  /* =====================================================
     [3.7] EFFECT :: mounted flag
     ===================================================== */
  useEffect(() => {
    setMounted(true)
  }, [])
  /* END [3.7] EFFECT :: mounted flag */


  /* =====================================================
     [3.8] EFFECT :: detect mobile (resize < 768)
     ===================================================== */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()

    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  /* END [3.8] EFFECT :: detect mobile */


/* =====================================================
   [3.9.1] HELPER :: contained image rect (object-fit: contain)
   Purpose (EN): get the real displayed image box inside the <img> element
   Propósito (ES): obtener la caja real de la imagen dentro del <img> (con contain)
   Where: Page() -> helpers -> used by geometry + author clicks + callouts
   ===================================================== */
  function getContainedImageRectPx(imgEl: HTMLImageElement, imgRect: DOMRect) {
    const natW = imgEl.naturalWidth || 0
    const natH = imgEl.naturalHeight || 0

    // Fallback: if not loaded, assume full element rect
    if (!natW || !natH) {
      return { left: imgRect.left, top: imgRect.top, width: imgRect.width, height: imgRect.height }
    }

    const containerW = imgRect.width
    const containerH = imgRect.height
    const imgAspect = natW / natH
    const containerAspect = containerW / containerH

    let drawW = containerW
    let drawH = containerH
    let offsetX = 0
    let offsetY = 0

    // object-fit: contain => fit by limiting dimension
    if (imgAspect > containerAspect) {
      // image is wider -> full width, letterbox top/bottom
      drawW = containerW
      drawH = containerW / imgAspect
      offsetY = (containerH - drawH) / 2
    } else {
      // image is taller -> full height, letterbox left/right
      drawH = containerH
      drawW = containerH * imgAspect
      offsetX = (containerW - drawW) / 2
    }

    return {
      left: imgRect.left + offsetX,
      top: imgRect.top + offsetY,
      width: drawW,
      height: drawH,
    }
  }
  /* END [3.9.x] HELPER :: contained image rect */

useEffect(() => {
  setImageReady(false)
  setGeom(null)
}, [imageUrl])

  /* =====================================================
   [3.10] EFFECT :: callout geometry (viewer + image rects)
   Purpose (EN): recompute viewer/image rects after image load + layout reflow
   Propósito (ES): recalcular rects de viewer/imagen tras load + reflow de layout
   Where: Page() -> effects -> geometry used by callouts/dots/labels
   ===================================================== */

  useEffect(() => {
  const update = () => {
    const v = viewerRef.current
    const i = imgRef.current
    if (!v || !i) return

    const vr = v.getBoundingClientRect()
    const ir = i.getBoundingClientRect()
    const cr = getContainedImageRectPx(i, ir)

    if (vr.width <= 0 || vr.height <= 0) return
    if (ir.width <= 0 || ir.height <= 0) return
    if (cr.width <= 0 || cr.height <= 0) return

    setImageReady(true)

    setGeom({
      v: {
        left: vr.left,
        top: vr.top,
        width: vr.width,
        height: vr.height,
        right: vr.right,
        bottom: vr.bottom,
      },
      i: {
        left: cr.left,
        top: cr.top,
        width: cr.width,
        height: cr.height,
        right: cr.left + cr.width,
        bottom: cr.top + cr.height,
      },
    })
  }

  const raf1 = window.requestAnimationFrame(() => {
    update()
    window.requestAnimationFrame(update)
  })

  window.addEventListener('resize', update)

  const img = imgRef.current
  if (img) img.addEventListener('load', update)

  return () => {
    window.cancelAnimationFrame(raf1)
    window.removeEventListener('resize', update)
    if (img) img.removeEventListener('load', update)
  }
}, [imageUrl, isMobile])
  /* END [3.10] EFFECT :: callout geometry */



  /* =====================================================
     [3.11] EFFECT :: preload neighbor slices
     ===================================================== */
  useEffect(() => {
    if (!study) return
    if (TOTAL_SLICES <= 0) return

    const RANGE = 25
    const urls: string[] = []

    for (let i = slice - RANGE; i <= slice + RANGE; i++) {
      if (i < 0 || i >= study.slicesCount) continue
      urls.push(buildSliceUrl(study, i))
    }

    for (const url of urls) {
      if (preloadedRef.current.has(url)) continue
      preloadedRef.current.add(url)
      const img = new Image()
      img.src = url
    }
  }, [study, slice, TOTAL_SLICES])
  /* END [3.11] EFFECT :: preload */


  /* =====================================================
     [3.12] EFFECT :: reset defaults on study change
     ===================================================== */
useEffect(() => {
  if (!uiStructures.length) return

  const saved = selectedStructureId
  const exists = saved && uiStructures.some((s) => s.id === saved)

  setActiveStructure(exists ? saved : uiStructures[0].id)
  setSlice(0)
}, [studyId, uiStructures, selectedStructureId])

  /* END [3.12] EFFECT :: reset defaults */


  /* =====================================================
   [3.13] EFFECT :: author load/save
   - AUTHOR primero intenta cargar annotations.json publicado
   - si no existe, usa localStorage como fallback
   ===================================================== */
const storageKey = `anatoslice:${studyId}:annotations`

useEffect(() => {
  if (!studyId) return
  if (!study) return
  if (!isAuthor) return

  const s = study // snapshot para TypeScript

  let cancelled = false

  async function loadAuthorAnnotations() {
    try {
      const res = await fetch(`${s.basePath}/annotations.json?v=${Date.now()}`, {
        cache: 'no-store',
      })

      if (res.ok) {
        const text = await res.text()
        const parsed = safeParseAnnotations(text)

        if (parsed && !cancelled) {
          const normalized: AnnotationsBySlice = {}

          for (const [k, arr] of Object.entries(parsed)) {
            const idx = Number(k)
            if (!Number.isFinite(idx) || !Array.isArray(arr)) continue

            normalized[String(idx)] = arr
              .filter((it) => it && typeof it === 'object')
              .map((it: any) => ({
                structureId: String(it.structureId ?? 'unknown'),
                x: Number(it.x),
                y: Number(it.y),
              }))
              .filter((it) => Number.isFinite(it.x) && Number.isFinite(it.y))
          }

          setAnnotationsBySlice(normalized)
          setLastLoadedFile('Curated (public annotations.json)')
          return
        }
      }
    } catch {
      // sigue a localStorage
    }

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        if (!cancelled) {
          setAnnotationsBySlice({})
          setLastLoadedFile('—')
        }
        return
      }

      const parsed = safeParseAnnotations(raw)
      if (!parsed) {
        if (!cancelled) {
          setAnnotationsBySlice({})
          setLastLoadedFile('—')
        }
        return
      }

      if (!cancelled) {
        setAnnotationsBySlice(parsed)
        setLastLoadedFile('Auto (localStorage)')
      }
    } catch {
      if (!cancelled) {
        setAnnotationsBySlice({})
        setLastLoadedFile('—')
      }
    }
  }

  loadAuthorAnnotations()

  return () => {
    cancelled = true
  }
}, [studyId, study, isAuthor]) // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  if (!studyId) return
  if (!isAuthor) return
  try {
    localStorage.setItem(storageKey, JSON.stringify(annotationsBySlice))
  } catch {
    // no-op
  }
}, [studyId, isAuthor, annotationsBySlice])
/* END [3.13] EFFECT :: author load/save */

  /* =====================================================
     [3.14] EFFECT :: load curated annotations.json (PUBLIC)
     ===================================================== */
  useEffect(() => {
    if (!study) return
    if (isAuthor) return

    const s = study // snapshot: evita "study possibly undefined" dentro del async
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`${s.basePath}/annotations.json?v=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No annotations.json')

        const text = await res.text()
        const parsed = safeParseAnnotations(text)
        if (!parsed) return

        const normalized: AnnotationsBySlice = {}

        for (const [k, arr] of Object.entries(parsed)) {
          const idx = Number(k)
          if (!Number.isFinite(idx) || !Array.isArray(arr)) continue

          normalized[String(idx)] = arr
            .filter((it) => it && typeof it === 'object')
            .map((it: any) => ({
              structureId: String(it.structureId ?? 'unknown'),
              x: Number(it.x),
              y: Number(it.y),
            }))
            .filter((it) => Number.isFinite(it.x) && Number.isFinite(it.y))
        }

        if (!cancelled) setAnnotationsBySlice(normalized)
        if (!cancelled) setLastLoadedFile('Curated (public annotations.json)')
      } catch {
        if (!cancelled) setAnnotationsBySlice({})
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [study, isAuthor]) // eslint-disable-line react-hooks/exhaustive-deps
  /* END [3.14] EFFECT :: load curated annotations.json */

// Sync: cuando selectedStructureId cambia, lo usamos como activeStructure
useEffect(() => {
  if (!selectedStructureId) return
  setActiveStructure(selectedStructureId)
}, [selectedStructureId])



  /* =====================================================
     [3.15] GUARD :: study not found
     ===================================================== */
  if (!study) {
    return <div style={{ padding: 16 }}>Estudio no encontrado: {studyId}</div>
  }
  /* END [3.15] GUARD :: study not found */


  /* =====================================================
     [3.18] HANDLER :: wheel slice navigation
     ===================================================== */
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
  e.preventDefault()
  stepSlice(e.deltaY > 0 ? 1 : -1)
}
  /* END [3.18] HANDLER :: wheel slice navigation */

/* =====================================================
   [3.19] HANDLERS :: mobile pointer drag slice navigation
   ===================================================== */

function clampSlice(next: number) {
  return Math.min(TOTAL_SLICES - 1, Math.max(0, next))
}

function stepSlice(delta: number) {
  if (TOTAL_SLICES <= 0) return

  setSlice((prev) => {
    const next = clampSlice(prev + delta)
    return next === prev ? prev : next
  })
}

function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
  if (!isMobile) return
  if (e.pointerType !== "touch") return
  if (TOTAL_SLICES <= 0) return

  activeTouchPointerRef.current = e.pointerId
  touchLastStepYRef.current = e.clientY
  touchIsSwipingRef.current = false

  /*
    CLAVE:
    el viewer conserva el gesto aunque cambie
    la imagen mientras desplazamos slices.
  */
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
  if (!isMobile) return
  if (e.pointerType !== "touch") return

  if (activeTouchPointerRef.current !== e.pointerId) return

  const lastY = touchLastStepYRef.current
  if (lastY == null) return

  const dy = e.clientY - lastY

  /*
    Sensibilidad mobile.
    Cada 5 px recorridos = 1 slice.
  */
  const STEP_PX = 5

  if (Math.abs(dy) < STEP_PX) return

  const direction = dy > 0 ? +1 : -1
  const steps = Math.floor(Math.abs(dy) / STEP_PX)

  /*
    Actualizamos todos los pasos acumulados,
    pero manteniendo la referencia precisa.
  */
  stepSlice(direction * steps)

  touchLastStepYRef.current =
    lastY + direction * steps * STEP_PX

  touchIsSwipingRef.current = true

  e.preventDefault()
}

function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
  if (!isMobile) return
  if (e.pointerType !== "touch") return
  if (activeTouchPointerRef.current !== e.pointerId) return

  /*
    STOP inmediato cuando levantás el dedo.
  */
  activeTouchPointerRef.current = null
  touchLastStepYRef.current = null

  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
}

function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
  if (activeTouchPointerRef.current !== e.pointerId) return

  activeTouchPointerRef.current = null
  touchLastStepYRef.current = null
}

/* END [3.19] HANDLERS :: mobile pointer drag slice navigation */

/* =====================================================
   [3.19.x] HANDLERS :: desktop vertical mouse drag slice navigation
   ===================================================== */
function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
  if (isMobile) return
  if (e.button !== 0) return
  if (TOTAL_SLICES <= 0) return

  mouseIsDraggingRef.current = true
  mouseLastStepYRef.current = e.clientY
  mouseDidDragRef.current = false
}

function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  if (isMobile) return
  if (!mouseIsDraggingRef.current) return
  if (TOTAL_SLICES <= 0) return

  const lastY = mouseLastStepYRef.current
  if (lastY == null) return

  const dy = e.clientY - lastY
  const STEP_PX = 10

  if (Math.abs(dy) >= STEP_PX) {
    const direction = dy > 0 ? +1 : -1
    const steps = Math.floor(Math.abs(dy) / STEP_PX)

    stepSlice(direction * steps)

    mouseLastStepYRef.current =
      lastY + direction * steps * STEP_PX

    mouseDidDragRef.current = true
  }
}

function onMouseUp() {
  mouseIsDraggingRef.current = false
  mouseLastStepYRef.current = null
}

function onMouseLeave() {
  mouseIsDraggingRef.current = false
  mouseLastStepYRef.current = null
}
/* END [3.19.x] HANDLERS :: desktop vertical mouse drag slice navigation */



  /* =====================================================
     [3.20] fx :: upsertAnnotationAtSlice (AUTHOR)
     ===================================================== */
  function upsertAnnotationAtSlice(sliceIndex: number, ann: Annotation) {
    setAnnotationsBySlice((prev) => {
      const current = prev[String(sliceIndex)] ?? []
      const withoutSame = current.filter((a) => a.structureId !== ann.structureId)
      return { ...prev, [String(sliceIndex)]: [...withoutSame, ann] }
    })
  }
  /* END [3.20] fx :: upsertAnnotationAtSlice (AUTHOR) */


  /* =====================================================
     [3.21] fx :: deleteAnnotationAt (AUTHOR)
     ===================================================== */
  function deleteAnnotationAt(sliceIndex: number, idx: number) {
    setAnnotationsBySlice((prev) => {
      const current = prev[String(sliceIndex)] ?? []
      if (!current.length) return prev
      const next = current.filter((_, i) => i !== idx)
      return { ...prev, [String(sliceIndex)]: next }
    })
  }
  /* END [3.21] fx :: deleteAnnotationAt (AUTHOR) */


  /* =====================================================
   [3.22] HANDLER :: addPointAtClick (AUTHOR)
   ===================================================== */
function addPointAtClick(e: React.MouseEvent<HTMLDivElement>) {
  if (!isAuthor) return

  if (mouseDidDragRef.current) {
    mouseDidDragRef.current = false
    return
  }

  const img = imgRef.current
  if (!img) return

  // si el último gesto fue swipe, no marcar punto
  if (touchIsSwipingRef.current) {
    touchIsSwipingRef.current = false
    return
  }

  const iRect = img.getBoundingClientRect()
  const cRect = getContainedImageRectPx(img, iRect)

  const relX = (e.clientX - cRect.left) / cRect.width
  const relY = (e.clientY - cRect.top) / cRect.height

  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return

  const sid = selectedStructureId || activeStructure
  if (!sid) return // no marcar si no hay estructura elegida

  const ann: Annotation = { structureId: sid, x: relX, y: relY }

  upsertAnnotationAtSlice(slice, ann)
}
/* END [3.22] HANDLER :: addPointAtClick (AUTHOR) */


  /* =====================================================
     [3.23] HANDLER :: exportAnnotationsJson (AUTHOR)
     ===================================================== */
  function exportAnnotationsJson() {
    if (!study) return
    const s = study
    
    const normalized: Record<string, Annotation[]> = {}

    for (const [k, arr] of Object.entries(annotationsBySlice ?? {})) {
      if (!Array.isArray(arr)) continue

      normalized[String(k)] = arr
        .filter((it) => it && typeof it === 'object')
        .map((it: any) => ({
          structureId: String(it.structureId ?? 'unknown'),
          x: Number(it.x),
          y: Number(it.y),
        }))
        .filter((it) => Number.isFinite(it.x) && Number.isFinite(it.y))
    }

    const payload = {
      version: 1,
      studyId: s.id,
      createdAt: new Date().toISOString(),
      annotationsBySlice: normalized,
    }

    downloadJson(payload, 'annotations.json')
  }
  /* END [3.23] HANDLER :: exportAnnotationsJson (AUTHOR) */

/* =====================================================
   [3.25] HANDLER :: clearAllAnnotations (AUTHOR)
   ===================================================== */
function clearAllAnnotations() {
  if (!isAuthor) return

  const ok = window.confirm(
    "Esto va a borrar TODAS las anotaciones (todas las slices) para rehacer desde cero. ¿Continuar?"
  )
  if (!ok) return

  setAnnotationsBySlice({})
  setLastLoadedFile("— (cleared)")
}
/* END [3.25] HANDLER :: clearAllAnnotations (AUTHOR) */


  /* =====================================================
   [3.24] fx :: layoutCallouts
   ===================================================== */
function layoutCallouts(items: CalloutItem[], viewH: number, minGapPx: number) {
  const TOP_LIMIT = 16
  const BOTTOM_LIMIT = viewH - 16

  const placeSide = (side: CalloutItem[]) => {
    const sorted = [...side].sort((a, b) => a.py - b.py)

    const placed: CalloutPlaced[] = sorted.map((it) => ({
      ...it,
      endX: 0,
      endY: it.py,
    }))

    if (placed.length === 0) return placed

    // 1) Pasada descendente: evita superposición hacia abajo.
    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1]
      const curr = placed[i]

      if (curr.endY < prev.endY + minGapPx) {
        curr.endY = prev.endY + minGapPx
      }
    }

    // 2) Si se pasa del borde inferior, subir toda la columna.
    const overflowBottom = placed[placed.length - 1].endY - BOTTOM_LIMIT

    if (overflowBottom > 0) {
      for (const p of placed) {
        p.endY -= overflowBottom
      }
    }

    // 3) Pasada ascendente: evita superposición después del ajuste inferior.
    for (let i = placed.length - 2; i >= 0; i--) {
      const next = placed[i + 1]
      const curr = placed[i]

      if (curr.endY > next.endY - minGapPx) {
        curr.endY = next.endY - minGapPx
      }
    }

    // 4) Si se pasa del borde superior, bajar toda la columna.
    const overflowTop = TOP_LIMIT - placed[0].endY

    if (overflowTop > 0) {
      for (const p of placed) {
        p.endY += overflowTop
      }
    }

    // 5) Último clamp defensivo.
    for (const p of placed) {
      p.endY = Math.max(TOP_LIMIT, Math.min(BOTTOM_LIMIT, p.endY))
    }

    return placed
  }

  const left = items.filter((i) => i.isLeft)
  const right = items.filter((i) => !i.isLeft)

  return [...placeSide(left), ...placeSide(right)]
}
/* END [3.24] fx :: layoutCallouts */


  /* =====================================================
     [3.26] STYLE HELPERS
     ===================================================== */
  
  const sideBtnStyle: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    cursor: 'pointer',
    padding: isMobile ? '10px 12px' : '14px 16px',
    fontSize: isMobile ? 13 : 15,
    marginBottom: isMobile ? 6 : 10,
    lineHeight: 1.2,
    transition: 'background 0.15s ease, transform 0.05s ease',
  }

  const calloutLabelStyle: React.CSSProperties = {
    pointerEvents: 'none',
    background: 'rgba(0, 0, 0, 0.90)',
    color: 'white',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transform: 'translate(0, -50%)',
    fontSize: isMobile ? 11 : 14,
    padding: isMobile ? '4px 7px' : '6px 8px',
    maxWidth: isMobile ? 160 : 260,
  }

    const calloutDotStyle = (structureId: string): React.CSSProperties => ({
    width: isMobile ? 3 : 5,
    height: isMobile ? 3 : 5,
    borderRadius: 999,
    background: getColorForStructureId(structureId),
    border: isMobile
      ? '1px solid rgba(0,0,0,0.6)'
      : '1.5px solid rgba(0,0,0,0.6)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
  })

  
  /* END [3.26] STYLE HELPERS */



/* ============= R E T U R N principal ==================*/



  /* =====================================================
     [3.30] JSX :: return
     ===================================================== */
  return (
    <div className="appRoot">

      
      {/* =====================================================
         [3.30.2] JSX :: viewer
         ===================================================== */}
      <main
  ref={viewerRef}
  onWheel={onWheel}
  onClick={isAuthor ? addPointAtClick : undefined}
  onPointerDown={onPointerDown}
onPointerMove={onPointerMove}
onPointerUp={onPointerUp}
onPointerCancel={onPointerCancel}
  onMouseDown={onMouseDown}
  onMouseMove={onMouseMove}
  onMouseUp={onMouseUp}
  onMouseLeave={onMouseLeave}
  className="viewer"
>
       

        {/* [3.30.2.2] Viewer :: slice counter */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 10,
            color: 'white',
            zIndex: 9999,
            fontSize: 12,
            opacity: 0.9,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '6px 8px',
          }}
        >
          Corte {displayedSlice + 1} / {TOTAL_SLICES}
        </div>

        {/* [3.30.2.3] Viewer :: image */}
        
 <img
  ref={imgRef}
  src={displayedImageUrl || imageUrl}
  alt={study?.title ?? "Imagen del estudio"}
  draggable={false}
  className="viewerImg"
  onLoad={() => {
    setImageReady(true)

    window.requestAnimationFrame(() => {
      const v = viewerRef.current
      const i = imgRef.current
      if (!v || !i) return

      const vr = v.getBoundingClientRect()
      const ir = i.getBoundingClientRect()
      const cr = getContainedImageRectPx(i, ir)

      setGeom({
        v: {
          left: vr.left,
          top: vr.top,
          width: vr.width,
          height: vr.height,
          right: vr.right,
          bottom: vr.bottom,
        },
        i: {
          left: cr.left,
          top: cr.top,
          width: cr.width,
          height: cr.height,
          right: cr.left + cr.width,
          bottom: cr.top + cr.height,
        },
      })
    })
  }}
/>




        {/* =====================================================
           [3.30.2.4] Viewer :: callouts
           ===================================================== */}
        {!isMobile && geom && callouts.length > 0 && (
          <>
            {/* [3.30.2.4.1] SVG lines */}
            <svg
              width="100%"
              height="100%"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 8000,
                pointerEvents: 'none',
              }}
            >
              {callouts.map((c) => (
                <line
                  key={`ln-${c.idx}`}
                  x1={c.px}
                  y1={c.py}
                  x2={c.endX}
                  y2={c.endY}
                  stroke={getColorForStructureId(c.structureId)}
                  strokeWidth="2"
                />
              ))}
            </svg>

            {/* [3.30.2.4.2] dots */}
            {callouts.map((c) => (
  <div
    key={`pt-${c.idx}`}
    onContextMenu={(e) => {
      // Click derecho => borrar puntual (solo author)
      if (!isAuthor) return
      e.preventDefault()
      e.stopPropagation()
      deleteAnnotationAt(slice, c.idx)
    }}
    style={{
      position: 'absolute',
      left: c.px,
      top: c.py,
      transform: 'translate(-50%, -50%)',
      zIndex: 8500,

      // Importante: antes estaba 'none' y no capturaba eventos.
      // Así el click derecho funciona.
      pointerEvents: isAuthor ? 'auto' : 'none',

      // Un poco más "fácil de agarrar" con el mouse:
      width: isMobile ? 16 : 18,
      height: isMobile ? 16 : 18,
      borderRadius: 999,
      display: 'grid',
      placeItems: 'center',
      background: 'transparent',
      cursor: isAuthor ? 'context-menu' : 'default',
    }}
    title={isAuthor ? 'Click derecho: borrar punto' : undefined}
  >
    {/* dot visual real */}
    <div
      style={{
        ...calloutDotStyle(c.structureId),
      }}
    />
  </div>
))}

            {/* [3.30.2.4.3] labels */}
            {callouts.map((c) => (
  <div
    key={`lb-${c.idx}`}
    style={{
      position: 'absolute',
      top: c.endY,
      zIndex: 9000,
      ...calloutLabelStyle,
      left: c.endX,
      transform: isMobile
  ? c.isLeft
    ? 'translateX(0) translateY(-50%)'
    : 'translateX(-100%) translateY(-50%)'
  : c.isLeft
    ? 'translateX(-100%) translateY(-50%)'
    : 'translateX(0) translateY(-50%)',
    }}
  >
    {c.label}
  </div>
))}
          </>
        )}
        {/* END [3.30.2.4] Viewer :: callouts */}


{/* [3.30.2.5] Viewer :: label filters */}
<div
  onClick={(e) => e.stopPropagation()}
  style={{
    position: 'absolute',
    top: isMobile ? 8 : 12,
    right: isMobile ? 8 : 14,
    zIndex: 9999,
    width: isMobile ? 118 : 168,
    padding: isMobile ? 8 : 10,
    borderRadius: 18,
    background: 'rgba(12, 18, 28, 0.72)',
    border: '1px solid rgba(255,255,255,0.16)',
    boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }}
>
  <div
    style={{
      color: 'rgba(255,255,255,0.72)',
      fontSize: isMobile ? 10 : 11,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: isMobile ? 6 : 8,
      paddingLeft: 4,
    }}
  >
    Categorías
  </div>

  {[
    { key: 'airway', label: 'Vía aérea' },
    { key: 'artery', label: 'Arterias' },
    { key: 'vein', label: 'Venas' },
    { key: 'organ', label: 'Órganos' },
  ].map((item) => {
    const key = item.key as keyof typeof labelFilters
    const active = labelFilters[key]

    return (
      <button
        key={item.key}
        onClick={() =>
          setLabelFilters((p) => ({
            ...p,
            [key]: !p[key],
          }))
        }
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 6 : 8,
          padding: isMobile ? '6px 7px' : '8px 9px',
          marginTop: isMobile ? 3 : 4,
          borderRadius: 12,
          border: active
            ? '1px solid rgba(255,255,255,0.18)'
            : '1px solid rgba(255,255,255,0.06)',
          background: active
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(255,255,255,0.035)',
          color: active ? '#ffffff' : 'rgba(255,255,255,0.42)',
          fontWeight: active ? 750 : 500,
          fontSize: isMobile ? 11 : 13,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
        }}
      >
        <span
          style={{
            width: isMobile ? 7 : 9,
            height: isMobile ? 7 : 9,
            borderRadius: 999,
            background: CATEGORY_COLORS[key],
            opacity: active ? 1 : 0.35,
            flex: '0 0 auto',
            boxShadow: active ? `0 0 10px ${CATEGORY_COLORS[key]}` : 'none',
          }}
        />

        <span>{item.label}</span>
      </button>
    )
  })}
</div>
{/* END [3.30.2.5] Viewer :: label filters */}


        {/* [3.30.2.6] Viewer :: prev/next */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            stepSlice(-1)
          }}
          disabled={slice <= 0}
          style={{
            position: 'fixed',
            bottom: isMobile ? 12 : 20,
            left: isMobile ? 12: 20,
            zIndex: 9999,
            background: slice <= 0 ? '#333' : '#2563eb',
            color: 'white',
            border: 'none',
            padding: isMobile ? '5px 8px' : '10px 14px',
            fontSize: isMobile ? 11 : 14,
            borderRadius: 10,
            cursor: slice <= 0 ? 'not-allowed' : 'pointer',
            opacity: slice <= 0 ? 0.5 : 1,
          }}
        >
          ◀ Prev
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            stepSlice(1)
          }}
          disabled={slice >= TOTAL_SLICES - 1}
          style={{
            position: 'fixed',
            bottom: isMobile ? 12 : 20,
            left: isMobile ? 70 : 110,
            zIndex: 9999,
            background: slice >= TOTAL_SLICES - 1 ? '#333' : '#2563eb',
            color: 'white',
            border: 'none',
            padding: isMobile ? '5px 8px' : '10px 14px',
            fontSize: isMobile ? 11 : 14,
            borderRadius: 10,
            cursor: slice >= TOTAL_SLICES - 1 ? 'not-allowed' : 'pointer',
            opacity: slice >= TOTAL_SLICES - 1 ? 0.5 : 1,
          }}
        >
          Next ▶
        </button>

        {/* =====================================================
           [3.30.2.7] Viewer :: author tools (overlay)
           ===================================================== */}
        {mounted && isAuthor && (
          <div
            style={{
              position: 'absolute',
              top: 86,
              left: 12,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 10,
              color: 'white',
              width: 340,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
              Active structure:
            </div>

            <div style={{ marginBottom: 10, maxHeight: "60vh", overflow: "auto" }}>
  <StructurePicker
    structures={uiStructures as any}
    selectedStructureId={selectedStructureId || activeStructure}
    onSelect={(id) => {
      setSelectedStructureId(id)  // guarda “última usada”
      setActiveStructure(id)      // activa inmediatamente
    }}
  />
</div>


            <div style={{ marginTop: 10 }}>
  <button
    onClick={exportAnnotationsJson}
    style={{
      width: '100%',
      padding: '8px 10px',
      cursor: 'pointer',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(0,0,0,0.35)',
      color: 'white',
      marginBottom: 8,
    }}
  >
    Exportar annotations.json
  </button>

  <button
    onClick={clearAllAnnotations}
    style={{
      width: '100%',
      padding: '8px 10px',
      cursor: 'pointer',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(233, 39, 39, 0.22)', // rojo (artery)
      color: 'white',
    }}
  >
    Borrar todas las anotaciones
  </button>

  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
    Pegalo en public/studies/{study.id}/annotations.json
  </div>

  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
    Fuente: {lastLoadedFile || '—'}
  </div>
</div>

            {/* Nota: deleteAnnotationAt está disponible si querés habilitar borrado por click derecho más adelante */}
          </div>
        )}
        {/* END [3.30.2.7] Viewer :: author tools */}
      </main>
      {/* END [3.30.2] JSX :: viewer */}

      {/* =====================================================
         [3.30.3] JSX :: scoped styles (CSS only)
         ===================================================== */}
      
      
      <style jsx>{`
  /* ===================================================== */
  /* [3.30.3] LAYOUT :: root                               */
  /* ===================================================== */
  .appRoot {
    height: 100dvh;
    display: flex;
    flex-direction: row;
    background: #000;
    overflow: hidden;
    min-height: 0;
  }

  /* ===================================================== */
  /* [3.30.3] VIEWER                                       */
  /* ===================================================== */
  .viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  touch-action: none;

  padding-top: 24px;
  padding-bottom: 24px;
}

  .viewerImg {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

`}</style>


      {/* END [3.30.3] JSX :: scoped styles */}
    </div>
  )
  /* END [3.30] JSX :: return */
}
