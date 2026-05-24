<template>
  <ion-menu side="start" content-id="main-content" type="overlay" :disabled="!isAuthenticated || router.currentRoute.value.path === '/login'">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Order Manager") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/orders" router-direction="root">
            <ion-icon slot="start" :icon="searchOutline" />
            <ion-label>{{ translate("Find orders") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/returns" router-direction="root">
            <ion-icon slot="start" :icon="returnUpBackOutline" />
            <ion-label>{{ translate("Find returns") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/customers" router-direction="root">
            <ion-icon slot="start" :icon="peopleOutline" />
            <ion-label>{{ translate("Find customers") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/shipments" router-direction="root">
            <ion-icon slot="start" :icon="cubeOutline" />
            <ion-label>{{ translate("Find shipments") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button router-link="/settings" router-direction="root">
            <ion-icon slot="start" :icon="settingsOutline" />
            <ion-label>{{ translate("Settings") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
      </ion-list>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { IonContent, IonHeader, IonIcon, IonItem, IonList, IonMenu, IonMenuToggle, IonTitle, IonToolbar } from '@ionic/vue';
import { cubeOutline, peopleOutline, returnUpBackOutline, searchOutline, settingsOutline } from 'ionicons/icons';
import { translate } from '@common';
import { useAuth } from '@common/composables/useAuth';
import router from '@/router';

const { isAuthenticated } = useAuth();
</script>

