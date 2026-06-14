import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { STARS, CONSTELLATIONS } from '../data/stars'
import type { Star } from '../types'

export const useSkyStore = defineStore('sky', () => {
  const viewDate = ref(new Date())
  const zoom = ref(1.0)
  const panX = ref(0)
  const panY = ref(0)
  const showLabels = ref(true)
  const showConstLines = ref(true)
  const showGrid = ref(true)
  const selectedStar = ref<Star | null>(null)
  const searchQuery = ref('')
  const latitude = ref(39.9) // Beijing default

  // Playback state
  const playbackEnabled = ref(false)
  const playbackPlaying = ref(false)
  const playbackProgress = ref(0) // 0 - 1
  const playbackSpeed = ref(600) // seconds of real sky per real second (default: 10 min = 600x)
  const playbackStartDate = ref(new Date())
  const playbackEndDate = ref(new Date())
  let playbackAnimId = 0
  let playbackLastFrame = 0

  function computeNightRange(baseDate: Date) {
    const d = new Date(baseDate)
    d.setHours(18, 0, 0, 0) // 6 PM same day
    const start = new Date(d)
    d.setHours(d.getHours() + 12) // 6 AM next day
    const end = new Date(d)
    return { start, end }
  }

  function initPlayback(date?: Date) {
    const base = date || viewDate.value
    const { start, end } = computeNightRange(base)
    playbackStartDate.value = start
    playbackEndDate.value = end
    playbackProgress.value = 0
    viewDate.value = new Date(start)
  }

  function startPlayback() {
    if (!playbackEnabled.value) return
    if (playbackPlaying.value) return
    playbackPlaying.value = true
    playbackLastFrame = performance.now()
    tickPlayback()
  }

  function pausePlayback() {
    playbackPlaying.value = false
    if (playbackAnimId) {
      cancelAnimationFrame(playbackAnimId)
      playbackAnimId = 0
    }
  }

  function togglePlayback() {
    if (playbackPlaying.value) pausePlayback()
    else startPlayback()
  }

  function setPlaybackProgress(p: number) {
    playbackProgress.value = Math.max(0, Math.min(1, p))
    const totalMs = playbackEndDate.value.getTime() - playbackStartDate.value.getTime()
    const targetMs = playbackStartDate.value.getTime() + totalMs * playbackProgress.value
    viewDate.value = new Date(targetMs)
  }

  function tickPlayback() {
    if (!playbackPlaying.value) return
    const now = performance.now()
    const delta = (now - playbackLastFrame) / 1000
    playbackLastFrame = now

    const totalMs = playbackEndDate.value.getTime() - playbackStartDate.value.getTime()
    const advanceMs = delta * playbackSpeed.value * 1000
    const currentMs = viewDate.value.getTime() + advanceMs

    if (currentMs >= playbackEndDate.value.getTime()) {
      viewDate.value = new Date(playbackEndDate.value)
      playbackProgress.value = 1
      pausePlayback()
      return
    }

    viewDate.value = new Date(currentMs)
    playbackProgress.value = (currentMs - playbackStartDate.value.getTime()) / totalMs
    playbackAnimId = requestAnimationFrame(tickPlayback)
  }

  watch(playbackEnabled, (enabled) => {
    if (enabled) {
      initPlayback()
    } else {
      pausePlayback()
      viewDate.value = new Date()
    }
  })

  const localSiderealTime = computed(() => {
    const d = viewDate.value
    const jd = d.getTime() / 86400000 + 2440587.5
    const T = (jd - 2451545.0) / 36525.0
    let lst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + T * T * (0.000387933 - T / 38710000)
    lst = ((lst % 360) + 360) % 360
    return lst / 15 // convert to hours
  })

  const filteredStars = computed(() => {
    if (!searchQuery.value) return []
    const q = searchQuery.value.toLowerCase()
    return STARS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
  })

  function projectStar(ra: number, dec: number, cx: number, cy: number, scale: number): [number, number] {
    const ha = (localSiderealTime.value - ra) * 15 * Math.PI / 180
    const decRad = dec * Math.PI / 180
    const latRad = latitude.value * Math.PI / 180

    const alt = Math.asin(Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha))
    const az = Math.atan2(-Math.cos(decRad) * Math.sin(ha), Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(ha))

    if (alt < -0.1) return [-999, -999] // below horizon

    const r = (Math.PI / 2 - alt) * scale * 0.45
    const x = cx + panX.value + r * Math.sin(az)
    const y = cy + panY.value - r * Math.cos(az)
    return [x, y]
  }

  function starRadius(mag: number): number {
    return Math.max(1, 5 - mag) * zoom.value
  }

  function spectralColor(spectral: string): string {
    const colors: Record<string, string> = {
      'O': '#9bb0ff', 'B': '#aabfff', 'A': '#cad7ff',
      'F': '#f8f7ff', 'G': '#fff4ea', 'K': '#ffd2a1', 'M': '#ffcc6f'
    }
    return colors[spectral] || '#ffffff'
  }

  function selectStar(x: number, y: number, cx: number, cy: number, scale: number) {
    let closest: Star | null = null
    let minDist = 20
    for (const star of STARS) {
      const [sx, sy] = projectStar(star.ra, star.dec, cx, cy, scale)
      const dist = Math.hypot(sx - x, sy - y)
      if (dist < minDist) { minDist = dist; closest = star }
    }
    selectedStar.value = closest
  }

  return {
    viewDate, zoom, panX, panY, showLabels, showConstLines, showGrid,
    selectedStar, searchQuery, latitude, localSiderealTime, filteredStars,
    playbackEnabled, playbackPlaying, playbackProgress, playbackSpeed,
    playbackStartDate, playbackEndDate,
    initPlayback, startPlayback, pausePlayback, togglePlayback, setPlaybackProgress,
    projectStar, starRadius, spectralColor, selectStar,
    STARS, CONSTELLATIONS
  }
})
