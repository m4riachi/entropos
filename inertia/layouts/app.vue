<script setup lang="ts">
import { List, LogOut, Plus } from 'lucide-vue-next'
import { usePage } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
import Logo from '~/components/logo.vue'
import FlashToasts from '~/components/flash_toasts.vue'
import ThemeToggle from '~/components/theme_toggle.vue'
import NavLink, { type NavItem } from '~/components/nav_link.vue'

const page = usePage()

const nav: NavItem[] = [
  { label: 'Entrées', route: 'entries.index', icon: List },
  { label: 'Nouvelle entrée', route: 'entries.create', icon: Plus },
]
</script>

<template>
  <header class="header header--bar">
    <div class="header__inner">
      <Logo :size="28" />
      <div class="header__right">
        <span
          v-if="page.props.user"
          class="mono header__email"
          :style="{ fontSize: '12.5px', color: 'var(--muted)' }"
        >
          {{ page.props.user.email }}
        </span>
        <ThemeToggle />
        <Form route="session.destroy">
          <button type="submit" class="btn btn--secondary btn--sm">
            <LogOut :size="15" /> <span class="header__logout-label">Déconnexion</span>
          </button>
        </Form>
      </div>
    </div>
  </header>

  <nav class="subnav">
    <div class="subnav__inner">
      <NavLink v-for="item in nav" :key="item.label" :route="item.route" exact class="subnav__item">
        <component :is="item.icon" v-if="item.icon" :size="14" />
        {{ item.label }}
      </NavLink>
    </div>
  </nav>

  <div class="app-main">
    <slot />
  </div>
  <FlashToasts />
</template>
