import type { MessageTree } from "../../config";

/** Owned by the services feature. Fill in keys used by that feature; keep tr and en in sync. */
export const services: MessageTree = {
  title: "Hizmetler",
  description: "Sattığınız hizmetler puanlamayı belirler: bir işletme yalnızca sunduğunuz hizmetler için puanlanır.",
  selection: {
    title: "Sattığınız hizmetler",
    description: "Kapalı bir hizmet için fırsat puanı hesaplanmaz ve önerilerde çıkmaz.",
    enabled: "Açık",
    disabled: "Kapalı",
    saved: "Hizmet seçimi güncellendi.",
    empty: "Tanımlı hizmet bulunamadı.",
    atLeastOne: "En az bir hizmet açık olmalı.",
    selectedCount: "{{count}} hizmet açık",
  },
  offerings: {
    title: "Paketleriniz",
    description:
      "Paketler mesaj taslaklarında bağlam olarak kullanılır. Fiyat aralığı yalnızca sizin girdiğiniz bilgidir; hiçbir yerde tahmin olarak sunulmaz.",
    add: "Paket ekle",
    edit: "Paketi düzenle",
    empty: "Henüz paket eklenmedi.",
    emptyHint: "Bir paket ekleyin; taslaklar ne sattığınızı ve hangi aralıkta çalıştığınızı bilerek yazılır.",
    created: "Paket eklendi.",
    updated: "Paket güncellendi.",
    deleted: "Paket silindi.",
    deleteTitle: "Paketi sil",
    deleteDescription: "{{name}} paketi silinir. Bu işlem geri alınamaz.",
    fields: {
      service: "Hizmet",
      name: "Paket adı",
      namePlaceholder: "Örneğin: Kurumsal web sitesi",
      description: "Açıklama",
      priceFrom: "Başlangıç fiyatı",
      priceTo: "Üst fiyat",
      currency: "Para birimi",
      billingPeriod: "Faturalama",
      deliveryTime: "Teslim süresi",
      deliveryTimePlaceholder: "Örneğin: 2-3 hafta",
      promptContext: "Taslak notu",
      promptContextHint: "Taslak yazılırken modele verilecek kısa bağlam. Doğrulanamayan iddialar yazmayın.",
      enabled: "Etkin",
    },
    periods: {
      one_time: "Tek seferlik",
      monthly: "Aylık",
      yearly: "Yıllık",
    },
    priceRange: {
      both: "{{from}} – {{to}}",
      fromOnly: "{{from}} üzeri",
      toOnly: "{{to}} altı",
      none: "Fiyat girilmedi",
    },
    errors: {
      nameRequired: "Paket adı girin.",
      serviceRequired: "Bir hizmet seçin.",
      priceRange: "Başlangıç fiyatı üst fiyattan büyük olamaz.",
      priceInvalid: "Fiyat sıfır veya daha büyük bir sayı olmalı.",
    },
  },
  disabledNotice: "Kapalı hizmetler puanlamada ve önerilerde kullanılmaz.",
};
