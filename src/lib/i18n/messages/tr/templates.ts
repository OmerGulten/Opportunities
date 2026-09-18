import type { MessageTree } from "../../config";

/** Owned by the templates feature. Keys must stay identical to en/templates.ts. */
export const templates: MessageTree = {
  title: "Şablonlar",
  subtitle: "Mesaj taslaklarına başlangıç yapısı veren hazır metinler.",

  scope: {
    system: "Hazır şablonlar",
    workspace: "Çalışma alanı şablonları",
    personal: "Kişisel şablonlarım",
    systemDescription: "Platformla birlikte gelen şablonlar. Salt okunurdur; düzenlemek için kopyalayın.",
    workspaceDescription: "Ekipteki herkesin görüp kullanabildiği şablonlar.",
    personalDescription: "Yalnızca sizin görebildiğiniz şablonlar.",
  },

  readOnly: "Salt okunur",
  readOnlyHint: "Hazır şablonlar düzenlenemez. Kopyalayıp kendi sürümünüzü düzenleyin.",
  inactive: "Pasif",

  filters: {
    channel: "Kanal",
    service: "Hizmet",
    scope: "Kapsam",
    search: "Ara",
    searchPlaceholder: "Şablon adı veya metin",
    all: "Tümü",
    noService: "Hizmet seçilmedi",
    clear: "Filtreleri temizle",
  },

  card: {
    usage: "{{count}} kez kullanıldı",
    locale: "Dil",
    noService: "Hizmet yok",
    noCategory: "Kategori yok",
    noSubject: "Konu yok",
    updated: "Güncelleme: {{date}}",
    variables: "{{count}} değişken",
  },

  actions: {
    new: "Yeni şablon",
    edit: "Düzenle",
    duplicate: "Kopyala",
    duplicateToEdit: "Düzenlemek için kopyala",
    delete: "Sil",
    back: "Şablonlara dön",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    create: "Şablonu oluştur",
  },

  deleteConfirm: {
    title: "Şablon silinsin mi?",
    description: "“{{name}}” şablonu kalıcı olarak silinir. Bu şablonla oluşturulmuş mesajlar etkilenmez.",
    confirm: "Sil",
  },

  empty: {
    title: "Henüz şablonunuz yok",
    description: "Hazır bir şablonu kopyalayarak başlayabilir veya sıfırdan bir şablon oluşturabilirsiniz.",
    action: "Yeni şablon",
  },

  noResults: {
    title: "Bu filtrelerle şablon bulunamadı",
    description: "Filtreleri temizleyip yeniden deneyin.",
  },

  notFound: {
    title: "Şablon bulunamadı",
    description: "Bu şablon silinmiş ya da erişiminiz kaldırılmış olabilir.",
  },

  editor: {
    newTitle: "Yeni şablon",
    editTitle: "Şablonu düzenle",
    description: "Değişkenler taslak üretilirken doğrulanmış verilerle doldurulur; karşılığı olmayan değişkenler metinden temizlenir.",
    name: "Şablon adı",
    namePlaceholder: "Örn. Web sitesi olmayan kafeler",
    channel: "Kanal",
    service: "Hizmet",
    serviceNone: "Hizmet seçilmedi",
    category: "Kategori",
    categoryNone: "Kategori seçilmedi",
    tone: "Üslup",
    locale: "Şablon dili",
    scope: "Kapsam",
    scopeWorkspace: "Çalışma alanı (ekip görür)",
    scopePersonal: "Kişisel (yalnızca ben)",
    scopeHint: "Kapsam oluşturulduktan sonra değiştirilemez.",
    subject: "Konu",
    subjectPlaceholder: "E-posta konusu",
    subjectHint: "Yalnızca e-posta kanalında kullanılır.",
    body: "Metin",
    bodyPlaceholder: "Merhaba {{business_name}}, …",
    active: "Etkin",
    activeHint: "Pasif şablonlar mesaj oluşturma ekranında listelenmez.",
    variables: {
      title: "Değişkenler",
      description: "Bir değişkeni imlecin bulunduğu yere eklemek için üzerine tıklayın.",
      insert: "{{name}} değişkenini ekle",
      used: "Bu şablonda kullanılanlar",
      unknownTitle: "Tanınmayan değişken",
      unknown: "Şu değişkenlerin karşılığı yok: {{names}}. Doğrulanmış veriden üretilemeyen bir değişken kaydedilemez.",
    },
    preview: {
      title: "Önizleme",
      description: "Örnek değerlerle çözümlenmiş hâli. Gerçek taslakta değerler işletmenin doğrulanmış verisinden gelir.",
      empty: "Önizleme için metin yazın.",
      subject: "Konu",
      body: "Metin",
      missing: "Örnek veride karşılığı olmadığı için çıkarılan değişkenler: {{names}}",
    },
    errors: {
      nameRequired: "Şablon adı zorunludur.",
      bodyRequired: "Şablon metni boş olamaz.",
      bodyTooLong: "Şablon metni en fazla 6000 karakter olabilir.",
      subjectTooLong: "Konu en fazla 200 karakter olabilir.",
      saveFailed: "Şablon kaydedilemedi.",
      deleteFailed: "Şablon silinemedi.",
      duplicateFailed: "Şablon kopyalanamadı.",
      readOnly: "Hazır şablonlar düzenlenemez.",
    },
  },

  toast: {
    created: "Şablon oluşturuldu",
    updated: "Şablon güncellendi",
    deleted: "Şablon silindi",
    duplicated: "Şablon kopyalandı",
  },
};
