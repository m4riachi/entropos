<script setup lang="ts">
import Logo from '~/components/logo.vue'
import FlashToasts from '~/components/flash_toasts.vue'
import ThemeToggle from '~/components/theme_toggle.vue'
</script>

<template>
  <div class="auth">
    <div class="auth__form-col">
      <Logo :size="28" />
      <div class="auth__form-wrap">
        <slot />
      </div>
      <div :style="{ height: '20px' }" />
    </div>

    <aside class="auth__aside">
      <div class="auth__aside-top">
        <ThemeToggle />
      </div>

      <p class="auth__quote">
        Fiches d'entrée des entrepôts, saisies au quai et exportées en un clic.
      </p>

      <div>
        <div class="pitch__t">Entrepôts 1 à 4</div>
        <p class="pitch__p">
          Saisie des réceptions, liste triable, situation du stock et fiche d'entrée du jour au
          format Excel.
        </p>
      </div>
    </aside>
  </div>
  <FlashToasts />
</template>
