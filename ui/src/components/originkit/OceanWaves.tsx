"use client"

import type * as React from "react"
import { useEffect, useRef } from "react"

const DEFAULTS = {
    colorA: "#00FFF0",
    colorB: "#004100",
    colors: [] as string[],
    count: 1,
    rings: 20,
    thickness: 20,
    overlap: 20,
    speed: 20,
    direction: "right",
    followPointer: true,
    strength: 11,
}

type Config = {
    colorA: string
    colorB: string
    colors: string[]
    count: number
    rings: number
    thickness: number
    overlap: number
    speed: number
    direction: string
    followPointer: boolean
    strength: number
}

function clamp(v: number, lo: number, hi: number, fallback: number): number {
    const n = typeof v === "number" && isFinite(v) ? v : fallback
    return Math.max(lo, Math.min(hi, n))
}

function settingsFor(cfg: Config) {
    return {
        radius: 116 - clamp(cfg.count, 1, 20, DEFAULTS.count) * 4.4,
        rings: Math.round(2 + clamp(cfg.rings, 1, 20, DEFAULTS.rings) * 0.4),
        thickness: 0.4 + clamp(cfg.thickness, 1, 20, DEFAULTS.thickness) * 0.22,

        overlap: 0.24 + clamp(cfg.overlap, 1, 20, DEFAULTS.overlap) * 0.019,
        outline: clamp(cfg.thickness, 0, 20, DEFAULTS.thickness) * 0.09,
        speed: clamp(cfg.speed, 0, 20, DEFAULTS.speed) * 0.05,
        reach: 90 + clamp(cfg.strength, 1, 20, DEFAULTS.strength) * 22,
    }
}

function parseHex(hex: string): number[] {
    const h = (hex || "").replace("#", "").trim()
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
        ]
    }
    if (h.length >= 6) {
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ]
    }
    return [128, 128, 128]
}

function mix(a: number[], b: number[], t: number, alpha: number) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t)
    const g = Math.round(a[1] + (b[1] - a[1]) * t)
    const bl = Math.round(a[2] + (b[2] - a[2]) * t)
    return "rgba(" + r + "," + g + "," + bl + "," + alpha + ")"
}

class WaveScene {
    private container: HTMLElement
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private cfg: Config

    private width = 0
    private height = 0
    private dpr = 1
    private time = 0
    private frameId = 0
    private lastT = 0
    private disposed = false

    private px = -1
    private py = -1
    private tx = -1
    private ty = -1
    private grip = 0
    private gripTarget = 0

    constructor(container: HTMLElement, cfg: Config) {
        this.container = container
        this.cfg = cfg

        this.canvas = document.createElement("canvas")
        this.canvas.style.position = "absolute"
        this.canvas.style.inset = "0"
        this.canvas.style.width = "100%"
        this.canvas.style.height = "100%"
        container.appendChild(this.canvas)

        const ctx = this.canvas.getContext("2d")
        if (!ctx) throw new Error("no 2d context")
        this.ctx = ctx

        container.addEventListener("pointerenter", this.onEnter)
        container.addEventListener("pointerleave", this.onLeave)
        container.addEventListener("pointercancel", this.onLeave)
        container.addEventListener("pointermove", this.onMove)
    }

    private onEnter = () => {
        this.gripTarget = 1
    }
    private onLeave = () => {
        this.gripTarget = 0
    }
    private onMove = (e: PointerEvent) => {
        const rect = this.container.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        this.tx = e.clientX - rect.left
        this.ty = e.clientY - rect.top
        if (this.px < 0) {
            this.px = this.tx
            this.py = this.ty
        }
    }

    start() {
        this.lastT = performance.now()
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
        let painted = 0
        const loop = () => {
            if (!reduced) this.frameId = requestAnimationFrame(loop)
            const now = performance.now()
            if (!document.hidden && now - painted > 40) { this.step(); painted = now }
        }
        loop()
    }

    setSize(width: number, height: number) {
        if (this.disposed || width <= 0 || height <= 0) return
        this.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        this.width = width
        this.height = height
        this.canvas.width = Math.round(width * this.dpr)
        this.canvas.height = Math.round(height * this.dpr)
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }

    updateConfig(cfg: Config) {
        if (this.disposed) return

        this.cfg = cfg
    }

