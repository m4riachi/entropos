<script setup lang="ts">
import AuthLayout from '~/layouts/auth.vue'
import { Head } from '@inertiajs/vue3'
import { Form } from '@adonisjs/inertia/vue'
</script>

<template>
  <AuthLayout>
    <Head title="Connexion" />
    <h1 class="auth__title">Connexion</h1>
    <p class="auth__sub">Identifiez-vous pour accéder aux entrées.</p>

    <Form v-slot="{ processing, errors }" route="session.store">
      <div class="auth__form">
        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            class="field__input"
            autocomplete="username"
            placeholder="admin@entropos.app"
            :aria-invalid="errors.email ? 'true' : 'false'"
          />
          <span v-if="errors.email" class="field__error">{{ errors.email }}</span>
        </div>

        <div class="field">
          <label class="field__label" for="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            class="field__input"
            autocomplete="current-password"
            placeholder="••••••••"
            :aria-invalid="errors.password ? 'true' : 'false'"
          />
          <span v-if="errors.password" class="field__error">{{ errors.password }}</span>
        </div>

        <button
          type="submit"
          class="btn btn--primary btn--block"
          :disabled="processing"
          :style="{ marginTop: '4px' }"
        >
          {{ processing ? 'Connexion…' : 'Se connecter' }}
        </button>
      </div>
    </Form>
  </AuthLayout>
</template>
