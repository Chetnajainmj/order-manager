import { toastController } from '@ionic/vue';

export const showToast = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 3000,
    position: 'bottom',
  })

  return toast.present();
}
