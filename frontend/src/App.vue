<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-72 bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
      <h1 class="text-xl font-bold text-blue-400">天文星图渲染器</h1>

      <!-- Search -->
      <div>
        <input v-model="store.searchQuery" placeholder="搜索天体..." class="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
        <div v-if="store.filteredStars.length" class="mt-1">
          <div v-for="s in store.filteredStars" :key="s.name"
            @click="store.selectedStar = s"
            class="bg-gray-800 p-2 rounded mt-1 cursor-pointer hover:bg-gray-700 text-sm">
            {{ s.name }} <span class="text-gray-400">mag {{ s.mag }}</span>
          </div>
        </div>
      </div>

      <!-- Star Playback -->
      <div class="bg-gray-800 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-semibold text-blue-300">🌌 星空回放</label>
          <label class="flex items-center gap-2 text-xs">
            <input type="checkbox" v-model="store.playbackEnabled" /> 启用
          </label>
        </div>

        <template v-if="store.playbackEnabled">
          <div class="flex items-center gap-2 mb-2">
            <button
              @click="store.togglePlayback()"
              class="flex-1 py-1.5 rounded font-semibold text-sm transition-colors"
              :class="store.playbackPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'">
              {{ store.playbackPlaying ? '⏸ 暂停' : '▶ 播放' }}
            </button>
            <button
              @click="resetPlayback"
              class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              ⟲
            </button>
          </div>

          <div class="mb-2">
            <div class="flex justify-between text-xs text-gray-400 mb-1">
              <span>{{ formatTime(store.playbackStartDate) }}</span>
              <span>{{ formatTime(currentPlaybackDate) }}</span>
              <span>{{ formatTime(store.playbackEndDate) }}</span>
            </div>
            <input
              type="range"
              :value="store.playbackProgress"
              @input="onProgressInput"
              min="0" max="1" step="0.0001"
              class="w-full cursor-pointer" />
          </div>

          <div>
            <label class="text-xs text-gray-400">播放速度: {{ speedLabel }}</label>
            <select
              v-model.number="store.playbackSpeed"
              class="w-full bg-gray-700 rounded px-2 py-1 text-sm mt-1">
              <option :value="60">1 分钟/秒 (慢速)</option>
              <option :value="300">5 分钟/秒</option>
              <option :value="600">10 分钟/秒 (默认)</option>
              <option :value="1800">30 分钟/秒</option>
              <option :value="3600">1 小时/秒 (快速)</option>
              <option :value="7200">2 小时/秒</option>
            </select>
          </div>

          <div class="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400">
            进度: {{ (store.playbackProgress * 100).toFixed(1) }}%<br />
            当前时间: {{ formatDateTime(currentPlaybackDate) }}
          </div>
        </template>
      </div>

      <!-- Time Travel -->
      <div>
        <label class="text-gray-400 text-xs">时间旅行</label>
        <input type="datetime-local" v-model="dateStr" @input="updateDate"
          :disabled="store.playbackEnabled"
          :class="['w-full bg-gray-800 rounded px-3 py-2 text-sm', store.playbackEnabled ? 'opacity-50 cursor-not-allowed' : '']" />
      </div>

      <!-- Location -->
      <div>
        <label class="text-gray-400 text-xs">纬度: {{ store.latitude.toFixed(1) }}°</label>
        <input type="range" v-model.number="store.latitude" min="-90" max="90" step="0.1" class="w-full" />
      </div>

      <!-- Zoom -->
      <div>
        <label class="text-gray-400 text-xs">缩放: {{ store.zoom.toFixed(1) }}x</label>
        <input type="range" v-model.number="store.zoom" min="0.3" max="3" step="0.1" class="w-full" />
      </div>

      <!-- Toggles -->
      <div class="flex flex-col gap-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showLabels" /> 星名标签
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showConstLines" /> 星座连线
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showGrid" /> 坐标网格
        </label>
      </div>

      <!-- Star Info -->
      <div v-if="store.selectedStar" class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-amber-400 font-bold">{{ store.selectedStar.name }}</h3>
        <div class="text-xs text-gray-300 mt-2 space-y-1">
          <p>赤经: {{ store.selectedStar.ra.toFixed(2) }}h</p>
          <p>赤纬: {{ store.selectedStar.dec.toFixed(2) }}°</p>
          <p>视星等: {{ store.selectedStar.mag }}</p>
          <p>光谱型: {{ store.selectedStar.spectral }}</p>
        </div>
      </div>

      <!-- Constellation list -->
      <div class="text-xs">
        <h4 class="text-gray-400 mb-1">可见星座</h4>
        <div v-for="c in store.CONSTELLATIONS" :key="c.name" class="py-1 text-gray-300">
          {{ c.nameCn }} <span class="text-gray-500">({{ c.name }})</span>
        </div>
      </div>

      <div class="text-xs text-gray-500 mt-auto">
        LST: {{ store.localSiderealTime.toFixed(2) }}h
      </div>
    </div>

    <!-- Sky Canvas -->
    <div class="flex-1 relative">
      <StarCanvas />
      <div
        v-if="store.playbackEnabled && store.playbackPlaying"
        class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-sm text-white flex items-center gap-2 border border-blue-500/30">
        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        星空回放中 · {{ formatDateTime(currentPlaybackDate) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkyStore } from './store/sky'
import StarCanvas from './components/StarCanvas.vue'

const store = useSkyStore()
const dateStr = ref(new Date().toISOString().slice(0, 16))

function updateDate() { store.viewDate = new Date(dateStr.value) }

const currentPlaybackDate = computed(() => {
  const totalMs = store.playbackEndDate.getTime() - store.playbackStartDate.getTime()
  const targetMs = store.playbackStartDate.getTime() + totalMs * store.playbackProgress
  return new Date(targetMs)
})

const speedLabel = computed(() => {
  const s = store.playbackSpeed
  if (s >= 3600) return `${(s / 3600).toFixed(0)} 小时/秒`
  if (s >= 60) return `${(s / 60).toFixed(0)} 分钟/秒`
  return `${s} 秒/秒`
})

function formatTime(d: Date) {
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatDateTime(d: Date) {
  const mon = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${mon}-${day} ${h}:${m}`
}

function onProgressInput(e: Event) {
  const el = e.target as HTMLInputElement
  store.setPlaybackProgress(parseFloat(el.value))
}

function resetPlayback() {
  store.pausePlayback()
  store.initPlayback()
}

watch(() => store.viewDate, (d) => {
  if (!store.playbackEnabled) {
    dateStr.value = d.toISOString().slice(0, 16)
  }
}, { immediate: true })
</script>
