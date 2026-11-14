<script setup lang="ts">
import { Warehouse } from 'lucide-vue-next'

withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <a href="/entrees" class="brand" aria-label="Entropos — accueil">
    <span class="brand__mark" :style="{ width: `${size}px`, height: `${size}px` }">
      <Warehouse :size="Math.round(size * 0.58)" :stroke-width="2" />
    </span>
    Entropos
  </a>
</template>
