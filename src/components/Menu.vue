<template>
  <ion-menu side="start" content-id="main-content" type="overlay" :disabled="!isAuthenticated || router.currentRoute.value.path === '/login'">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Order Manager") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-item lines="none">
          <Logo />
        </ion-item>
        <ion-item v-if="userProfile?.userId || userProfile?.username">
          <ion-avatar slot="start">
            <ion-label>{{ userInitials }}</ion-label>
          </ion-avatar>
          <ion-label>
            <h2>{{ userProfile.userFullName || userProfile.partyId || userProfile.userId }}</h2>
            <p>{{ userProfile.emailAddress || userProfile.username || userProfile.userId }}</p>
            <p>{{ omsInstance }}</p>
          </ion-label>
        </ion-item>
        <ion-item v-if="productStores.length">
          <ion-select :label="translate('Store')" interface="popover" :value="currentProductStore.productStoreId" @ionChange="setCurrentProductStore($event)">
            <ion-select-option v-for="store in productStores" :key="store.productStoreId" :value="store.productStoreId">
              {{ store.storeName }}
            </ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

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

    <ion-footer>
      <ion-list>
        <ion-item lines="none">
          <ion-label>
            <p>{{ translate("Version") }}</p>
            <p>{{ appVersion }}</p>
          </ion-label>
        </ion-item>
        <ion-menu-toggle :auto-hide="false">
          <ion-item button @click="logout">
            <ion-icon slot="start" :icon="logOutOutline" />
            <ion-label>{{ translate("Logout") }}</ion-label>
          </ion-item>
        </ion-menu-toggle>
      </ion-list>
    </ion-footer>
  </ion-menu>
</template>

<script setup lang="ts">
import { IonAvatar, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/vue';
import { cubeOutline, logOutOutline, peopleOutline, returnUpBackOutline, searchOutline, settingsOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { cookieHelper, translate } from '@common';
import Logo from '@common/components/Logo.vue';
import { useAuth } from '@common/composables/useAuth';
import router from '@/router';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const { isAuthenticated } = useAuth();
const userProfile = computed(() => userStore.getUserProfile);
const currentProductStore = computed(() => userStore.getCurrentProductStore);
const productStores = computed(() => userProfile.value?.stores || []);
const omsInstance = computed(() => cookieHelper().get('oms') || userStore.oms);
const appInfo = (import.meta.env.VITE_VERSION_INFO ? JSON.parse(import.meta.env.VITE_VERSION_INFO as string) : {}) as any;
const appVersion = computed(() => {
  if (appInfo.branch && appInfo.revision) return `${appInfo.branch}-${appInfo.revision}`;
  return appInfo.tag || appInfo.version || '0.1.0';
});
const userInitials = computed(() => {
  const name = userProfile.value?.userFullName || userProfile.value?.partyId || userProfile.value?.userId || '';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('') || 'OM';
});

function setCurrentProductStore(event: CustomEvent) {
  userStore.setCurrentProductStore({ productStoreId: event.detail.value });
}

function logout() {
  useAuth().logout({ isUserUnauthorised: false });
}
</script>
