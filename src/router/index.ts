import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Login } from '@common';
import { useAuth } from '@common/composables/useAuth';
import OrderSearch from '@/views/OrderSearch.vue';
import OrderDetail from '@/views/OrderDetail.vue';
import ShipmentSearch from '@/views/ShipmentSearch.vue';
import ShipmentDetail from '@/views/ShipmentDetail.vue';
import ReturnSearch from '@/views/ReturnSearch.vue';
import ReturnDetail from '@/views/ReturnDetail.vue';
import CustomerSearch from '@/views/CustomerSearch.vue';
import CustomerDetail from '@/views/CustomerDetail.vue';
import Settings from '@/views/Settings.vue';

const authGuard = async () => {
  if (!useAuth().isAuthenticated.value) {
    return { path: '/login' };
  }
};

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/orders'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/orders',
    name: 'OrderSearch',
    component: OrderSearch,
    beforeEnter: authGuard
  },
  {
    path: '/orders/:orderId',
    name: 'OrderDetail',
    component: OrderDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/shipments',
    name: 'ShipmentSearch',
    component: ShipmentSearch,
    beforeEnter: authGuard
  },
  {
    path: '/shipments/:shipmentId',
    name: 'ShipmentDetail',
    component: ShipmentDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/returns',
    name: 'ReturnSearch',
    component: ReturnSearch,
    beforeEnter: authGuard
  },
  {
    path: '/returns/:returnId',
    name: 'ReturnDetail',
    component: ReturnDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/customers',
    name: 'CustomerSearch',
    component: CustomerSearch,
    beforeEnter: authGuard
  },
  {
    path: '/customers/:customerId',
    name: 'CustomerDetail',
    component: CustomerDetail,
    props: true,
    beforeEnter: authGuard
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    beforeEnter: authGuard
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/orders'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