    private step() {
        if (this.disposed || this.width <= 0) return
        const now = performance.now()
        let dt = (now - this.lastT) / 1000
        this.lastT = now
        if (!isFinite(dt) || dt < 0) dt = 0
        if (dt > 0.05) dt = 0.05

        const S = settingsFor(this.cfg)
        const ctx = this.ctx
        this.time += dt

        if (this.px >= 0) {
            const k = 1 - Math.exp(-dt * 10)
            this.px += (this.tx - this.px) * k
            this.py += (this.ty - this.py) * k
        }
        const hover = this.cfg.followPointer && this.px >= 0 ? this.gripTarget : 0
        this.grip += (hover - this.grip) * (1 - Math.exp(-dt * 3.5))

        ctx.clearRect(0, 0, this.width, this.height)
        ctx.lineCap = "butt"

        const palette = (
            this.cfg.colors && this.cfg.colors.length
                ? this.cfg.colors
                : [this.cfg.colorA || DEFAULTS.colorA]
        ).map(parseHex)
        const b = parseHex(this.cfg.colorB || DEFAULTS.colorB)
        const R = Math.max(14, S.radius)
        const rowH = R * S.overlap

        const cols = Math.ceil(this.width / R) + 4
        const rows = Math.ceil(this.height / rowH) + 4

        const travel = this.time * S.speed * 40
        const driftX =
            this.cfg.direction === "left"
                ? -(travel % R)
                : this.cfg.direction === "right" || !this.cfg.direction
                  ? travel % R
                  : 0
        const driftY =
            this.cfg.direction === "up"
                ? -(travel % (rowH * 2))
                : this.cfg.direction === "down"
                  ? travel % (rowH * 2)
                  : 0
        const reach2 = S.reach * S.reach

        for (let r = -2; r < rows; r++) {
            const y = r * rowH + driftY

            const shift = (((r % 2) + 2) % 2) * R * 0.5
            const crest =
                palette[(((r % palette.length) + palette.length) % palette.length)]
            for (let c = -2; c < cols; c++) {
                const x = c * R + shift + driftX

                let lift = 0
                if (this.grip > 0.01) {
                    const dx = x - this.px
                    const dy = y - this.py
                    const d2 = dx * dx + dy * dy
                    if (d2 < reach2) {
                        lift = (1 - Math.sqrt(d2) / S.reach) * this.grip
                    }
                }

                for (let i = S.rings; i >= 1; i--) {
                    const t = i / S.rings

                    const band = i % 2 === 0 ? 0.15 : 0.75
                    ctx.fillStyle = mix(
                        b,
                        crest,
                        Math.min(1, band * (0.35 + t * 0.75) + lift * 0.7),
                        1
                    )
                    ctx.beginPath()
                    ctx.arc(x, y, R * t, Math.PI, Math.PI * 2)
                    ctx.closePath()
                    ctx.fill()

                    if (S.outline > 0.02 && i === S.rings) {
                        ctx.strokeStyle = mix(b, crest, 0.9, 0.5)
                        ctx.lineWidth = S.outline * 2
                        ctx.stroke()
                    }
                }
            }
        }
    }

    dispose() {
        this.disposed = true
        cancelAnimationFrame(this.frameId)
        this.container.removeEventListener("pointerenter", this.onEnter)
        this.container.removeEventListener("pointerleave", this.onLeave)
        this.container.removeEventListener("pointercancel", this.onLeave)
        this.container.removeEventListener("pointermove", this.onMove)
        if (this.canvas.parentNode === this.container) {
            this.container.removeChild(this.canvas)
        }
    }
}

export interface SeigaihaProps {
    colorA?: string
    colorB?: string
    colors?: string[]
    count?: number
    rings?: number
    thickness?: number
    overlap?: number
    speed?: number
    direction?: string
    followPointer?: boolean
    strength?: number
    style?: React.CSSProperties
}

export default function Seigaiha(props: SeigaihaProps) {
    const {
        colorA = DEFAULTS.colorA,
        colorB = DEFAULTS.colorB,
        colors = DEFAULTS.colors,
        count = DEFAULTS.count,
        rings = DEFAULTS.rings,
        thickness = DEFAULTS.thickness,
        overlap = DEFAULTS.overlap,
        speed = DEFAULTS.speed,
        direction = DEFAULTS.direction,
        followPointer = DEFAULTS.followPointer,
        strength = DEFAULTS.strength,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement | null>(null)
    const sceneRef = useRef<WaveScene | null>(null)

    const cfgRef = useRef<Config>(DEFAULTS)
    const config: Config = {
        colorA,
        colorB,
        colors,
        count,
        rings,
        thickness,
        overlap,
        speed,
        direction,
        followPointer,
        strength,
    }

    useEffect(() => {
        cfgRef.current = config
    })

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        let scene: WaveScene
        try {
            scene = new WaveScene(container, cfgRef.current)
        } catch {
            return
        }
        sceneRef.current = scene
        scene.setSize(container.clientWidth, container.clientHeight)
        scene.start()

        const ro = new ResizeObserver(() => {
            scene.setSize(container.clientWidth, container.clientHeight)
        })
        ro.observe(container)
        return () => {
            ro.disconnect()
            scene.dispose()
            sceneRef.current = null
        }
    }, [])

    useEffect(() => {
        sceneRef.current?.updateConfig(cfgRef.current)
    }, [
        colorA,
        colorB,
        colors,
        count,
        rings,
        thickness,
        overlap,
        speed,
        direction,
        followPointer,
        strength,
    ])

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label="Overlapping wave scales in the seigaiha pattern"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 120,
                minHeight: 120,
                overflow: "hidden",
                ...style,
            }}
        />
    )
}

Seigaiha.displayName = "Seigaiha"


