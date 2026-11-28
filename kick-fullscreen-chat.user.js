// ==UserScript==
// @name         Kick Fullscreen Chat
// @namespace    https://github.com/jakubn11/kick-fullscreen-chat
// @version      0.31.0
// @description  Adds a Twitch-style "side chat" toggle button when watching a Kick stream in fullscreen
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         https://raw.githubusercontent.com/jakubn11/kick-fullscreen-chat/main/icon.svg
// @match        https://kick.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/jakubn11/kick-fullscreen-chat/releases/latest/download/kick-fullscreen-chat.user.js
// @downloadURL  https://github.com/jakubn11/kick-fullscreen-chat/releases/latest/download/kick-fullscreen-chat.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Bumped on every release, exposed as KickFullscreenChat.version so the
  // actually-running build is easy to confirm from the console. Must match
  // the `@version` in the metadata header above — if the two drift, the
  // console API reports a build the user isn't running, which is the one
  // thing it exists to rule out.
  const VERSION = '0.31.0';

  // ── Words in Kick's language (0.29.0) ──────────────────────────────────
  // Every word the script shows — the Chat button, the settings panel, the
  // control and action-bar labels, toasts and the console — in Kick's
  // language, English for any other: the same 28 languages as the other kick-*
  // scripts. Kick sets <html lang> from the viewer's language ("cs", "pt", …);
  // the primary subtag picks the table. Up here, before the single-instance
  // guard, whose warning uses it. Read each time something is drawn, so a
  // language change shows on the next pass. {v} and {running} are filled in by
  // the caller. The debug log and error warnings stay English, for bug reports.
  // No translated button label may read like Kick's own chat toggle
  // (CHAT_TOGGLE_RE / SHOW_CHAT_RE test other buttons' labels) or contain
  // "settings" / "quality" without "chat" (Kick Quality Saver finds Kick's
  // gear by those words) — the tests check every table.
  const UI_TEXT = Object.freeze({
    en: Object.freeze({
      duplicate: 'v{v} is standing down: v{running} is already running on this page. Two copies share the same DOM ids and fight over the controls — disable or uninstall the duplicate.',
      active: 'v{v} active',
      debugOn: 'debug logging on',
      debugOff: 'debug logging off',
      chatErrored: 'Kick chat errored. Click Chat to reopen.',
      chatNotFound: 'Kick Fullscreen Chat: chat panel not found. Kick may have changed its layout; check the console diagnostics.',
      moreActions: 'Show more chat actions',
      fewerActions: 'Show fewer chat actions',
      showMore: 'Show more',
      showLess: 'Show less',
      chat: 'Chat',
      showChat: 'Show chat',
      hideChat: 'Hide chat',
      loadingVideo: 'Loading video...',
      close: 'Close',
      closeSettings: 'Close fullscreen chat settings',
      openSettings: 'Open fullscreen chat settings',
      toSide: 'Switch to side-by-side chat',
      toOverlay: 'Switch to overlay chat',
      showInfo: 'Show stream info',
      hideInfo: 'Hide stream info',
      overlayOpacity: 'Overlay opacity',
      backdrop: 'Backdrop',
      hideDelay: 'Hide delay',
      chatWidth: 'Chat width',
      compact: 'Compact',
      default: 'Default',
      wide: 'Wide',
      max: 'Max',
      groupChat: 'Chat',
      dockLeft: 'Dock chat on left',
      openAsOverlay: 'Open chats as overlay',
      openOnFullscreen: 'Open chat on fullscreen',
      messagesOnly: 'Messages only',
      groupOverlay: 'Overlay',
      autoHideOverlay: 'Auto-hide overlay chat',
      groupInfo: 'Stream info',
      showActions: 'Show follow, sub & share',
      showTags: 'Show tags',
      groupControls: 'Controls',
      autoHideControls: 'Auto-hide controls',
      groupAds: 'Ads',
      muteAds: 'Mute ads',
      reset: 'Reset settings',
    }),
    ar: Object.freeze({
      duplicate: 'v{v} يتوقف: v{running} يعمل بالفعل في هذه الصفحة. النسختان تتشاركان المعرّفات نفسها وتتنازعان على الأزرار — عطّل النسخة المكررة أو أزلها.',
      active: 'v{v} يعمل',
      debugOn: 'سجل التصحيح مفعّل',
      debugOff: 'سجل التصحيح متوقف',
      chatErrored: 'حدث خطأ في دردشة Kick. انقر «الدردشة» لإعادة فتحها.',
      chatNotFound: 'Kick Fullscreen Chat: لم يُعثر على لوحة الدردشة. ربما غيّر Kick تصميمه؛ راجع التشخيص في وحدة التحكم.',
      moreActions: 'عرض المزيد من أدوات الدردشة',
      fewerActions: 'عرض أدوات دردشة أقل',
      showMore: 'عرض المزيد',
      showLess: 'عرض أقل',
      chat: 'الدردشة',
      showChat: 'إظهار الدردشة',
      hideChat: 'إخفاء الدردشة',
      loadingVideo: 'جارٍ تحميل الفيديو…',
      close: 'إغلاق',
      closeSettings: 'إغلاق إعدادات الدردشة بملء الشاشة',
      openSettings: 'فتح إعدادات الدردشة بملء الشاشة',
      toSide: 'التبديل إلى الدردشة الجانبية',
      toOverlay: 'التبديل إلى الدردشة فوق الفيديو',
      showInfo: 'إظهار معلومات البث',
      hideInfo: 'إخفاء معلومات البث',
      overlayOpacity: 'شفافية الطبقة',
      backdrop: 'الخلفية',
      hideDelay: 'مهلة الإخفاء',
      chatWidth: 'عرض الدردشة',
      compact: 'مضغوط',
      default: 'افتراضي',
      wide: 'عريض',
      max: 'أقصى',
      groupChat: 'الدردشة',
      dockLeft: 'تثبيت الدردشة على اليسار',
      openAsOverlay: 'فتح الدردشات كطبقة',
      openOnFullscreen: 'فتح الدردشة عند ملء الشاشة',
      messagesOnly: 'الرسائل فقط',
      groupOverlay: 'الطبقة',
      autoHideOverlay: 'إخفاء دردشة الطبقة تلقائيًا',
      groupInfo: 'معلومات البث',
      showActions: 'إظهار المتابعة والاشتراك والمشاركة',
      showTags: 'إظهار الوسوم',
      groupControls: 'أدوات التحكم',
      autoHideControls: 'إخفاء أدوات التحكم تلقائيًا',
      groupAds: 'الإعلانات',
      muteAds: 'كتم الإعلانات',
      reset: 'إعادة ضبط الإعدادات',
    }),
    bg: Object.freeze({
      duplicate: 'v{v} се спира: v{running} вече работи на тази страница. Двете копия споделят едни и същи DOM id-та и се борят за бутоните — изключи или премахни дубликата.',
      active: 'v{v} е активен',
      debugOn: 'отладъчният лог е включен',
      debugOff: 'отладъчният лог е изключен',
      chatErrored: 'Чатът на Kick даде грешка. Натисни „Чат“, за да го отвориш отново.',
      chatNotFound: 'Kick Fullscreen Chat: панелът на чата не е намерен. Kick може да е сменил оформлението си; виж диагностиката в конзолата.',
      moreActions: 'Още действия в чата',
      fewerActions: 'По-малко действия в чата',
      showMore: 'Още',
      showLess: 'По-малко',
      chat: 'Чат',
      showChat: 'Покажи чата',
      hideChat: 'Скрий чата',
      loadingVideo: 'Видеото се зарежда…',
      close: 'Затвори',
      closeSettings: 'Затвори настройките на чата на цял екран',
      openSettings: 'Отвори настройките на чата на цял екран',
      toSide: 'Превключи към чат отстрани',
      toOverlay: 'Превключи към чат върху видеото',
      showInfo: 'Покажи информацията за стрийма',
      hideInfo: 'Скрий информацията за стрийма',
      overlayOpacity: 'Прозрачност на слоя',
      backdrop: 'Фон',
      hideDelay: 'Забавяне на скриването',
      chatWidth: 'Ширина на чата',
      compact: 'Тесен',
      default: 'Стандартен',
      wide: 'Широк',
      max: 'Макс.',
      groupChat: 'Чат',
      dockLeft: 'Чат отляво',
      openAsOverlay: 'Отваряй чата върху видеото',
      openOnFullscreen: 'Отваряй чата на цял екран',
      messagesOnly: 'Само съобщения',
      groupOverlay: 'Слой',
      autoHideOverlay: 'Автоскриване на чата',
      groupInfo: 'Информация за стрийма',
      showActions: 'Следване и абонамент',
      showTags: 'Покажи таговете',
      groupControls: 'Контроли',
      autoHideControls: 'Автоскриване на контролите',
      groupAds: 'Реклами',
      muteAds: 'Заглуши рекламите',
      reset: 'Нулирай настройките',
    }),
    cs: Object.freeze({
      duplicate: 'v{v} se vypíná: na této stránce už běží v{running}. Dvě kopie sdílejí stejná DOM id a přetahují se o ovládání — vypni nebo odinstaluj duplikát.',
      active: 'v{v} běží',
      debugOn: 'ladicí výpis zapnut',
      debugOff: 'ladicí výpis vypnut',
      chatErrored: 'Chat Kicku spadl. Klikni na Chat a otevři ho znovu.',
      chatNotFound: 'Kick Fullscreen Chat: panel chatu nenalezen. Kick možná změnil rozložení; podívej se do diagnostiky v konzoli.',
      moreActions: 'Další akce chatu',
      fewerActions: 'Méně akcí chatu',
      showMore: 'Více',
      showLess: 'Méně',
      chat: 'Chat',
      showChat: 'Zobrazit chat',
      hideChat: 'Skrýt chat',
      loadingVideo: 'Načítání videa…',
      close: 'Zavřít',
      closeSettings: 'Zavřít nastavení chatu na celé obrazovce',
      openSettings: 'Otevřít nastavení chatu na celé obrazovce',
      toSide: 'Přepnout na chat vedle videa',
      toOverlay: 'Přepnout na chat přes video',
      showInfo: 'Zobrazit info o streamu',
      hideInfo: 'Skrýt info o streamu',
      overlayOpacity: 'Průhlednost překryvu',
      backdrop: 'Pozadí',
      hideDelay: 'Prodleva skrytí',
      chatWidth: 'Šířka chatu',
      compact: 'Úzký',
      default: 'Výchozí',
      wide: 'Široký',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat vlevo',
      openAsOverlay: 'Otevírat chaty přes video',
      openOnFullscreen: 'Otevřít chat na celé obrazovce',
      messagesOnly: 'Jen zprávy',
      groupOverlay: 'Překryv',
      autoHideOverlay: 'Automaticky skrývat chat',
      groupInfo: 'Info o streamu',
      showActions: 'Zobrazit sledovat, odběr a sdílet',
      showTags: 'Zobrazit štítky',
      groupControls: 'Ovládání',
      autoHideControls: 'Automaticky skrývat ovládání',
      groupAds: 'Reklamy',
      muteAds: 'Ztlumit reklamy',
      reset: 'Obnovit nastavení',
    }),
    da: Object.freeze({
      duplicate: 'v{v} trækker sig: v{running} kører allerede på siden. To kopier deler de samme DOM-id’er og kæmper om knapperne — slå dubletten fra eller afinstaller den.',
      active: 'v{v} aktiv',
      debugOn: 'fejlfindingslog til',
      debugOff: 'fejlfindingslog fra',
      chatErrored: 'Kick-chatten fejlede. Klik på Chat for at åbne den igen.',
      chatNotFound: 'Kick Fullscreen Chat: chatpanelet blev ikke fundet. Kick har måske ændret sit layout; se diagnosen i konsollen.',
      moreActions: 'Vis flere chathandlinger',
      fewerActions: 'Vis færre chathandlinger',
      showMore: 'Vis mere',
      showLess: 'Vis mindre',
      chat: 'Chat',
      showChat: 'Vis chat',
      hideChat: 'Skjul chat',
      loadingVideo: 'Indlæser video…',
      close: 'Luk',
      closeSettings: 'Luk indstillinger for fuldskærmschat',
      openSettings: 'Åbn indstillinger for fuldskærmschat',
      toSide: 'Skift til chat ved siden af',
      toOverlay: 'Skift til chat over videoen',
      showInfo: 'Vis streaminfo',
      hideInfo: 'Skjul streaminfo',
      overlayOpacity: 'Gennemsigtighed',
      backdrop: 'Baggrund',
      hideDelay: 'Skjul efter',
      chatWidth: 'Chatbredde',
      compact: 'Smal',
      default: 'Standard',
      wide: 'Bred',
      max: 'Maks.',
      groupChat: 'Chat',
      dockLeft: 'Chat til venstre',
      openAsOverlay: 'Åbn chats som overlejring',
      openOnFullscreen: 'Åbn chat i fuld skærm',
      messagesOnly: 'Kun beskeder',
      groupOverlay: 'Overlejring',
      autoHideOverlay: 'Skjul chatten automatisk',
      groupInfo: 'Streaminfo',
      showActions: 'Vis følg, abonnér og del',
      showTags: 'Vis tags',
      groupControls: 'Knapper',
      autoHideControls: 'Skjul knapper automatisk',
      groupAds: 'Reklamer',
      muteAds: 'Slå lyden fra under reklamer',
      reset: 'Nulstil indstillinger',
    }),
    de: Object.freeze({
      duplicate: 'v{v} hält an: v{running} läuft bereits auf dieser Seite. Zwei Kopien teilen dieselben DOM-IDs und streiten um die Bedienelemente — deaktiviere oder deinstalliere das Duplikat.',
      active: 'v{v} aktiv',
      debugOn: 'Debug-Log an',
      debugOff: 'Debug-Log aus',
      chatErrored: 'Der Kick-Chat hat einen Fehler. Klicke auf Chat, um ihn neu zu öffnen.',
      chatNotFound: 'Kick Fullscreen Chat: Chat-Bereich nicht gefunden. Kick hat vielleicht sein Layout geändert; sieh dir die Diagnose in der Konsole an.',
      moreActions: 'Mehr Chat-Aktionen zeigen',
      fewerActions: 'Weniger Chat-Aktionen zeigen',
      showMore: 'Mehr',
      showLess: 'Weniger',
      chat: 'Chat',
      showChat: 'Chat zeigen',
      hideChat: 'Chat ausblenden',
      loadingVideo: 'Video lädt…',
      close: 'Schließen',
      closeSettings: 'Vollbild-Chat-Einstellungen schließen',
      openSettings: 'Vollbild-Chat-Einstellungen öffnen',
      toSide: 'Zum Chat neben dem Video wechseln',
      toOverlay: 'Zum Chat über dem Video wechseln',
      showInfo: 'Stream-Infos zeigen',
      hideInfo: 'Stream-Infos ausblenden',
      overlayOpacity: 'Overlay-Deckkraft',
      backdrop: 'Hintergrund',
      hideDelay: 'Ausblenden nach',
      chatWidth: 'Chat-Breite',
      compact: 'Schmal',
      default: 'Standard',
      wide: 'Breit',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat links andocken',
      openAsOverlay: 'Chats als Overlay öffnen',
      openOnFullscreen: 'Chat im Vollbild öffnen',
      messagesOnly: 'Nur Nachrichten',
      groupOverlay: 'Overlay',
      autoHideOverlay: 'Chat automatisch ausblenden',
      groupInfo: 'Stream-Infos',
      showActions: 'Folgen, Abo & Teilen zeigen',
      showTags: 'Tags zeigen',
      groupControls: 'Steuerung',
      autoHideControls: 'Automatisch ausblenden',
      groupAds: 'Werbung',
      muteAds: 'Werbung stummschalten',
      reset: 'Einstellungen zurücksetzen',
    }),
    el: Object.freeze({
      duplicate: 'Το v{v} σταματά: το v{running} τρέχει ήδη σε αυτή τη σελίδα. Δύο αντίγραφα μοιράζονται τα ίδια DOM id και μάχονται για τα κουμπιά — απενεργοποίησε ή απεγκατέστησε το διπλό.',
      active: 'v{v} ενεργό',
      debugOn: 'καταγραφή αποσφαλμάτωσης ενεργή',
      debugOff: 'καταγραφή αποσφαλμάτωσης ανενεργή',
      chatErrored: 'Η συνομιλία του Kick παρουσίασε σφάλμα. Πάτησε Συνομιλία για να ανοίξει ξανά.',
      chatNotFound: 'Kick Fullscreen Chat: δεν βρέθηκε το πλαίσιο συνομιλίας. Ίσως το Kick άλλαξε τη διάταξή του· δες τη διάγνωση στην κονσόλα.',
      moreActions: 'Περισσότερες ενέργειες συνομιλίας',
      fewerActions: 'Λιγότερες ενέργειες συνομιλίας',
      showMore: 'Περισσότερα',
      showLess: 'Λιγότερα',
      chat: 'Συνομιλία',
      showChat: 'Εμφάνιση συνομιλίας',
      hideChat: 'Απόκρυψη συνομιλίας',
      loadingVideo: 'Φόρτωση βίντεο…',
      close: 'Κλείσιμο',
      closeSettings: 'Κλείσιμο ρυθμίσεων συνομιλίας πλήρους οθόνης',
      openSettings: 'Άνοιγμα ρυθμίσεων συνομιλίας πλήρους οθόνης',
      toSide: 'Συνομιλία δίπλα στο βίντεο',
      toOverlay: 'Συνομιλία πάνω στο βίντεο',
      showInfo: 'Εμφάνιση πληροφοριών ροής',
      hideInfo: 'Απόκρυψη πληροφοριών ροής',
      overlayOpacity: 'Αδιαφάνεια επικάλυψης',
      backdrop: 'Φόντο',
      hideDelay: 'Καθυστέρηση απόκρυψης',
      chatWidth: 'Πλάτος συνομιλίας',
      compact: 'Στενό',
      default: 'Προεπιλογή',
      wide: 'Φαρδύ',
      max: 'Μέγ.',
      groupChat: 'Συνομιλία',
      dockLeft: 'Συνομιλία αριστερά',
      openAsOverlay: 'Συνομιλίες ως επικάλυψη',
      openOnFullscreen: 'Συνομιλία σε πλήρη οθόνη',
      messagesOnly: 'Μόνο μηνύματα',
      groupOverlay: 'Επικάλυψη',
      autoHideOverlay: 'Αυτόματη απόκρυψη συνομιλίας',
      groupInfo: 'Πληροφορίες ροής',
      showActions: 'Ακολούθηση & συνδρομή',
      showTags: 'Εμφάνιση ετικετών',
      groupControls: 'Χειριστήρια',
      autoHideControls: 'Αυτόματη απόκρυψη',
      groupAds: 'Διαφημίσεις',
      muteAds: 'Σίγαση διαφημίσεων',
      reset: 'Επαναφορά ρυθμίσεων',
    }),
    es: Object.freeze({
      duplicate: 'v{v} se detiene: v{running} ya se está ejecutando en esta página. Dos copias comparten los mismos id del DOM y se pelean por los controles: desactiva o desinstala el duplicado.',
      active: 'v{v} activo',
      debugOn: 'registro de depuración activado',
      debugOff: 'registro de depuración desactivado',
      chatErrored: 'El chat de Kick falló. Haz clic en Chat para volver a abrirlo.',
      chatNotFound: 'Kick Fullscreen Chat: no se encontró el panel del chat. Puede que Kick haya cambiado su diseño; revisa el diagnóstico en la consola.',
      moreActions: 'Más acciones del chat',
      fewerActions: 'Menos acciones del chat',
      showMore: 'Ver más',
      showLess: 'Ver menos',
      chat: 'Chat',
      showChat: 'Mostrar chat',
      hideChat: 'Ocultar chat',
      loadingVideo: 'Cargando vídeo…',
      close: 'Cerrar',
      closeSettings: 'Cerrar ajustes del chat en pantalla completa',
      openSettings: 'Abrir ajustes del chat en pantalla completa',
      toSide: 'Cambiar a chat al lado',
      toOverlay: 'Cambiar a chat sobre el vídeo',
      showInfo: 'Mostrar info del directo',
      hideInfo: 'Ocultar info del directo',
      overlayOpacity: 'Opacidad de la capa',
      backdrop: 'Fondo',
      hideDelay: 'Retraso al ocultar',
      chatWidth: 'Ancho del chat',
      compact: 'Compacto',
      default: 'Normal',
      wide: 'Ancho',
      max: 'Máx.',
      groupChat: 'Chat',
      dockLeft: 'Chat a la izquierda',
      openAsOverlay: 'Abrir chats como capa',
      openOnFullscreen: 'Abrir chat en pantalla completa',
      messagesOnly: 'Solo mensajes',
      groupOverlay: 'Capa',
      autoHideOverlay: 'Ocultar el chat en capa',
      groupInfo: 'Info del directo',
      showActions: 'Seguir, suscribirse y compartir',
      showTags: 'Mostrar etiquetas',
      groupControls: 'Controles',
      autoHideControls: 'Ocultar los controles',
      groupAds: 'Anuncios',
      muteAds: 'Silenciar anuncios',
      reset: 'Restablecer ajustes',
    }),
    fi: Object.freeze({
      duplicate: 'v{v} väistyy: v{running} on jo käynnissä tällä sivulla. Kaksi kopiota käyttää samoja DOM-tunnisteita ja kilpailee painikkeista — poista kaksoiskappale käytöstä tai asennuksesta.',
      active: 'v{v} käytössä',
      debugOn: 'virheenjäljitysloki päällä',
      debugOff: 'virheenjäljitysloki pois',
      chatErrored: 'Kickin chat kaatui. Avaa se uudelleen Chat-painikkeesta.',
      chatNotFound: 'Kick Fullscreen Chat: chat-paneelia ei löytynyt. Kick on ehkä muuttanut asetteluaan; katso diagnostiikka konsolista.',
      moreActions: 'Lisää chat-toimintoja',
      fewerActions: 'Vähemmän chat-toimintoja',
      showMore: 'Lisää',
      showLess: 'Vähemmän',
      chat: 'Chat',
      showChat: 'Näytä chat',
      hideChat: 'Piilota chat',
      loadingVideo: 'Video latautuu…',
      close: 'Sulje',
      closeSettings: 'Sulje koko näytön chatin asetukset',
      openSettings: 'Avaa koko näytön chatin asetukset',
      toSide: 'Vaihda chattiin videon vieressä',
      toOverlay: 'Vaihda chattiin videon päällä',
      showInfo: 'Näytä striimin tiedot',
      hideInfo: 'Piilota striimin tiedot',
      overlayOpacity: 'Peittokuvan läpinäkyvyys',
      backdrop: 'Tausta',
      hideDelay: 'Piilotusviive',
      chatWidth: 'Chatin leveys',
      compact: 'Kapea',
      default: 'Oletus',
      wide: 'Leveä',
      max: 'Maks.',
      groupChat: 'Chat',
      dockLeft: 'Chat vasemmalla',
      openAsOverlay: 'Avaa chatit videon päälle',
      openOnFullscreen: 'Avaa chat koko näytössä',
      messagesOnly: 'Vain viestit',
      groupOverlay: 'Peittokuva',
      autoHideOverlay: 'Piilota videon päällä oleva chat',
      groupInfo: 'Striimin tiedot',
      showActions: 'Näytä seuraa, tilaa ja jaa',
      showTags: 'Näytä tunnisteet',
      groupControls: 'Säätimet',
      autoHideControls: 'Piilota säätimet automaattisesti',
      groupAds: 'Mainokset',
      muteAds: 'Mykistä mainokset',
      reset: 'Palauta asetukset',
    }),
    fr: Object.freeze({
      duplicate: 'v{v} s’arrête : v{running} tourne déjà sur cette page. Deux copies partagent les mêmes id du DOM et se disputent les contrôles — désactivez ou désinstallez le doublon.',
      active: 'v{v} actif',
      debugOn: 'journal de débogage activé',
      debugOff: 'journal de débogage désactivé',
      chatErrored: 'Le chat de Kick a planté. Cliquez sur Chat pour le rouvrir.',
      chatNotFound: 'Kick Fullscreen Chat : panneau du chat introuvable. Kick a peut-être changé sa mise en page ; consultez le diagnostic dans la console.',
      moreActions: 'Plus d’actions du chat',
      fewerActions: 'Moins d’actions du chat',
      showMore: 'Plus',
      showLess: 'Moins',
      chat: 'Chat',
      showChat: 'Afficher le chat',
      hideChat: 'Masquer le chat',
      loadingVideo: 'Chargement de la vidéo…',
      close: 'Fermer',
      closeSettings: 'Fermer les réglages du chat plein écran',
      openSettings: 'Ouvrir les réglages du chat plein écran',
      toSide: 'Passer au chat à côté',
      toOverlay: 'Passer au chat sur la vidéo',
      showInfo: 'Afficher les infos du stream',
      hideInfo: 'Masquer les infos du stream',
      overlayOpacity: 'Opacité de la superposition',
      backdrop: 'Fond',
      hideDelay: 'Délai de masquage',
      chatWidth: 'Largeur du chat',
      compact: 'Compact',
      default: 'Normal',
      wide: 'Large',
      max: 'Max',
      groupChat: 'Chat',
      dockLeft: 'Chat à gauche',
      openAsOverlay: 'Ouvrir les chats en superposition',
      openOnFullscreen: 'Ouvrir le chat en plein écran',
      messagesOnly: 'Messages seuls',
      groupOverlay: 'Superposition',
      autoHideOverlay: 'Masquer le chat superposé',
      groupInfo: 'Infos du stream',
      showActions: 'Suivre, s’abonner et partager',
      showTags: 'Afficher les tags',
      groupControls: 'Contrôles',
      autoHideControls: 'Masquer les contrôles',
      groupAds: 'Pubs',
      muteAds: 'Couper le son des pubs',
      reset: 'Réinitialiser les réglages',
    }),
    hu: Object.freeze({
      duplicate: 'A v{v} leáll: a v{running} már fut ezen az oldalon. A két példány ugyanazokat a DOM-azonosítókat használja és a vezérlőkön veszekszik — kapcsold ki vagy távolítsd el a duplikátumot.',
      active: 'v{v} aktív',
      debugOn: 'hibakereső napló be',
      debugOff: 'hibakereső napló ki',
      chatErrored: 'A Kick chat hibára futott. Kattints a Chat gombra az újranyitáshoz.',
      chatNotFound: 'Kick Fullscreen Chat: a chatpanel nem található. A Kick talán megváltoztatta az elrendezést; nézd meg a diagnosztikát a konzolban.',
      moreActions: 'Több chatművelet',
      fewerActions: 'Kevesebb chatművelet',
      showMore: 'Több',
      showLess: 'Kevesebb',
      chat: 'Chat',
      showChat: 'Chat megjelenítése',
      hideChat: 'Chat elrejtése',
      loadingVideo: 'Videó betöltése…',
      close: 'Bezárás',
      closeSettings: 'Teljes képernyős chat beállításainak bezárása',
      openSettings: 'Teljes képernyős chat beállításainak megnyitása',
      toSide: 'Váltás a videó melletti chatre',
      toOverlay: 'Váltás a videó feletti chatre',
      showInfo: 'Streaminfó megjelenítése',
      hideInfo: 'Streaminfó elrejtése',
      overlayOpacity: 'Fedőréteg átlátszósága',
      backdrop: 'Háttér',
      hideDelay: 'Elrejtés késleltetése',
      chatWidth: 'Chat szélessége',
      compact: 'Keskeny',
      default: 'Alap',
      wide: 'Széles',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat balra',
      openAsOverlay: 'Chatek fedőrétegként',
      openOnFullscreen: 'Chat teljes képernyőn',
      messagesOnly: 'Csak üzenetek',
      groupOverlay: 'Fedőréteg',
      autoHideOverlay: 'Fedő chat automatikus elrejtése',
      groupInfo: 'Streaminfó',
      showActions: 'Követés, feliratkozás, megosztás',
      showTags: 'Címkék megjelenítése',
      groupControls: 'Vezérlők',
      autoHideControls: 'Vezérlők automatikus elrejtése',
      groupAds: 'Reklámok',
      muteAds: 'Reklámok némítása',
      reset: 'Beállítások visszaállítása',
    }),
    id: Object.freeze({
      duplicate: 'v{v} berhenti: v{running} sudah berjalan di halaman ini. Dua salinan memakai id DOM yang sama dan berebut kontrol — nonaktifkan atau hapus duplikatnya.',
      active: 'v{v} aktif',
      debugOn: 'log debug aktif',
      debugOff: 'log debug mati',
      chatErrored: 'Chat Kick error. Klik Chat untuk membukanya lagi.',
      chatNotFound: 'Kick Fullscreen Chat: panel chat tidak ditemukan. Mungkin Kick mengubah tata letaknya; lihat diagnostik di konsol.',
      moreActions: 'Lebih banyak aksi chat',
      fewerActions: 'Lebih sedikit aksi chat',
      showMore: 'Lebih banyak',
      showLess: 'Lebih sedikit',
      chat: 'Chat',
      showChat: 'Tampilkan chat',
      hideChat: 'Sembunyikan chat',
      loadingVideo: 'Memuat video…',
      close: 'Tutup',
      closeSettings: 'Tutup pengaturan chat layar penuh',
      openSettings: 'Buka pengaturan chat layar penuh',
      toSide: 'Beralih ke chat di samping',
      toOverlay: 'Beralih ke chat di atas video',
      showInfo: 'Tampilkan info stream',
      hideInfo: 'Sembunyikan info stream',
      overlayOpacity: 'Opasitas overlay',
      backdrop: 'Latar',
      hideDelay: 'Jeda sembunyi',
      chatWidth: 'Lebar chat',
      compact: 'Ringkas',
      default: 'Default',
      wide: 'Lebar',
      max: 'Maks',
      groupChat: 'Chat',
      dockLeft: 'Chat di kiri',
      openAsOverlay: 'Buka chat sebagai overlay',
      openOnFullscreen: 'Buka chat saat layar penuh',
      messagesOnly: 'Hanya pesan',
      groupOverlay: 'Overlay',
      autoHideOverlay: 'Sembunyikan chat otomatis',
      groupInfo: 'Info stream',
      showActions: 'Ikuti, langganan & bagikan',
      showTags: 'Tampilkan tag',
      groupControls: 'Kontrol',
      autoHideControls: 'Sembunyikan kontrol otomatis',
      groupAds: 'Iklan',
      muteAds: 'Bisukan iklan',
      reset: 'Atur ulang pengaturan',
    }),
    it: Object.freeze({
      duplicate: 'v{v} si ferma: v{running} è già in esecuzione su questa pagina. Due copie condividono gli stessi id del DOM e si contendono i controlli: disattiva o disinstalla il duplicato.',
      active: 'v{v} attivo',
      debugOn: 'log di debug attivo',
      debugOff: 'log di debug disattivato',
      chatErrored: 'La chat di Kick si è bloccata. Fai clic su Chat per riaprirla.',
      chatNotFound: 'Kick Fullscreen Chat: pannello della chat non trovato. Kick potrebbe aver cambiato layout; controlla la diagnostica nella console.',
      moreActions: 'Altre azioni della chat',
      fewerActions: 'Meno azioni della chat',
      showMore: 'Altro',
      showLess: 'Meno',
      chat: 'Chat',
      showChat: 'Mostra chat',
      hideChat: 'Nascondi chat',
      loadingVideo: 'Caricamento video…',
      close: 'Chiudi',
      closeSettings: 'Chiudi impostazioni della chat a schermo intero',
      openSettings: 'Apri impostazioni della chat a schermo intero',
      toSide: 'Passa alla chat affiancata',
      toOverlay: 'Passa alla chat sopra il video',
      showInfo: 'Mostra info della live',
      hideInfo: 'Nascondi info della live',
      overlayOpacity: 'Opacità sovrapposizione',
      backdrop: 'Sfondo',
      hideDelay: 'Ritardo di scomparsa',
      chatWidth: 'Larghezza chat',
      compact: 'Compatta',
      default: 'Predefinita',
      wide: 'Larga',
      max: 'Max',
      groupChat: 'Chat',
      dockLeft: 'Chat a sinistra',
      openAsOverlay: 'Apri le chat in sovrimpressione',
      openOnFullscreen: 'Apri la chat a schermo intero',
      messagesOnly: 'Solo messaggi',
      groupOverlay: 'Sovrapposizione',
      autoHideOverlay: 'Chat a scomparsa',
      groupInfo: 'Info della live',
      showActions: 'Segui, abbonati e condividi',
      showTags: 'Mostra tag',
      groupControls: 'Controlli',
      autoHideControls: 'Nascondi i controlli',
      groupAds: 'Pubblicità',
      muteAds: 'Silenzia pubblicità',
      reset: 'Ripristina impostazioni',
    }),
    ja: Object.freeze({
      duplicate: 'v{v} は停止します: このページではすでに v{running} が動作しています。2 つのコピーが同じ DOM id を使い操作を奪い合うので、重複を無効にするか削除してください。',
      active: 'v{v} 動作中',
      debugOn: 'デバッグログ オン',
      debugOff: 'デバッグログ オフ',
      chatErrored: 'Kick のチャットでエラーが発生しました。「チャット」をクリックして開き直してください。',
      chatNotFound: 'Kick Fullscreen Chat: チャットパネルが見つかりません。Kick のレイアウトが変わった可能性があります。コンソールの診断を確認してください。',
      moreActions: 'チャット操作をもっと表示',
      fewerActions: 'チャット操作を減らす',
      showMore: 'もっと見る',
      showLess: '閉じる',
      chat: 'チャット',
      showChat: 'チャットを表示',
      hideChat: 'チャットを隠す',
      loadingVideo: '動画を読み込み中…',
      close: '閉じる',
      closeSettings: '全画面チャットの設定を閉じる',
      openSettings: '全画面チャットの設定を開く',
      toSide: '横並びチャットに切り替え',
      toOverlay: 'オーバーレイチャットに切り替え',
      showInfo: '配信情報を表示',
      hideInfo: '配信情報を隠す',
      overlayOpacity: 'オーバーレイの不透明度',
      backdrop: '背景',
      hideDelay: '非表示までの時間',
      chatWidth: 'チャットの幅',
      compact: '狭い',
      default: '標準',
      wide: '広い',
      max: '最大',
      groupChat: 'チャット',
      dockLeft: 'チャットを左に配置',
      openAsOverlay: 'チャットをオーバーレイで開く',
      openOnFullscreen: '全画面でチャットを開く',
      messagesOnly: 'メッセージのみ',
      groupOverlay: 'オーバーレイ',
      autoHideOverlay: 'オーバーレイチャットを自動で隠す',
      groupInfo: '配信情報',
      showActions: 'フォロー・サブスク・共有を表示',
      showTags: 'タグを表示',
      groupControls: 'コントロール',
      autoHideControls: 'コントロールを自動で隠す',
      groupAds: '広告',
      muteAds: '広告をミュート',
      reset: '設定をリセット',
    }),
    ko: Object.freeze({
      duplicate: 'v{v} 중지: 이 페이지에서 이미 v{running}이(가) 실행 중입니다. 두 사본이 같은 DOM id를 쓰며 컨트롤을 두고 다투므로 중복을 끄거나 제거하세요.',
      active: 'v{v} 실행 중',
      debugOn: '디버그 로그 켜짐',
      debugOff: '디버그 로그 꺼짐',
      chatErrored: 'Kick 채팅에 오류가 났습니다. 채팅을 눌러 다시 여세요.',
      chatNotFound: 'Kick Fullscreen Chat: 채팅 패널을 찾을 수 없습니다. Kick 레이아웃이 바뀌었을 수 있으니 콘솔 진단을 확인하세요.',
      moreActions: '채팅 동작 더 보기',
      fewerActions: '채팅 동작 줄이기',
      showMore: '더 보기',
      showLess: '접기',
      chat: '채팅',
      showChat: '채팅 보기',
      hideChat: '채팅 숨기기',
      loadingVideo: '동영상 불러오는 중…',
      close: '닫기',
      closeSettings: '전체 화면 채팅 설정 닫기',
      openSettings: '전체 화면 채팅 설정 열기',
      toSide: '옆 채팅으로 전환',
      toOverlay: '오버레이 채팅으로 전환',
      showInfo: '방송 정보 보기',
      hideInfo: '방송 정보 숨기기',
      overlayOpacity: '오버레이 불투명도',
      backdrop: '배경',
      hideDelay: '숨김 지연',
      chatWidth: '채팅 너비',
      compact: '좁게',
      default: '기본',
      wide: '넓게',
      max: '최대',
      groupChat: '채팅',
      dockLeft: '채팅을 왼쪽에',
      openAsOverlay: '채팅을 오버레이로 열기',
      openOnFullscreen: '전체 화면에서 채팅 열기',
      messagesOnly: '메시지만',
      groupOverlay: '오버레이',
      autoHideOverlay: '오버레이 채팅 자동 숨김',
      groupInfo: '방송 정보',
      showActions: '팔로우·구독·공유 보기',
      showTags: '태그 보기',
      groupControls: '컨트롤',
      autoHideControls: '컨트롤 자동 숨김',
      groupAds: '광고',
      muteAds: '광고 음소거',
      reset: '설정 초기화',
    }),
    nl: Object.freeze({
      duplicate: 'v{v} stopt: v{running} draait al op deze pagina. Twee kopieën delen dezelfde DOM-id’s en vechten om de knoppen — schakel het duplicaat uit of verwijder het.',
      active: 'v{v} actief',
      debugOn: 'debuglog aan',
      debugOff: 'debuglog uit',
      chatErrored: 'De Kick-chat gaf een fout. Klik op Chat om hem opnieuw te openen.',
      chatNotFound: 'Kick Fullscreen Chat: chatpaneel niet gevonden. Kick heeft misschien de lay-out veranderd; bekijk de diagnose in de console.',
      moreActions: 'Meer chatacties',
      fewerActions: 'Minder chatacties',
      showMore: 'Meer',
      showLess: 'Minder',
      chat: 'Chat',
      showChat: 'Chat tonen',
      hideChat: 'Chat verbergen',
      loadingVideo: 'Video laden…',
      close: 'Sluiten',
      closeSettings: 'Instellingen volledig-schermchat sluiten',
      openSettings: 'Instellingen volledig-schermchat openen',
      toSide: 'Naar chat naast de video',
      toOverlay: 'Naar chat over de video',
      showInfo: 'Streaminfo tonen',
      hideInfo: 'Streaminfo verbergen',
      overlayOpacity: 'Dekking overlay',
      backdrop: 'Achtergrond',
      hideDelay: 'Verbergen na',
      chatWidth: 'Chatbreedte',
      compact: 'Smal',
      default: 'Standaard',
      wide: 'Breed',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat links',
      openAsOverlay: 'Chats openen als overlay',
      openOnFullscreen: 'Chat openen in volledig scherm',
      messagesOnly: 'Alleen berichten',
      groupOverlay: 'Overlay',
      autoHideOverlay: 'Chat automatisch verbergen',
      groupInfo: 'Streaminfo',
      showActions: 'Volgen, abonneren & delen tonen',
      showTags: 'Tags tonen',
      groupControls: 'Bediening',
      autoHideControls: 'Automatisch verbergen',
      groupAds: 'Advertenties',
      muteAds: 'Advertenties dempen',
      reset: 'Instellingen herstellen',
    }),
    no: Object.freeze({
      duplicate: 'v{v} trekker seg: v{running} kjører allerede på siden. To kopier deler de samme DOM-id-ene og kjemper om knappene — slå av eller avinstaller duplikatet.',
      active: 'v{v} aktiv',
      debugOn: 'feilsøkingslogg på',
      debugOff: 'feilsøkingslogg av',
      chatErrored: 'Kick-chatten feilet. Klikk Chat for å åpne den igjen.',
      chatNotFound: 'Kick Fullscreen Chat: fant ikke chatpanelet. Kick kan ha endret oppsettet; se diagnosen i konsollen.',
      moreActions: 'Vis flere chathandlinger',
      fewerActions: 'Vis færre chathandlinger',
      showMore: 'Vis mer',
      showLess: 'Vis mindre',
      chat: 'Chat',
      showChat: 'Vis chat',
      hideChat: 'Skjul chat',
      loadingVideo: 'Laster video…',
      close: 'Lukk',
      closeSettings: 'Lukk innstillinger for fullskjermchat',
      openSettings: 'Åpne innstillinger for fullskjermchat',
      toSide: 'Bytt til chat ved siden av',
      toOverlay: 'Bytt til chat over videoen',
      showInfo: 'Vis strøminfo',
      hideInfo: 'Skjul strøminfo',
      overlayOpacity: 'Overleggets gjennomsiktighet',
      backdrop: 'Bakgrunn',
      hideDelay: 'Skjul etter',
      chatWidth: 'Chatbredde',
      compact: 'Smal',
      default: 'Standard',
      wide: 'Bred',
      max: 'Maks',
      groupChat: 'Chat',
      dockLeft: 'Chat til venstre',
      openAsOverlay: 'Åpne chatter som overlegg',
      openOnFullscreen: 'Åpne chat i fullskjerm',
      messagesOnly: 'Bare meldinger',
      groupOverlay: 'Overlegg',
      autoHideOverlay: 'Skjul overleggschat automatisk',
      groupInfo: 'Strøminfo',
      showActions: 'Vis følg, abonner og del',
      showTags: 'Vis tagger',
      groupControls: 'Kontroller',
      autoHideControls: 'Skjul kontroller automatisk',
      groupAds: 'Reklame',
      muteAds: 'Demp reklame',
      reset: 'Tilbakestill innstillinger',
    }),
    pl: Object.freeze({
      duplicate: 'v{v} wyłącza się: na tej stronie działa już v{running}. Dwie kopie dzielą te same id w DOM i walczą o przyciski — wyłącz lub odinstaluj duplikat.',
      active: 'v{v} działa',
      debugOn: 'log debugowania włączony',
      debugOff: 'log debugowania wyłączony',
      chatErrored: 'Czat Kick się wysypał. Kliknij Czat, aby otworzyć go ponownie.',
      chatNotFound: 'Kick Fullscreen Chat: nie znaleziono panelu czatu. Kick mógł zmienić układ; sprawdź diagnostykę w konsoli.',
      moreActions: 'Więcej akcji czatu',
      fewerActions: 'Mniej akcji czatu',
      showMore: 'Więcej',
      showLess: 'Mniej',
      chat: 'Czat',
      showChat: 'Pokaż czat',
      hideChat: 'Ukryj czat',
      loadingVideo: 'Wczytywanie wideo…',
      close: 'Zamknij',
      closeSettings: 'Zamknij ustawienia czatu pełnoekranowego',
      openSettings: 'Otwórz ustawienia czatu pełnoekranowego',
      toSide: 'Przełącz na czat obok',
      toOverlay: 'Przełącz na czat na wideo',
      showInfo: 'Pokaż info o transmisji',
      hideInfo: 'Ukryj info o transmisji',
      overlayOpacity: 'Krycie nakładki',
      backdrop: 'Tło',
      hideDelay: 'Opóźnienie ukrycia',
      chatWidth: 'Szerokość czatu',
      compact: 'Wąski',
      default: 'Domyślny',
      wide: 'Szeroki',
      max: 'Maks.',
      groupChat: 'Czat',
      dockLeft: 'Czat po lewej',
      openAsOverlay: 'Otwieraj czaty jako nakładkę',
      openOnFullscreen: 'Otwieraj czat na pełnym ekranie',
      messagesOnly: 'Tylko wiadomości',
      groupOverlay: 'Nakładka',
      autoHideOverlay: 'Autoukrywanie czatu na wideo',
      groupInfo: 'Info o transmisji',
      showActions: 'Pokaż obserwuj, sub i udostępnij',
      showTags: 'Pokaż tagi',
      groupControls: 'Sterowanie',
      autoHideControls: 'Autoukrywanie sterowania',
      groupAds: 'Reklamy',
      muteAds: 'Wycisz reklamy',
      reset: 'Przywróć ustawienia',
    }),
    pt: Object.freeze({
      duplicate: 'v{v} vai parar: v{running} já está rodando nesta página. Duas cópias usam os mesmos ids do DOM e disputam os controles — desative ou desinstale a duplicata.',
      active: 'v{v} ativo',
      debugOn: 'log de depuração ligado',
      debugOff: 'log de depuração desligado',
      chatErrored: 'O chat do Kick deu erro. Clique em Chat para reabrir.',
      chatNotFound: 'Kick Fullscreen Chat: painel do chat não encontrado. O Kick pode ter mudado o layout; veja o diagnóstico no console.',
      moreActions: 'Mais ações do chat',
      fewerActions: 'Menos ações do chat',
      showMore: 'Ver mais',
      showLess: 'Ver menos',
      chat: 'Chat',
      showChat: 'Mostrar chat',
      hideChat: 'Ocultar chat',
      loadingVideo: 'Carregando vídeo…',
      close: 'Fechar',
      closeSettings: 'Fechar ajustes do chat em tela cheia',
      openSettings: 'Abrir ajustes do chat em tela cheia',
      toSide: 'Mudar para chat ao lado',
      toOverlay: 'Mudar para chat sobre o vídeo',
      showInfo: 'Mostrar info da live',
      hideInfo: 'Ocultar info da live',
      overlayOpacity: 'Opacidade da sobreposição',
      backdrop: 'Fundo',
      hideDelay: 'Atraso para ocultar',
      chatWidth: 'Largura do chat',
      compact: 'Compacto',
      default: 'Padrão',
      wide: 'Largo',
      max: 'Máx.',
      groupChat: 'Chat',
      dockLeft: 'Chat à esquerda',
      openAsOverlay: 'Abrir chats sobrepostos',
      openOnFullscreen: 'Abrir chat em tela cheia',
      messagesOnly: 'Só mensagens',
      groupOverlay: 'Sobreposição',
      autoHideOverlay: 'Ocultar chat sobreposto',
      groupInfo: 'Info da live',
      showActions: 'Seguir, inscrever e compartilhar',
      showTags: 'Mostrar tags',
      groupControls: 'Controles',
      autoHideControls: 'Ocultar controles',
      groupAds: 'Anúncios',
      muteAds: 'Silenciar anúncios',
      reset: 'Redefinir ajustes',
    }),
    ro: Object.freeze({
      duplicate: 'v{v} se oprește: v{running} rulează deja pe această pagină. Două copii folosesc aceleași id-uri DOM și se luptă pe butoane — dezactivează sau dezinstalează duplicatul.',
      active: 'v{v} activ',
      debugOn: 'jurnal de depanare pornit',
      debugOff: 'jurnal de depanare oprit',
      chatErrored: 'Chatul Kick a dat eroare. Apasă Chat ca să-l redeschizi.',
      chatNotFound: 'Kick Fullscreen Chat: panoul de chat nu a fost găsit. Poate Kick și-a schimbat aspectul; vezi diagnosticul din consolă.',
      moreActions: 'Mai multe acțiuni de chat',
      fewerActions: 'Mai puține acțiuni de chat',
      showMore: 'Mai mult',
      showLess: 'Mai puțin',
      chat: 'Chat',
      showChat: 'Arată chatul',
      hideChat: 'Ascunde chatul',
      loadingVideo: 'Se încarcă video…',
      close: 'Închide',
      closeSettings: 'Închide setările chatului pe ecran complet',
      openSettings: 'Deschide setările chatului pe ecran complet',
      toSide: 'Comută la chat alături',
      toOverlay: 'Comută la chat peste video',
      showInfo: 'Arată info despre stream',
      hideInfo: 'Ascunde info despre stream',
      overlayOpacity: 'Opacitatea suprapunerii',
      backdrop: 'Fundal',
      hideDelay: 'Întârziere ascundere',
      chatWidth: 'Lățime chat',
      compact: 'Îngust',
      default: 'Implicit',
      wide: 'Lat',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat în stânga',
      openAsOverlay: 'Deschide chaturile suprapus',
      openOnFullscreen: 'Chat pe ecran complet',
      messagesOnly: 'Doar mesaje',
      groupOverlay: 'Suprapunere',
      autoHideOverlay: 'Ascunde automat chatul',
      groupInfo: 'Info despre stream',
      showActions: 'Urmărire, abonare, distribuire',
      showTags: 'Arată etichetele',
      groupControls: 'Controale',
      autoHideControls: 'Ascunde automat controalele',
      groupAds: 'Reclame',
      muteAds: 'Dezactivează sunetul reclamelor',
      reset: 'Resetează setările',
    }),
    ru: Object.freeze({
      duplicate: 'v{v} отключается: на этой странице уже работает v{running}. Две копии делят одни и те же id в DOM и спорят за кнопки — отключите или удалите дубликат.',
      active: 'v{v} работает',
      debugOn: 'отладочный лог включён',
      debugOff: 'отладочный лог выключен',
      chatErrored: 'Чат Kick упал. Нажмите «Чат», чтобы открыть его снова.',
      chatNotFound: 'Kick Fullscreen Chat: панель чата не найдена. Возможно, Kick изменил разметку; смотрите диагностику в консоли.',
      moreActions: 'Больше действий чата',
      fewerActions: 'Меньше действий чата',
      showMore: 'Ещё',
      showLess: 'Меньше',
      chat: 'Чат',
      showChat: 'Показать чат',
      hideChat: 'Скрыть чат',
      loadingVideo: 'Видео загружается…',
      close: 'Закрыть',
      closeSettings: 'Закрыть настройки полноэкранного чата',
      openSettings: 'Открыть настройки полноэкранного чата',
      toSide: 'Переключить на чат сбоку',
      toOverlay: 'Переключить на чат поверх видео',
      showInfo: 'Показать инфо о стриме',
      hideInfo: 'Скрыть инфо о стриме',
      overlayOpacity: 'Прозрачность оверлея',
      backdrop: 'Фон',
      hideDelay: 'Задержка скрытия',
      chatWidth: 'Ширина чата',
      compact: 'Узкий',
      default: 'Обычный',
      wide: 'Широкий',
      max: 'Макс.',
      groupChat: 'Чат',
      dockLeft: 'Чат слева',
      openAsOverlay: 'Открывать чаты поверх видео',
      openOnFullscreen: 'Чат в полноэкранном режиме',
      messagesOnly: 'Только сообщения',
      groupOverlay: 'Оверлей',
      autoHideOverlay: 'Автоскрытие чата',
      groupInfo: 'Инфо о стриме',
      showActions: 'Подписка, саб и «поделиться»',
      showTags: 'Показать теги',
      groupControls: 'Управление',
      autoHideControls: 'Автоскрытие управления',
      groupAds: 'Реклама',
      muteAds: 'Выключать звук рекламы',
      reset: 'Сбросить настройки',
    }),
    sk: Object.freeze({
      duplicate: 'v{v} sa vypína: na tejto stránke už beží v{running}. Dve kópie zdieľajú rovnaké DOM id a preťahujú sa o ovládanie — vypni alebo odinštaluj duplikát.',
      active: 'v{v} beží',
      debugOn: 'ladiaci výpis zapnutý',
      debugOff: 'ladiaci výpis vypnutý',
      chatErrored: 'Chat Kicku spadol. Klikni na Chat a otvor ho znova.',
      chatNotFound: 'Kick Fullscreen Chat: panel chatu sa nenašiel. Kick možno zmenil rozloženie; pozri diagnostiku v konzole.',
      moreActions: 'Ďalšie akcie chatu',
      fewerActions: 'Menej akcií chatu',
      showMore: 'Viac',
      showLess: 'Menej',
      chat: 'Chat',
      showChat: 'Zobraziť chat',
      hideChat: 'Skryť chat',
      loadingVideo: 'Načítava sa video…',
      close: 'Zavrieť',
      closeSettings: 'Zavrieť nastavenia chatu na celej obrazovke',
      openSettings: 'Otvoriť nastavenia chatu na celej obrazovke',
      toSide: 'Prepnúť na chat vedľa videa',
      toOverlay: 'Prepnúť na chat cez video',
      showInfo: 'Zobraziť info o streame',
      hideInfo: 'Skryť info o streame',
      overlayOpacity: 'Priehľadnosť prekrytia',
      backdrop: 'Pozadie',
      hideDelay: 'Oneskorenie skrytia',
      chatWidth: 'Šírka chatu',
      compact: 'Úzky',
      default: 'Predvolený',
      wide: 'Široký',
      max: 'Max.',
      groupChat: 'Chat',
      dockLeft: 'Chat vľavo',
      openAsOverlay: 'Otvárať chaty cez video',
      openOnFullscreen: 'Otvoriť chat na celej obrazovke',
      messagesOnly: 'Iba správy',
      groupOverlay: 'Prekrytie',
      autoHideOverlay: 'Automaticky skrývať chat',
      groupInfo: 'Info o streame',
      showActions: 'Sledovať, odber a zdieľať',
      showTags: 'Zobraziť štítky',
      groupControls: 'Ovládanie',
      autoHideControls: 'Automaticky skrývať ovládanie',
      groupAds: 'Reklamy',
      muteAds: 'Stlmiť reklamy',
      reset: 'Obnoviť nastavenia',
    }),
    sv: Object.freeze({
      duplicate: 'v{v} kliver åt sidan: v{running} körs redan på sidan. Två kopior delar samma DOM-id och slåss om knapparna — stäng av eller avinstallera dubbletten.',
      active: 'v{v} aktiv',
      debugOn: 'felsökningslogg på',
      debugOff: 'felsökningslogg av',
      chatErrored: 'Kick-chatten kraschade. Klicka på Chat för att öppna den igen.',
      chatNotFound: 'Kick Fullscreen Chat: chattpanelen hittades inte. Kick kan ha ändrat layouten; se diagnosen i konsolen.',
      moreActions: 'Visa fler chattåtgärder',
      fewerActions: 'Visa färre chattåtgärder',
      showMore: 'Visa mer',
      showLess: 'Visa mindre',
      chat: 'Chat',
      showChat: 'Visa chatt',
      hideChat: 'Dölj chatt',
      loadingVideo: 'Läser in video…',
      close: 'Stäng',
      closeSettings: 'Stäng inställningar för helskärmschatt',
      openSettings: 'Öppna inställningar för helskärmschatt',
      toSide: 'Byt till chatt bredvid',
      toOverlay: 'Byt till chatt över videon',
      showInfo: 'Visa streaminfo',
      hideInfo: 'Dölj streaminfo',
      overlayOpacity: 'Överläggets opacitet',
      backdrop: 'Bakgrund',
      hideDelay: 'Dölj efter',
      chatWidth: 'Chattbredd',
      compact: 'Smal',
      default: 'Standard',
      wide: 'Bred',
      max: 'Max',
      groupChat: 'Chatt',
      dockLeft: 'Chatt till vänster',
      openAsOverlay: 'Öppna chattar som överlägg',
      openOnFullscreen: 'Öppna chatt i helskärm',
      messagesOnly: 'Bara meddelanden',
      groupOverlay: 'Överlägg',
      autoHideOverlay: 'Dölj överläggschatt automatiskt',
      groupInfo: 'Streaminfo',
      showActions: 'Visa följ, prenumerera och dela',
      showTags: 'Visa taggar',
      groupControls: 'Kontroller',
      autoHideControls: 'Dölj kontroller automatiskt',
      groupAds: 'Annonser',
      muteAds: 'Stäng av ljud för annonser',
      reset: 'Återställ inställningar',
    }),
    th: Object.freeze({
      duplicate: 'v{v} หยุดทำงาน: หน้านี้มี v{running} ทำงานอยู่แล้ว สองสำเนาใช้ DOM id เดียวกันและแย่งปุ่มกัน ปิดหรือถอนการติดตั้งสำเนาที่ซ้ำ',
      active: 'v{v} ทำงานอยู่',
      debugOn: 'บันทึกดีบักเปิด',
      debugOff: 'บันทึกดีบักปิด',
      chatErrored: 'แชท Kick เกิดข้อผิดพลาด คลิก แชท เพื่อเปิดใหม่',
      chatNotFound: 'Kick Fullscreen Chat: ไม่พบแผงแชท Kick อาจเปลี่ยนเลย์เอาต์ ดูการวินิจฉัยในคอนโซล',
      moreActions: 'แสดงการทำงานของแชทเพิ่ม',
      fewerActions: 'แสดงการทำงานของแชทน้อยลง',
      showMore: 'เพิ่มเติม',
      showLess: 'น้อยลง',
      chat: 'แชท',
      showChat: 'แสดงแชท',
      hideChat: 'ซ่อนแชท',
      loadingVideo: 'กำลังโหลดวิดีโอ…',
      close: 'ปิด',
      closeSettings: 'ปิดการตั้งค่าแชทแบบเต็มจอ',
      openSettings: 'เปิดการตั้งค่าแชทแบบเต็มจอ',
      toSide: 'สลับเป็นแชทด้านข้าง',
      toOverlay: 'สลับเป็นแชทซ้อนบนวิดีโอ',
      showInfo: 'แสดงข้อมูลสตรีม',
      hideInfo: 'ซ่อนข้อมูลสตรีม',
      overlayOpacity: 'ความทึบของชั้นซ้อน',
      backdrop: 'พื้นหลัง',
      hideDelay: 'หน่วงก่อนซ่อน',
      chatWidth: 'ความกว้างแชท',
      compact: 'แคบ',
      default: 'ปกติ',
      wide: 'กว้าง',
      max: 'สูงสุด',
      groupChat: 'แชท',
      dockLeft: 'แชทชิดซ้าย',
      openAsOverlay: 'เปิดแชทแบบซ้อนบนวิดีโอ',
      openOnFullscreen: 'เปิดแชทเมื่อเต็มจอ',
      messagesOnly: 'ข้อความเท่านั้น',
      groupOverlay: 'ชั้นซ้อน',
      autoHideOverlay: 'ซ่อนแชทซ้อนอัตโนมัติ',
      groupInfo: 'ข้อมูลสตรีม',
      showActions: 'แสดงติดตาม สมัคร และแชร์',
      showTags: 'แสดงแท็ก',
      groupControls: 'ปุ่มควบคุม',
      autoHideControls: 'ซ่อนปุ่มควบคุมอัตโนมัติ',
      groupAds: 'โฆษณา',
      muteAds: 'ปิดเสียงโฆษณา',
      reset: 'รีเซ็ตการตั้งค่า',
    }),
    tr: Object.freeze({
      duplicate: 'v{v} devre dışı kalıyor: bu sayfada zaten v{running} çalışıyor. İki kopya aynı DOM kimliklerini kullanıp kontroller için çekişir — yinelenen kopyayı kapat veya kaldır.',
      active: 'v{v} etkin',
      debugOn: 'hata ayıklama günlüğü açık',
      debugOff: 'hata ayıklama günlüğü kapalı',
      chatErrored: 'Kick sohbeti hata verdi. Yeniden açmak için Sohbet’e tıkla.',
      chatNotFound: 'Kick Fullscreen Chat: sohbet paneli bulunamadı. Kick düzenini değiştirmiş olabilir; konsoldaki tanılamaya bak.',
      moreActions: 'Daha fazla sohbet eylemi',
      fewerActions: 'Daha az sohbet eylemi',
      showMore: 'Daha fazla',
      showLess: 'Daha az',
      chat: 'Sohbet',
      showChat: 'Sohbeti göster',
      hideChat: 'Sohbeti gizle',
      loadingVideo: 'Video yükleniyor…',
      close: 'Kapat',
      closeSettings: 'Tam ekran sohbet ayarlarını kapat',
      openSettings: 'Tam ekran sohbet ayarlarını aç',
      toSide: 'Yan sohbete geç',
      toOverlay: 'Video üstü sohbete geç',
      showInfo: 'Yayın bilgisini göster',
      hideInfo: 'Yayın bilgisini gizle',
      overlayOpacity: 'Katman opaklığı',
      backdrop: 'Arka plan',
      hideDelay: 'Gizleme gecikmesi',
      chatWidth: 'Sohbet genişliği',
      compact: 'Dar',
      default: 'Varsayılan',
      wide: 'Geniş',
      max: 'Maks.',
      groupChat: 'Sohbet',
      dockLeft: 'Sohbet solda',
      openAsOverlay: 'Sohbetleri katman olarak aç',
      openOnFullscreen: 'Tam ekranda sohbeti aç',
      messagesOnly: 'Yalnızca mesajlar',
      groupOverlay: 'Katman',
      autoHideOverlay: 'Katman sohbetini otomatik gizle',
      groupInfo: 'Yayın bilgisi',
      showActions: 'Takip, abonelik ve paylaşım',
      showTags: 'Etiketleri göster',
      groupControls: 'Kontroller',
      autoHideControls: 'Kontrolleri otomatik gizle',
      groupAds: 'Reklamlar',
      muteAds: 'Reklamları sessize al',
      reset: 'Ayarları sıfırla',
    }),
    uk: Object.freeze({
      duplicate: 'v{v} вимикається: на цій сторінці вже працює v{running}. Дві копії ділять ті самі id у DOM і змагаються за кнопки — вимкніть або видаліть дублікат.',
      active: 'v{v} працює',
      debugOn: 'журнал налагодження увімкнено',
      debugOff: 'журнал налагодження вимкнено',
      chatErrored: 'Чат Kick впав. Натисніть «Чат», щоб відкрити його знову.',
      chatNotFound: 'Kick Fullscreen Chat: панель чату не знайдено. Можливо, Kick змінив розмітку; перегляньте діагностику в консолі.',
      moreActions: 'Більше дій чату',
      fewerActions: 'Менше дій чату',
      showMore: 'Ще',
      showLess: 'Менше',
      chat: 'Чат',
      showChat: 'Показати чат',
      hideChat: 'Сховати чат',
      loadingVideo: 'Відео завантажується…',
      close: 'Закрити',
      closeSettings: 'Закрити налаштування повноекранного чату',
      openSettings: 'Відкрити налаштування повноекранного чату',
      toSide: 'Перемкнути на чат збоку',
      toOverlay: 'Перемкнути на чат поверх відео',
      showInfo: 'Показати інфо про стрим',
      hideInfo: 'Сховати інфо про стрим',
      overlayOpacity: 'Прозорість оверлею',
      backdrop: 'Фон',
      hideDelay: 'Затримка приховування',
      chatWidth: 'Ширина чату',
      compact: 'Вузький',
      default: 'Звичайний',
      wide: 'Широкий',
      max: 'Макс.',
      groupChat: 'Чат',
      dockLeft: 'Чат ліворуч',
      openAsOverlay: 'Відкривати чати поверх відео',
      openOnFullscreen: 'Чат у повноекранному режимі',
      messagesOnly: 'Лише повідомлення',
      groupOverlay: 'Оверлей',
      autoHideOverlay: 'Автоприховування чату',
      groupInfo: 'Інфо про стрим',
      showActions: 'Підписка, саб і «поділитися»',
      showTags: 'Показати теги',
      groupControls: 'Керування',
      autoHideControls: 'Автоприховування керування',
      groupAds: 'Реклама',
      muteAds: 'Вимикати звук реклами',
      reset: 'Скинути налаштування',
    }),
    vi: Object.freeze({
      duplicate: 'v{v} dừng lại: v{running} đã chạy trên trang này. Hai bản dùng chung id DOM và tranh nhau nút điều khiển — tắt hoặc gỡ bản trùng.',
      active: 'v{v} đang chạy',
      debugOn: 'nhật ký gỡ lỗi bật',
      debugOff: 'nhật ký gỡ lỗi tắt',
      chatErrored: 'Chat Kick bị lỗi. Bấm Chat để mở lại.',
      chatNotFound: 'Kick Fullscreen Chat: không tìm thấy khung chat. Có thể Kick đã đổi bố cục; xem phần chẩn đoán trong console.',
      moreActions: 'Thêm thao tác chat',
      fewerActions: 'Bớt thao tác chat',
      showMore: 'Xem thêm',
      showLess: 'Thu gọn',
      chat: 'Chat',
      showChat: 'Hiện chat',
      hideChat: 'Ẩn chat',
      loadingVideo: 'Đang tải video…',
      close: 'Đóng',
      closeSettings: 'Đóng cài đặt chat toàn màn hình',
      openSettings: 'Mở cài đặt chat toàn màn hình',
      toSide: 'Chuyển sang chat bên cạnh',
      toOverlay: 'Chuyển sang chat phủ video',
      showInfo: 'Hiện thông tin stream',
      hideInfo: 'Ẩn thông tin stream',
      overlayOpacity: 'Độ mờ lớp phủ',
      backdrop: 'Nền',
      hideDelay: 'Độ trễ ẩn',
      chatWidth: 'Độ rộng chat',
      compact: 'Hẹp',
      default: 'Mặc định',
      wide: 'Rộng',
      max: 'Tối đa',
      groupChat: 'Chat',
      dockLeft: 'Chat bên trái',
      openAsOverlay: 'Mở chat dạng lớp phủ',
      openOnFullscreen: 'Mở chat khi toàn màn hình',
      messagesOnly: 'Chỉ tin nhắn',
      groupOverlay: 'Lớp phủ',
      autoHideOverlay: 'Tự ẩn chat lớp phủ',
      groupInfo: 'Thông tin stream',
      showActions: 'Hiện theo dõi, đăng ký & chia sẻ',
      showTags: 'Hiện thẻ',
      groupControls: 'Điều khiển',
      autoHideControls: 'Tự ẩn điều khiển',
      groupAds: 'Quảng cáo',
      muteAds: 'Tắt tiếng quảng cáo',
      reset: 'Đặt lại cài đặt',
    }),
    zh: Object.freeze({
      duplicate: 'v{v} 停止运行：此页面已在运行 v{running}。两个副本共用相同的 DOM id 并争夺控件——请停用或卸载重复的副本。',
      active: 'v{v} 已启用',
      debugOn: '调试日志已开启',
      debugOff: '调试日志已关闭',
      chatErrored: 'Kick 聊天出错了。点击“聊天”重新打开。',
      chatNotFound: 'Kick Fullscreen Chat：找不到聊天面板。Kick 可能改了页面布局；请查看控制台中的诊断信息。',
      moreActions: '更多聊天操作',
      fewerActions: '更少聊天操作',
      showMore: '更多',
      showLess: '收起',
      chat: '聊天',
      showChat: '显示聊天',
      hideChat: '隐藏聊天',
      loadingVideo: '视频加载中…',
      close: '关闭',
      closeSettings: '关闭全屏聊天设置',
      openSettings: '打开全屏聊天设置',
      toSide: '切换到侧边聊天',
      toOverlay: '切换到浮层聊天',
      showInfo: '显示直播信息',
      hideInfo: '隐藏直播信息',
      overlayOpacity: '浮层不透明度',
      backdrop: '背景',
      hideDelay: '隐藏延迟',
      chatWidth: '聊天宽度',
      compact: '紧凑',
      default: '默认',
      wide: '宽',
      max: '最大',
      groupChat: '聊天',
      dockLeft: '聊天停靠在左侧',
      openAsOverlay: '以浮层打开聊天',
      openOnFullscreen: '全屏时打开聊天',
      messagesOnly: '仅消息',
      groupOverlay: '浮层',
      autoHideOverlay: '自动隐藏浮层聊天',
      groupInfo: '直播信息',
      showActions: '显示关注、订阅和分享',
      showTags: '显示标签',
      groupControls: '控件',
      autoHideControls: '自动隐藏控件',
      groupAds: '广告',
      muteAds: '广告静音',
      reset: '重置设置',
    }),
  });
  const kickLang = () => {
    const lang = (document.documentElement && document.documentElement.lang) || '';
    return String(lang).toLowerCase().split('-')[0];
  };
  const uiText = () => {
    const lang = kickLang();
    return Object.prototype.hasOwnProperty.call(UI_TEXT, lang) ? UI_TEXT[lang] : UI_TEXT.en;
  };

  // ── Single instance ────────────────────────────────────────────────────
  // Two copies of the script on one page (a manual install left alongside the
  // auto-updating one, or two managers both enabled) do not run side by side —
  // they fight. Every node we own is addressed by a fixed id, so the second
  // instance's `ensureButton` adopts the *first* instance's control cluster
  // instead of building its own, and from then on both write their own state
  // onto the same element: each `syncControlState()` rewrites
  // `kfc-settings-open` from its own `settingsOpen` flag, so an open settings
  // panel is slammed shut by whichever instance ran last and re-opened by the
  // other on the next mousemove or idle tick. The panel visibly flickers open
  // and closed for as long as the pointer keeps moving.
  //
  // The marker lives on `<html>` rather than on `window` because managers
  // disagree on whether userscripts share a JS context (`@grant none` runs in
  // the page context, sandboxed grants do not) — but they always share the DOM.
  // React never rewrites attributes on the root element, so the marker sticks
  // (the script already keeps its own classes and CSS variables there).
  const INSTANCE_ATTR = 'data-kfc-running';
  const alreadyRunning = document.documentElement.getAttribute(INSTANCE_ATTR);
  if (alreadyRunning) {
    console.warn(
      '[KickFullscreenChat] ' +
        uiText().duplicate.replace('{v}', VERSION).replace('{running}', alreadyRunning)
    );
    return;
  }
  document.documentElement.setAttribute(INSTANCE_ATTR, VERSION);
  // Logged once at boot, always — not gated by debug mode — like every kick-*
  // script, so the running build shows in the console without asking for it.
  console.info('[KickFullscreenChat] ' + uiText().active.replace('{v}', VERSION));

  // Verbose console logging. Toggle at runtime with KickFullscreenChat.debug()
  // — the choice is persisted with the rest of the settings.
  let debugOn = false;

  const BTN_ID = 'kfc-toggle-btn';
  const MODE_BTN_ID = 'kfc-mode-btn';
  const INFO_BTN_ID = 'kfc-info-btn';
  const SETTINGS_BTN_ID = 'kfc-settings-btn';
  const SETTINGS_PANEL_ID = 'kfc-settings-panel';
  const RESIZE_ID = 'kfc-resize-handle';
  const WRAP_ID = 'kfc-toggle-wrap';
  const TOAST_ID = 'kfc-toast';
  const STYLE_ID = 'kfc-style';
  const INFO_ID = 'kfc-info-overlay';
  const BAR_MORE_ID = 'kfc-bar-more';
  const VIDEO_ROOT_ATTR = 'data-kfc-video-root';
  const VIDEO_FRAME_ATTR = 'data-kfc-video-frame';
  const VIDEO_EL_ATTR = 'data-kfc-video-el';
  const VIDEO_OVERLAY_ATTR = 'data-kfc-video-overlay';
  const VIDEO_STRIP_ATTR = 'data-kfc-video-strip';
  const CHAT_WIDTH = '340px';
  // Bounds for the draggable chat-width divider (px). Min keeps chat usable;
  // max is also capped to 60vw at drag time so chat never dominates.
  const CHAT_WIDTH_MIN = 260;
  const CHAT_WIDTH_MAX = 640;
  // While dragging the resize divider, if the raw (unclamped) pointer width
  // drops below this many px past the minimum, releasing closes the side
  // chat instead of clamping. The slot dims mid-drag so the user sees the
  // close arming before committing.
  const CHAT_WIDTH_CLOSE_THRESHOLD = 180;
  const INFO_MAX_WIDTH = '720px';
  const VIEWER_COUNT_COLOR = '#53fc18';

  // UI preferences. Persisted to localStorage (see loadSettings/saveSettings)
  // so they survive a page reload, and kept in memory across open/close and
  // fullscreen toggles within a session.
  let chatWidth = parseInt(CHAT_WIDTH, 10); // current chat-panel width in px
  let chatSide = 'right';                   // which edge the chat docks to: 'right' | 'left'
  let overlayMode = false;                  // chat floats over video vs. shrinks it
  let infoHidden = false;                   // streamer-info overlay hidden by the user
  let infoBgOpacity = 60;                   // streamer-info overlay backdrop opacity, 0..90 (%)
  let infoShowActions = true;               // Kick's follow / sub / share buttons in the info overlay
  let infoShowTags = true;                  // Kick's tag pills in the info overlay
  let overlayOpacity = 55;                  // overlay chat opacity, 25..90 (%)
  let autoHideOverlayChat = true;           // fade overlay chat while player is idle
  let autoHideControls = true;              // fade the top control cluster / info overlay
  let openChatAsOverlay = false;            // default layout when the Chat button opens chat
  let restoreChatOnFullscreen = true;       // auto-open side chat whenever entering fullscreen
  let messagesOnly = false;                 // hide Kick's chat header, banners, pinned messages and composer
  let idleDelayMs = 4000;                   // delay before our fullscreen UI fades
  let muteAds = false;                      // mute the player while Kick plays an ad (opt-in)
  let settingsOpen = false;

  // ── Persistence ────────────────────────────────────────────────────────
  // Settings are saved to localStorage under one key. Writes are debounced so
  // the per-frame width updates during a divider drag don't hammer storage.
  // All access is wrapped in try/catch (private-mode / disabled storage).
  const SETTINGS_KEY = 'kfc-settings';
  let saveTimer = 0;
  const saveSettings = () => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          chatWidth,
          chatSide,
          overlayOpacity,
          autoHideOverlayChat,
          autoHideControls,
          openChatAsOverlay,
          restoreChatOnFullscreen,
          messagesOnly,
          idleDelayMs,
          muteAds,
          infoHidden,
          infoBgOpacity,
          infoShowActions,
          infoShowTags,
          debug: debugOn,
        })
      );
    } catch (_) {}
  };
  const persistSettings = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveSettings();
    }, 300);
  };
  // Write a debounced save out now. Without this, a setting changed in the
  // last 300ms before a reload, a tab close or a full navigation was lost: the
  // timer simply died with the page.
  const flushSettings = () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = 0;
    saveSettings();
  };
  // Validate and apply a settings object — the whole saved blob at startup, or
  // only the fields another tab changed (see onSettingsStorage). Fields that are
  // missing or invalid leave the current value alone.
  const applySettings = (s) => {
    if (!s || typeof s !== 'object') return;
    // Static bounds only — deliberately NOT clampChatWidth(). Its third term
    // (60% of the viewport) would be measured here against the *windowed*
    // viewport at document-idle, which is the wrong one to measure against:
    // nothing re-clamps on fullscreen entry, and the fullscreen viewport is
    // never narrower than the windowed one. Worse, the clamped-down value is
    // written straight back to storage by the next persistSettings() from any
    // unrelated toggle, so opening Kick once in a narrow window would
    // permanently shrink a width the user set on a wide display (640 in a
    // 700px window → 420, saved). setChatWidth still applies the viewport term
    // on every drag and preset, where there is a live viewport to measure.
    // Number.isFinite rather than typeof: JSON can hand back NaN-producing
    // garbage that `typeof === 'number'` waves through into `--kfc-chat-width`.
    if (Number.isFinite(s.chatWidth)) {
      chatWidth = Math.max(CHAT_WIDTH_MIN, Math.min(s.chatWidth, CHAT_WIDTH_MAX));
    }
    if (s.chatSide === 'left' || s.chatSide === 'right') chatSide = s.chatSide;
    if (typeof s.overlayOpacity === 'number') {
      overlayOpacity = Math.max(25, Math.min(90, s.overlayOpacity));
    }
    if (typeof s.autoHideOverlayChat === 'boolean') autoHideOverlayChat = s.autoHideOverlayChat;
    if (typeof s.autoHideControls === 'boolean') autoHideControls = s.autoHideControls;
    if (typeof s.openChatAsOverlay === 'boolean') openChatAsOverlay = s.openChatAsOverlay;
    if (typeof s.restoreChatOnFullscreen === 'boolean') {
      restoreChatOnFullscreen = s.restoreChatOnFullscreen;
    }
    if (typeof s.messagesOnly === 'boolean') messagesOnly = s.messagesOnly;
    if (typeof s.idleDelayMs === 'number') {
      idleDelayMs = Math.max(2000, Math.min(8000, s.idleDelayMs));
    }
    if (typeof s.muteAds === 'boolean') muteAds = s.muteAds;
    if (typeof s.infoHidden === 'boolean') infoHidden = s.infoHidden;
    if (typeof s.infoBgOpacity === 'number') {
      infoBgOpacity = Math.max(0, Math.min(90, s.infoBgOpacity));
    }
    if (typeof s.infoShowActions === 'boolean') infoShowActions = s.infoShowActions;
    if (typeof s.infoShowTags === 'boolean') infoShowTags = s.infoShowTags;
    if (typeof s.debug === 'boolean') debugOn = s.debug;
  };
  const loadSettings = () => {
    let s;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      s = JSON.parse(raw);
    } catch (_) {
      return;
    }
    applySettings(s);
  };

  const BTN_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M8.79052 14.6146L10.9377 12.4674L8.46758 10.0061L2 16.4737L8.46758 22.9413L10.9377 20.4799L8.57232 18.1058H30V14.6146H8.79052Z"></path><path d="M29.9643 6H12.5079V9.49127H29.9643V6Z"></path><path d="M29.9643 23.4564H12.5079V26.9476H29.9643V23.4564Z"></path></svg>`;
  // Layout-mode icon: two columns (video + chat) for the side/overlay toggle.
  const MODE_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="11" height="14" rx="2"></rect><rect x="16" y="5" width="5" height="14" rx="2"></rect></svg>`;
  // Info "i in a circle" icon for the streamer-info overlay show/hide toggle.
  const INFO_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`;
  // Gear icon for the settings popover.
  const SETTINGS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58-1.92-3.32-2.39.96a7.33 7.33 0 0 0-1.63-.94L14.86 3h-3.72l-.36 3.18c-.58.23-1.13.54-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.6 7.6 0 0 0-.06.94c0 .31.02.63.06.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.4 1.05.71 1.63.94l.36 3.18h3.72l.36-3.18c.58-.23 1.13-.54 1.63-.94l2.39.96 1.92-3.32-2.03-1.58zM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5z"></path></svg>`;
  // Chevron for the folded chat action bar's "Show more" button (Material
  // expand_more); it turns over while the bar is open.
  const BAR_MORE_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"></path></svg>`;

  // Selectors — Kick changes its markup occasionally, so we try a few.
  const VIDEO_WRAPPER_SELECTORS = [
    '#injected-channel-player',
    '[data-testid="player"]',
    '.video-player',
    '.vjs-tech',
  ];
  const CHAT_SELECTORS = [
    '#chatroom',
    '[data-testid="chatroom"]',
    '#channel-chatroom',
    'aside[class*="chat" i]',
    'div[class*="Chatroom" i]',
    'div[class*="chatroom" i]',
    'section[class*="chat" i]',
  ];
  // Twitch-style channel info overlay (avatar / streamer name + verified badge /
  // title with emotes / game + viewer count). We clone Kick's existing
  // streamer card into the fullscreen element so the user can see who they're
  // watching while the player is fullscreen. Tried in order; first match wins.
  // Add fallback selectors at the end as Kick's markup changes.
  const STREAMER_INFO_SELECTORS = [
    '[data-testid="streamer-info"]',
    '[data-testid="channel-info"]',
    '[data-testid="user-channel-info"]',
    '[data-testid="channel-header"]',
    '#channel-header',
    '#streamer-info',
    '#channel-info',
  ];
  // Kick's stream title. It is an <h2>, so the styling meant for the channel
  // name — which matches headings — has to leave it out by name.
  const STREAM_TITLE_SEL = '[data-testid="livestream-title"]';
  // Kick's follow / subscribe buttons. They sit in a column beside the
  // channel card rather than inside it; the card search widens to the parent
  // holding both when it finds them, so the overlay carries Kick's actions.
  const INFO_ACTION_SELECTORS =
    '[data-testid="follow-button"], [data-testid="sub-button"]';
  // Viewer-count badge (e.g., "770 Viewers"). Cloned into the overlay as a
  // separate child below the streamer card, since Kick renders it as its
  // own element outside the compact streamer card we clone.
  const VIEWER_COUNT_SELECTORS = [
    '[data-testid="viewer-count"]',
    '[data-testid="viewers-count"]',
    '[data-testid*="viewer-count" i]',
    '[aria-label*="viewer" i][aria-label*="count" i]',
  ];
  // Matches "770 Viewers" / "1,250 Viewers" / "1 234 sledujících" / etc.
  // Used by the content-based fallback to locate the viewer-count badge
  // when no direct selector matches. Common languages covered; add more
  // tokens if Kick localises into a script not listed here.
  // The trailing guard is `(?!\p{L})` (with the /u flag), NOT `\b`: outside
  // /u, JS `\w` is ASCII-only, so a `\b` after a token ending in a non-ASCII
  // letter (зрителей, diváků, مشاهد) can never match at end-of-string and the
  // alternative is dead. The negative lookahead also beats `\b` on the ASCII
  // tokens — it rejects "770 viewership", which `\b` would have accepted.
  const VIEWER_COUNT_RE =
    /\b\d[\d, . ]*\s*(?:viewers?|sledujících|diváků|spectateurs|zuschauer|widzów|зрителей|просмотров|глядач(?:ів|і)?|переглядів|espectadores|spettatori|視聴者|시청자|مشاهد)(?!\p{L})/iu;

  const log = (...args) => {
    if (debugOn) console.log('[KickFullscreenChat]', ...args);
  };
  const warn = (...args) => console.warn('[KickFullscreenChat]', ...args);

  // ── Recent page errors ─────────────────────────────────────────────────
  // Kick's chat error boundary ("We are sorry, but something went wrong")
  // swallows the error that tripped it, and by the time anyone opens the
  // console the culprit (Kick itself, this script, or a sibling script
  // touching React's nodes) is buried under unrelated noise. So we keep the
  // last few page errors in memory — uncaught errors, unhandled rejections
  // and, while side chat is open, console.error calls, which is where React
  // reports an error a boundary caught — and print them when the chat
  // crashes. Memory only, never persisted; the console.error wrapper passes
  // every call through unchanged.
  const RECENT_ERRORS_MAX = 15;
  const ERROR_TEXT_MAX = 500;
  const ERROR_STACK_MAX = 3000;
  const recentErrors = [];

  const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);

  const describeErrorValue = (value) => {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value) ?? String(value);
    } catch (_) {
      return String(value);
    }
  };

  const recordError = (source, values) => {
    try {
      const error = values.find((v) => v instanceof Error);
      recentErrors.push({
        at: Date.now(),
        source,
        message: clip(values.map(describeErrorValue).join(' '), ERROR_TEXT_MAX),
        stack: clip(String(error?.stack || ''), ERROR_STACK_MAX),
      });
      if (recentErrors.length > RECENT_ERRORS_MAX) recentErrors.shift();
    } catch (_) {
      // A diagnostic must never be what breaks the page.
    }
  };

  const formatRecentErrors = (now = Date.now()) =>
    recentErrors.map((e) => ({
      ago: `${((now - e.at) / 1000).toFixed(1)}s`,
      time: new Date(e.at).toLocaleTimeString(),
      source: e.source,
      message: e.message,
      stack: e.stack,
    }));

  const dumpRecentErrors = (reason) => {
    const entries = formatRecentErrors();
    if (!entries.length) {
      warn(`${reason} — no page errors were recorded before it.`);
      return;
    }
    warn(`${reason} — the last ${entries.length} page error(s), oldest first:`);
    entries.forEach((e, i) => {
      warn(`#${i + 1} ${e.ago} ago [${e.source}] ${e.message}${e.stack ? `\n${e.stack}` : ''}`);
    });
  };

  window.addEventListener('error', (e) => {
    recordError('uncaught', [e.error || e.message || 'unknown error']);
  });
  window.addEventListener('unhandledrejection', (e) => {
    recordError('unhandled rejection', [e.reason]);
  });
  // console.error is wrapped only while side chat is open — the only time the
  // crash watcher needs it. DevTools labels every console message with the
  // line that called console.error, and with the wrapper installed that line
  // is ours: every error Kick or another script logged was shown as coming
  // from this script, on every Kick page. Stopping puts the page's function
  // back only if it is still ours on top; if another script wrapped over us
  // since, unhooking would cut it off too, so the wrapper stays in its chain
  // and just stops recording until the next start reuses it.
  let consoleErrorWrapper = null;
  let consoleErrorBeneath = null;
  let capturingConsoleErrors = false;
  const startConsoleErrorCapture = () => {
    capturingConsoleErrors = true;
    if (consoleErrorWrapper) return;
    const beneath = console.error;
    consoleErrorBeneath = beneath;
    consoleErrorWrapper = function (...args) {
      if (capturingConsoleErrors) recordError('console.error', args);
      return beneath.apply(this, args);
    };
    console.error = consoleErrorWrapper;
  };
  const stopConsoleErrorCapture = () => {
    capturingConsoleErrors = false;
    if (consoleErrorWrapper && console.error === consoleErrorWrapper) {
      console.error = consoleErrorBeneath;
      consoleErrorWrapper = null;
      consoleErrorBeneath = null;
    }
  };

  const getCurrentChannelPath = () => {
    const slug = (window.location.pathname || '').split('/').filter(Boolean)[0];
    if (!slug || slug.includes('.')) return null;
    return `/${slug}`;
  };

  const exitFullscreenBeforeAction = (action) => {
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
      action();
      return;
    }
    if (document.exitFullscreen) {
      document.exitFullscreen().then(action).catch(action);
      return;
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      setTimeout(action, 50);
      return;
    }
    action();
  };

  const clickNativeOrNavigate = (nativeEl, fallbackUrl) => {
    exitFullscreenBeforeAction(() => {
      if (nativeEl && document.body.contains(nativeEl)) {
        nativeEl.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
        return;
      }
      if (fallbackUrl) window.location.href = fallbackUrl;
    });
  };

  const shouldHandleOverlayNavigation = (event) => {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  };

  // The overlay's links and buttons sit where the pointer rests as often as
  // the cluster's do, so they take the same guards: real input only, and not
  // the click that re-activates the window (see controlsAcceptActivation).
  // Stakes are higher here — one of them is Follow.
  const overlayAcceptsActivation = (event) =>
    event.isTrusted && controlsAcceptActivation({ pointer: !!event.detail });

  const wireOverlayNavigation = (el, getNativeEl, fallbackUrl) => {
    if (!el || el.dataset.kfcNavWired === 'true') return;
    el.dataset.kfcNavWired = 'true';
    el.addEventListener('click', (event) => {
      if (!shouldHandleOverlayNavigation(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!overlayAcceptsActivation(event)) return;
      clickNativeOrNavigate(getNativeEl?.(), fallbackUrl);
    });
  };

  // Pointer input relayed from an overlay clone to Kick's original button, at
  // the original's own coordinates. Synthetic, so none of it can pass the
  // isTrusted gates on this script's own controls.
  const firePointer = (target, type, x, y, extra = {}) => {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    target.dispatchEvent(new Ctor(type, {
      bubbles: !/enter|leave/.test(type),
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      pointerType: 'mouse',
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type.endsWith('down') ? 1 : 0,
      ...extra,
    }));
  };
  const hoverNative = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      firePointer(el, type, x, y);
    }
  };
  // Kick's tooltips (Radix) stay open after the pointer leaves the button
  // until it is seen moving away from both button and tooltip, so the leave
  // is followed — once React has committed it — by a move well below.
  const unhoverNative = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    for (const type of ['pointerout', 'mouseout']) {
      firePointer(el, type, x, r.bottom + 2, { relatedTarget: document.body });
    }
    // Leave events don't bubble: a real pointer sends one to every element it
    // leaves. Kick's tooltip listens on its trigger, which can be a wrapper
    // around the button (report, unfollow) — so walk up to the element that
    // owns an open tooltip, a few levels at most.
    for (let node = el, depth = 0; node && node !== document.body && depth < 4; node = node.parentElement, depth++) {
      for (const type of ['pointerleave', 'mouseleave']) {
        firePointer(node, type, x, r.bottom + 2, { relatedTarget: document.body });
      }
      if (node.hasAttribute('aria-describedby')) break;
    }
    setTimeout(() => {
      firePointer(document.body, 'pointermove', x, r.bottom + 80);
      firePointer(document.body, 'mousemove', x, r.bottom + 80);
    }, 50);
  };
  // A whole click, the way a mouse makes one — not a bare click event. Kick's
  // tooltips count the pointer as arrived only after a hover, so after a bare
  // click the next real pass over the button pops its tooltip up over the menu
  // the click just opened; and its bell menu opens on the press, not the click.
  const clickNative = (el) => {
    hoverNative(el);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      firePointer(el, type, x, y);
    }
  };

  // ── Kick's popups for the overlay's buttons ──────────────────────────
  // In fullscreen Kick renders its menus, dialogs and tooltips inside the
  // fullscreen element (its portals follow document.fullscreenElement), so
  // pressing an overlay button's original in place opens them where they can
  // be seen — no need to leave fullscreen. Dialogs centre themselves. Popups
  // anchored to a button (tooltips, the share and bell menus) are positioned
  // for the original, though, which sits wherever the page beneath happens to
  // lay it out; those are moved next to the overlay's copy of the button.
  // They stay Kick's own nodes, in place — only a CSS `translate` is added,
  // which composes with the `transform` Kick's positioning keeps writing.
  const KICK_POPPER_SEL = '[data-radix-popper-content-wrapper]';
  let overlayTwins = new Map(); // Kick's original button -> its overlay clone
  const anchoredPopups = new Map(); // popper wrapper -> MutationObserver
  let popupHostObserver = null;
  let hoveredNative = null;

  // The original a popup belongs to. Kick points at what it opens through
  // aria-controls (menus) or aria-describedby (tooltips), from the button or
  // from a wrapper around it — the report and unfollow tooltips hang off a
  // <div> holding the button. Returns the button and that trigger, which is
  // what Kick measures the popup's position from.
  const popupOwner = (wrapper) => {
    for (const el of wrapper.querySelectorAll('[id]')) {
      const id = CSS.escape(el.id);
      for (const trigger of document.querySelectorAll(`[aria-controls~="${id}"], [aria-describedby~="${id}"]`)) {
        if (isKfcOwnedNode(trigger)) continue;
        const owners = Array.from(overlayTwins.keys()).filter((native) => trigger.contains(native));
        if (owners.length === 1) return { native: owners[0], trigger };
      }
    }
    return null;
  };

  // Kick's own side and alignment (it reports both on the content), measured
  // against the overlay's button instead of the original; the gap is Kick's
  // own, read off its placement. Flipped to the other side when that runs
  // off the screen, then kept within it.
  const placePopup = (wrapper) => {
    const owner = popupOwner(wrapper);
    const btn = owner && overlayTwins.get(owner.native);
    const [shiftX, shiftY] = (wrapper.dataset.kfcShift || '0 0').split(' ').map(Number);
    if (!btn?.isConnected) {
      if (wrapper.dataset.kfcShift) {
        delete wrapper.dataset.kfcShift;
        wrapper.style.removeProperty('translate');
      }
      return;
    }
    const content = wrapper.firstElementChild;
    const side = content?.getAttribute('data-side') || 'bottom';
    const align = content?.getAttribute('data-align') || 'center';
    const w = wrapper.getBoundingClientRect();
    const left = w.left - shiftX; // where Kick put it
    const top = w.top - shiftY;
    const n = owner.trigger.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const kickGap = {
      top: n.top - (top + w.height),
      bottom: top - n.bottom,
      left: n.left - (left + w.width),
      right: left - n.right,
    }[side];
    const gap = kickGap >= 0 && kickGap <= 24 ? kickGap : 4;
    const alignAt = (start, size, extent) =>
      align === 'start' ? start : align === 'end' ? start + size - extent : start + (size - extent) / 2;
    let x;
    let y;
    if (side === 'left' || side === 'right') {
      x = side === 'left' ? b.left - gap - w.width : b.right + gap;
      if (x < 4 || x + w.width > window.innerWidth - 4) {
        x = side === 'left' ? b.right + gap : b.left - gap - w.width;
      }
      y = alignAt(b.top, b.height, w.height);
    } else {
      y = side === 'top' ? b.top - gap - w.height : b.bottom + gap;
      if (y < 4 || y + w.height > window.innerHeight - 4) {
        y = side === 'top' ? b.bottom + gap : b.top - gap - w.height;
      }
      x = alignAt(b.left, b.width, w.width);
    }
    x = Math.max(4, Math.min(x, window.innerWidth - w.width - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - w.height - 4));
    const shift = `${Math.round(x - left)} ${Math.round(y - top)}`;
    // Our own write re-triggers the observer; an unchanged result stops there.
    if (wrapper.dataset.kfcShift === shift) return;
    wrapper.dataset.kfcShift = shift;
    const [dx, dy] = shift.split(' ');
    wrapper.style.setProperty('translate', `${dx}px ${dy}px`, 'important');
  };

  const placeAllPopups = () => anchoredPopups.forEach((_observer, wrapper) => placePopup(wrapper));

  const trackPopup = (wrapper) => {
    if (anchoredPopups.has(wrapper) || !popupOwner(wrapper)) return;
    let frame = 0;
    // Kick re-writes the wrapper's style as it repositions and its content
    // can change size (a menu filling in), so re-place on both.
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (anchoredPopups.has(wrapper)) placePopup(wrapper);
      });
    });
    observer.observe(wrapper, {
      attributes: true,
      attributeFilter: ['style'],
      childList: true,
      subtree: true,
      characterData: true,
    });
    anchoredPopups.set(wrapper, observer);
    placePopup(wrapper);
  };

  const untrackPopup = (wrapper) => {
    anchoredPopups.get(wrapper)?.disconnect();
    anchoredPopups.delete(wrapper);
  };

  const startPopupAnchoring = (fsEl) => {
    stopPopupAnchoring();
    popupHostObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(KICK_POPPER_SEL)) trackPopup(node);
          else node.querySelectorAll?.(KICK_POPPER_SEL).forEach(trackPopup);
        });
        m.removedNodes.forEach((node) => {
          if (anchoredPopups.has(node)) untrackPopup(node);
        });
      }
    });
    popupHostObserver.observe(fsEl, { childList: true });
    fsEl.querySelectorAll(`:scope > ${KICK_POPPER_SEL}`).forEach(trackPopup);
    window.addEventListener('resize', placeAllPopups);
  };

  const stopPopupAnchoring = () => {
    popupHostObserver?.disconnect();
    popupHostObserver = null;
    anchoredPopups.forEach((_observer, wrapper) => {
      untrackPopup(wrapper);
      delete wrapper.dataset.kfcShift;
      wrapper.style.removeProperty('translate');
    });
    window.removeEventListener('resize', placeAllPopups);
  };

  // Hovering a clone hovers its original, so Kick shows that button's tooltip
  // (a subscription's end date on the sub button, "Share" on share) — inside
  // the fullscreen element, moved next to the clone by placePopup. Every way
  // out un-hovers it again, so no tooltip is left open on the page.
  // A reclone can replace the hovered clone under a still pointer, and the
  // replaced one never sees a pointerleave; so while hovering, any real move
  // that isn't over the current clone ends it.
  const onHoverPointerMove = (e) => {
    if (!e.isTrusted) return;
    const btn = hoveredNative && overlayTwins.get(hoveredNative);
    if (!btn || !(e.target instanceof Node) || !btn.contains(e.target)) setHoveredNative(null);
  };
  const setHoveredNative = (native) => {
    if (hoveredNative === native) return;
    if (hoveredNative?.isConnected) unhoverNative(hoveredNative);
    hoveredNative = native;
    if (native?.isConnected) hoverNative(native);
    if (native) window.addEventListener('pointermove', onHoverPointerMove, true);
    else window.removeEventListener('pointermove', onHoverPointerMove, true);
  };

  // Something Kick opened outside the fullscreen element — one of its dialogs
  // that doesn't follow the fullscreen element — can't be seen from here, so
  // leave fullscreen for it rather than open it invisibly.
  // Watched for a while, since some of Kick's dialogs load lazily.
  const KICK_OPENED_SEL = '[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]';
  const pressNativeInPlace = (native) => {
    const watcher = new MutationObserver((mutations) => {
      const openedOutside = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (el) => el instanceof Element && (el.matches(KICK_OPENED_SEL) || !!el.querySelector(KICK_OPENED_SEL))
        )
      );
      if (!openedOutside) return;
      watcher.disconnect();
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        exitFullscreenBeforeAction(() => {});
      }
    });
    watcher.observe(document.body, { childList: true });
    setTimeout(() => watcher.disconnect(), 1500);
    clickNative(native);
  };

  // Kick's action buttons (follow, subscribe, gift subs, share, report) and
  // the gifted-subs badge are cloned without their handlers. Pressing one
  // presses Kick's original, in place; hovering one hovers it (see above).
  const wireOverlayAction = (btn, native) => {
    if (btn.dataset.kfcNavWired === 'true') return;
    btn.dataset.kfcNavWired = 'true';
    overlayTwins.set(native, btn);
    btn.addEventListener('pointerenter', (event) => {
      if (!event.isTrusted || event.pointerType === 'touch') return;
      setHoveredNative(native);
    });
    btn.addEventListener('pointerleave', () => {
      if (hoveredNative === native) setHoveredNative(null);
    });
    // The press is relayed to the original, so the real one stops here. Kick's
    // menus close on a press outside themselves, and to Kick a press on the
    // clone is outside: the open share menu closed on the press, then the
    // relayed click toggled it open again, so a second click never closed it.
    // The relayed press lands on Kick's own button, which Kick treats as the
    // toggle — and still counts as outside for any other open menu.
    for (const type of ['pointerdown', 'mousedown']) {
      btn.addEventListener(type, (event) => event.stopPropagation());
    }
    // A clone left focused would take the Space meant to play/pause.
    btn.addEventListener('pointerdown', () => setTimeout(() => btn.blur(), 0));
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!overlayAcceptsActivation(event)) return;
      if (native.isConnected) pressNativeInPlace(native);
    });
  };

  // Non-blocking on-screen toast for surfacing errors without an `alert()` modal,
  // which would steal focus and can break fullscreen mode in some browsers.
  const showToast = (message) => {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
    }
    toast.textContent = message;
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (toast.parentNode !== host) host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('kfc-toast-show'));
    clearTimeout(toast._kfcTimer);
    toast._kfcTimer = setTimeout(() => {
      toast.classList.remove('kfc-toast-show');
    }, 4000);
  };

  const pick = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // Fallback: locate the chat container by walking up from the chat input/textarea.
  const findChatByInput = () => {
    const candidates = document.querySelectorAll(
      'textarea, [contenteditable="true"], input[type="text"]'
    );
    for (const inp of candidates) {
      const placeholder = (inp.getAttribute('placeholder') || '').toLowerCase();
      const aria = (inp.getAttribute('aria-label') || '').toLowerCase();
      const text = placeholder + ' ' + aria;
      if (/chat|message|send a message/.test(text)) {
        // Walk up to a sizable ancestor that looks like a panel.
        let node = inp;
        for (let i = 0; i < 10 && node && node.parentElement; i++) {
          node = node.parentElement;
          const rect = node.getBoundingClientRect();
          if (rect.height > 300 && rect.width > 200 && rect.width < window.innerWidth * 0.6) {
            return node;
          }
        }
      }
    }
    return null;
  };

  const findChat = () => pick(CHAT_SELECTORS) || findChatByInput();

  const getChatLookupDiagnostics = () => {
    const selectorResults = CHAT_SELECTORS.map((selector) => ({
      selector,
      matched: !!document.querySelector(selector),
    }));
    const chatInputs = Array.from(
      document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')
    ).map((input) => ({
      tag: input.tagName.toLowerCase(),
      placeholder: input.getAttribute('placeholder') || '',
      ariaLabel: input.getAttribute('aria-label') || '',
    }));
    return {
      selectorResults,
      chatInputs,
      path: window.location.pathname,
    };
  };

  // Kick toggles a `data-chat` attribute on a player ancestor to drive chat visibility
  // via CSS (Tailwind `group-data-[chat=false]/main:*` rules). Set it to "true" before
  // we move the chat node, otherwise the chat stays hidden inside our split layout.
  const setKickDataChat = (value) => {
    const els = document.querySelectorAll('[data-chat]');
    els.forEach((el) => el.setAttribute('data-chat', value));
    return els.length;
  };

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WRAP_ID} {
        position: absolute;
        top: 1.75rem;
        right: 1.75rem;
        z-index: 2147483647;
        pointer-events: auto;
        opacity: 1;
        transition: opacity .2s ease, right .15s ease;
        display: flex;
        align-items: center;
        gap: .5rem;
      }
      /* When chat is open the panel covers the top-right corner, so push the
         control cluster left of the chat (over the video) instead of on top
         of the chat messages. Keyed on a class on our own wrap (not .kfc-active
         on fsEl, which Kick's React strips on re-render). */
      #${WRAP_ID}.kfc-chat-open {
        right: calc(1.75rem + var(--kfc-chat-width, ${CHAT_WIDTH}));
      }
      /* Chat docked left frees the right corner, so keep the control cluster
         flush to the right edge instead of insetting it by the chat width. */
      html.kfc-chat-left #${WRAP_ID}.kfc-chat-open {
        right: 1.75rem;
      }
      #${WRAP_ID}.kfc-resizing {
        transition: opacity .2s ease;
      }
      /* Mirrors Kick's own controls-overlay fade so the toggle button
         disappears alongside the timeline / play controls when the user is
         idle, and reappears as soon as the mouse moves. */
      #${WRAP_ID}.kfc-idle {
        opacity: 0;
        pointer-events: none;
      }
      /* pointer-events is a discrete property — it flips the instant
         .kfc-idle is dropped, while opacity still has the .2s fade ahead of
         it, and an opacity:0 element is hit-tested normally. So without this
         the whole cluster is fully clickable while it is still invisible, and
         a click that arrives in that window lands on whichever control sits
         under the cursor instead of on the video. The common way to hit it is
         the click that re-activates the browser window on macOS: moving the
         pointer over the window un-idles the controls, and if the cursor was
         parked near the top-right corner the activating click opens the
         settings panel "randomly". Stay click-through until the fade has
         actually finished (see CONTROLS_FADE_MS, which must match the
         transition duration above). Scoped so the buttons fall through to the
         player but panel children — ours and the one kick-quality-saver mounts
         into this wrap — keep working. */
      #${WRAP_ID}.kfc-unarmed {
        pointer-events: none;
      }
      #${WRAP_ID}.kfc-unarmed > *:not(button) {
        pointer-events: auto;
      }
      /* Chat toggle button — styled in the kick-* family design language
         (dark #101013 surface, neutral translucent border, blur backdrop,
         layered shadow) rather than reusing Kick's native button classes.
         The single green (#22c55e) accent is the icon; the surface stays
         neutral per the "one green accent per component" rule. Padding, type
         and the 18px icon match kick-quality-saver's video button (7px 12px,
         500 13px/1.2) and .kfc-control-btn, so every button in the cluster —
         including the kqs one docked beside them — is the same 34px tall. */
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 7px 12px;
        font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: background .08s;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      /* Hover/focus is the design system's green tint (rgba(34,197,94,.1))
         composited over the opaque #101013 surface so text contrast holds. */
      #${BTN_ID}:hover,
      #${BTN_ID}:focus-visible {
        background: linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013;
      }
      #${BTN_ID}:disabled {
        opacity: .3;
        pointer-events: none;
      }
      #${BTN_ID} svg {
        width: 18px;
        height: 18px;
        fill: #22c55e;
        transition: transform .15s ease;
      }
      .kfc-active #${BTN_ID} svg { transform: scaleX(-1); }

      /* Icon-only control buttons (layout-mode + info toggle), same
         kick-* family glass surface as the Chat button but square and compact.
         The green icon is the single accent per the design system. */
      .kfc-control-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 7px;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: background .08s;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      .kfc-control-btn:hover,
      .kfc-control-btn:focus-visible {
        background: linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013;
      }
      .kfc-control-btn svg {
        width: 18px;
        height: 18px;
        fill: #22c55e;
      }
      /* When the info overlay is hidden, dim the toggle's icon so its state
         reads as "off" without inventing a new colour token. */
      #${INFO_BTN_ID}.kfc-off svg { fill: rgba(255,255,255,.45); }

      /* Visibility: the Chat button only shows when chat is closed; the
         layout-mode toggle only when chat is open. The info toggle is always
         available in fullscreen. All keyed on classes on our own nodes (the
         wrap / buttons / overlay), NOT on .kfc-active on fsEl — Kick's React
         rewrites fsEl's className on re-render and strips our class, which
         would intermittently revert these controls. */
      #${MODE_BTN_ID} { display: none; }
      #${WRAP_ID}.kfc-chat-open #${MODE_BTN_ID} { display: inline-flex; }
      #${WRAP_ID}.kfc-chat-open #${BTN_ID} { display: none; }
      /* Messages only hides Kick's chat header and with it Kick's Hide chat
         button, so Chat stays in the cluster, pressed, as the way to close. */
      #${WRAP_ID}.kfc-chat-open.kfc-messages-only #${BTN_ID} {
        display: inline-flex;
        background: linear-gradient(rgba(34,197,94,.18), rgba(34,197,94,.18)), #101013;
        border-color: rgba(34,197,94,.5);
      }
      /* Pressed/active look when overlay mode is on, so the toggle's state is
         legible without a second icon. */
      #${MODE_BTN_ID}.kfc-on {
        background: linear-gradient(rgba(34,197,94,.18), rgba(34,197,94,.18)), #101013;
        border-color: rgba(34,197,94,.5);
      }
      #${SETTINGS_BTN_ID}.kfc-on {
        background: linear-gradient(rgba(34,197,94,.18), rgba(34,197,94,.18)), #101013;
        border-color: rgba(34,197,94,.5);
      }
      /* The settings panel shares kick-quality-saver's panel design: a
         14px-radius card, a titled header with a red-on-hover close button,
         inset groups per topic, chips with a green ring when selected, and
         switches with an animated thumb. It is anchored under the control wrap
         (no modal backdrop), and it carries NO backdrop-filter: the surface is
         opaque, so blurring what sits behind it only costs a compositing
         layer over the video.

         max-height + overflow-y match kick-quality-saver's .kqs-card verbatim,
         including the 76vh: without them the panel simply ran off the bottom of
         the screen with no way to reach the last rows. At ~660px of content it
         already needs ~735px from the top of the fullscreen element, so a 720p
         display — or any browser zoom past ~110% — clipped "Reset settings"
         off-screen, and every settings row added since made that worse. 76vh
         clears the panel's own ~76px top offset on every display size (~7vh at
         1080p, ~10.5vh at 720p), so the anchored panel needs no tighter bound
         than the centered card kqs uses. The children never shrink into the
         cap — flex items keep their content-based min-height: auto — so the
         overflow scrolls instead. */
      #${SETTINGS_PANEL_ID} {
        position: absolute;
        top: calc(100% + .5rem);
        right: 0;
        width: 300px;
        max-height: 76vh;
        overflow-y: auto;
        display: none;
        flex-direction: column;
        gap: .7rem;
        padding: 1rem;
        color: #fff;
        background: #101013;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        box-shadow:
          0 24px 64px -16px rgba(0,0,0,.8),
          0 2px 10px rgba(0,0,0,.45),
          inset 0 1px 0 rgba(255,255,255,.06);
        box-sizing: border-box;
        font: 500 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #${WRAP_ID}.kfc-settings-open #${SETTINGS_PANEL_ID} {
        display: flex;
        animation: kfc-settings-rise .2s cubic-bezier(.16, 1, .3, 1);
      }
      /* Fade and drop only — no scale. kick-quality-saver's card rises with a
         scale(.97) as well, which reads as a zoom on its centred card, but on
         this panel, pinned under the gear, scaling around the centre slid the
         left edge — the one seen against the video — ~4.5px left as it opened
         (and around the top-right corner it would slide twice as far). */
      @keyframes kfc-settings-rise {
        from { opacity: 0; transform: translateY(-8px); }
      }
      #${SETTINGS_PANEL_ID} :focus-visible {
        outline: 2px solid rgba(34,197,94,.65);
        outline-offset: 2px;
      }
      /* The family scrollbar (kqs .kqs-card): thin, translucent, inset by a
         transparent border so the thumb doesn't touch the panel's rounded edge.
         Without this the panel would get the platform default, which is far
         heavier than the one the sibling panel shows on the same screen. */
      #${SETTINGS_PANEL_ID}::-webkit-scrollbar {
        width: 8px;
      }
      #${SETTINGS_PANEL_ID}::-webkit-scrollbar-track {
        background: transparent;
      }
      #${SETTINGS_PANEL_ID}::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.13);
        border: 2px solid transparent;
        background-clip: padding-box;
        border-radius: 999px;
      }
      /* That 8px track comes out of the content box, on the right only, so a
         panel tall enough to scroll sat 8px off-centre (17px of inset on the
         left, 25px on the right) and its rows stopped lining up with the
         control cluster above. Always reserving the track and taking its width
         back out of the right padding keeps both insets equal, and keeps the
         content the same width whether the panel scrolls or not. The track is
         transparent and has no thumb until there is something to scroll, so a
         panel that fits shows nothing. Only where ::-webkit-scrollbar sets the
         width: elsewhere the scrollbar is the platform's, of unknown size. */
      @supports selector(::-webkit-scrollbar) {
        #${SETTINGS_PANEL_ID} {
          overflow-y: scroll;
          padding-right: calc(1rem - 8px);
        }
      }

      /* Header: icon mark, name, close. */
      #${SETTINGS_PANEL_ID} .kfc-settings-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-mark {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: rgba(34,197,94,.1);
        border: 1px solid rgba(34,197,94,.22);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-mark svg {
        width: 16px;
        height: 16px;
        fill: #22c55e;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-name {
        font: 600 13.5px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: -.01em;
        color: #fff;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-close {
        margin-left: auto;
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 8px;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.09);
        color: #fca5a5;
        font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
      }
      /* Same treatment as the Reset chip below: a red glyph at rest on the
         neutral chip surface, red tint on hover. */
      #${SETTINGS_PANEL_ID} .kfc-settings-close:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-close:focus-visible {
        background: rgba(239,68,68,.14);
        border-color: rgba(248,113,113,.5);
        color: #fca5a5;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-close:active { transform: scale(.97); }

      /* One inset group per topic. */
      #${SETTINGS_PANEL_ID} .kfc-settings-group {
        display: flex;
        flex-direction: column;
        gap: .6rem;
        padding: .7rem;
        border-radius: 11px;
        background: rgba(255,255,255,.026);
        border: 1px solid rgba(255,255,255,.06);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-title {
        font: 600 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: .09em;
        text-transform: uppercase;
        color: rgba(255,255,255,.4);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-row {
        display: grid;
        gap: .45rem;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .75rem;
        font-weight: 600;
        color: rgba(255,255,255,.88);
      }
      /* The live value of each row (width in px, opacity %, delay in s) reads
         as a green tag, like the quality-saver panel's channel tag. */
      #${SETTINGS_PANEL_ID} .kfc-settings-label > span:last-child {
        flex: none;
        padding: 3px 5px;
        border-radius: 5px;
        font: 600 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #4ade80;
        background: rgba(34,197,94,.1);
        border: 1px solid rgba(34,197,94,.2);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check {
        display: flex;
        /* Text on the left, toggle switch on the right. row-reverse keeps the
           input first in the DOM (label/state wiring unchanged) while showing
           it on the trailing edge. */
        flex-direction: row-reverse;
        justify-content: space-between;
        align-items: center;
        gap: .75rem;
        padding: 7px 0;
        font-weight: 600;
        line-height: 1;
        color: rgba(255,255,255,.88);
        cursor: pointer;
      }
      /* Toggle rows live in a gap-less container (like the quality-saver
         panel's .kqs-switches), so their own 7px top/bottom padding is the
         only vertical spacing — each row gets equal padding above and below,
         with the hairline separator centered between adjacent rows. Putting
         them straight in the group instead would add the group's .6rem gap
         under every row, so the text rode high with a big gap beneath it. */
      #${SETTINGS_PANEL_ID} .kfc-settings-switches {
        display: flex;
        flex-direction: column;
      }
      /* When the toggle block ends a group, its last row's 7px bottom padding
         would sit on top of the group's own .7rem padding, leaving the group
         roomier at the bottom than the title-topped top. Pull it back by 7px so
         the last toggle sits the same distance from the group edge as the title
         does at the top. */
      #${SETTINGS_PANEL_ID} .kfc-settings-group > .kfc-settings-switches:last-child {
        margin-bottom: -7px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check + .kfc-settings-check {
        border-top: 1px solid rgba(255,255,255,.05);
      }
      #${SETTINGS_PANEL_ID} input[type="range"] {
        width: 100%;
        accent-color: #22c55e;
      }
      /* Plain sliders (hide delay, stream-info backdrop) get the same custom
         track/thumb as the opacity slider below, minus its checkerboard
         preview, so no native control is left sitting among the styled ones. */
      #${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input,
      #${SETTINGS_PANEL_ID} .kfc-settings-idle-input {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        background: transparent;
        cursor: pointer;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input::-webkit-slider-runnable-track,
      #${SETTINGS_PANEL_ID} .kfc-settings-idle-input::-webkit-slider-runnable-track {
        height: 6px;
        margin: 5px 0;
        border-radius: 999px;
        background: rgba(255,255,255,.12);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input::-moz-range-track,
      #${SETTINGS_PANEL_ID} .kfc-settings-idle-input::-moz-range-track {
        height: 6px;
        border-radius: 999px;
        background: rgba(255,255,255,.12);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input::-webkit-slider-thumb,
      #${SETTINGS_PANEL_ID} .kfc-settings-idle-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -5px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0,0,0,.5);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input::-moz-range-thumb,
      #${SETTINGS_PANEL_ID} .kfc-settings-idle-input::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0,0,0,.5);
      }
      /* Overlay-opacity slider: a custom track that previews the effect — a
         checkerboard (transparency) on the left fading into the near-opaque
         dark panel colour on the right, so the difference between low and high
         opacity is visible at a glance. The two other sliders keep the plain
         green native track above. */
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        background: transparent;
        cursor: pointer;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-webkit-slider-runnable-track {
        height: 14px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,.15);
        background:
          linear-gradient(90deg, rgba(14,14,16,.18), rgba(14,14,16,.96)),
          conic-gradient(#8a8a8a 0 25%, #cfcfcf 0 50%, #8a8a8a 0 75%, #cfcfcf 0);
        background-size: 100% 100%, 12px 12px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-moz-range-track {
        height: 14px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,.15);
        background:
          linear-gradient(90deg, rgba(14,14,16,.18), rgba(14,14,16,.96)),
          conic-gradient(#8a8a8a 0 25%, #cfcfcf 0 50%, #8a8a8a 0 75%, #cfcfcf 0);
        background-size: 100% 100%, 12px 12px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -2px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0,0,0,.5);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-opacity-input::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #22c55e;
        box-shadow: 0 1px 3px rgba(0,0,0,.5);
      }
      /* Settings toggles are styled as switches (the underlying control stays a
         native checkbox for state + accessibility). */
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        position: relative;
        flex: 0 0 auto;
        width: 34px;
        height: 19px;
        margin: 0;
        border-radius: 999px;
        background: rgba(255,255,255,.14);
        border: 1px solid rgba(255,255,255,.12);
        cursor: pointer;
        transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 2px;
        width: 13px;
        height: 13px;
        transform: translateY(-50%);
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.5);
        transition: transform .18s cubic-bezier(.2, .8, .2, 1);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]:checked {
        background: #22c55e;
        border-color: rgba(34,197,94,.75);
        box-shadow: 0 0 0 3px rgba(34,197,94,.1);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]:checked::before {
        transform: translate(15px, -50%);
      }
      /* Two columns, not four: these presets are words ("Compact"), not the
         short quality codes the sibling panel's chips carry, and they overflow
         a quarter-width chip. */
      #${SETTINGS_PANEL_ID} .kfc-settings-buttons {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-chip {
        box-sizing: border-box;
        min-width: 0;
        min-height: 32px;
        padding: 0 .4rem;
        color: rgba(255,255,255,.85);
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 8px;
        font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
      }
      /* Keyboard focus takes the hover look as well as the ring (0.30.1), as on
         the close and reset buttons and the sibling scripts' chips. */
      #${SETTINGS_PANEL_ID} .kfc-settings-chip:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-chip:focus-visible {
        background: rgba(255,255,255,.09);
        border-color: rgba(255,255,255,.16);
        color: #fff;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-chip:active { transform: scale(.97); }
      /* The width preset matching the current chat width (persisted across
         reloads) is shown selected with a green tint, border and ring. */
      #${SETTINGS_PANEL_ID} .kfc-settings-chip.kfc-selected {
        background: rgba(34,197,94,.14);
        border-color: rgba(34,197,94,.5);
        color: #4ade80;
        box-shadow: 0 0 0 3px rgba(34,197,94,.07);
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-chip.kfc-selected:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-chip.kfc-selected:focus-visible {
        background: rgba(34,197,94,.18);
        border-color: rgba(34,197,94,.6);
        color: #4ade80;
      }
      #${SETTINGS_PANEL_ID} .kfc-settings-reset {
        width: 100%;
        color: #fca5a5;
      }
      /* Reset is destructive, so it goes red on hover/focus (same chip shape,
         red tint + border + text) instead of the default hover. Declared after
         the generic chip:hover rule so it wins on source order. */
      #${SETTINGS_PANEL_ID} .kfc-settings-reset:hover,
      #${SETTINGS_PANEL_ID} .kfc-settings-reset:focus-visible {
        background: rgba(239,68,68,.14);
        border-color: rgba(248,113,113,.5);
        color: #fca5a5;
      }
      @media (prefers-reduced-motion: reduce) {
        #${WRAP_ID}.kfc-settings-open #${SETTINGS_PANEL_ID} { animation: none; }
        #${SETTINGS_PANEL_ID} .kfc-settings-chip,
        #${SETTINGS_PANEL_ID} .kfc-settings-close,
        #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"],
        #${SETTINGS_PANEL_ID} .kfc-settings-check input[type="checkbox"]::before {
          transition: none;
        }
      }
      /* Hide the streamer-info overlay when the user has toggled it off. */
      #${INFO_ID}.kfc-hidden { display: none !important; }

      .kfc-active { background: #000; }
      /* We mark Kick's full-coverage player layers in place rather than moving
         them into a wrapper. Wrapping fsEl's children caused React's reconciler
         to throw on background re-renders (it tried to remove a node from fsEl
         that we'd reparented into our wrapper) and navigate to Kick's 404 page.
         Non-video layers are filtered further in JS so transient loading/blur
         overlays do not become transformed hit targets above the controls. */
      [${VIDEO_ROOT_ATTR}] {
        /* --kfc-video-width is normally unset and falls back to the shrink
           calc; overlay mode sets it to 100% on documentElement. Both vars
           live on documentElement (which Kick never rewrites), so the layout
           survives Kick stripping fsEl's className on re-render. */
        width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        max-width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
        /* Containing block for any position:fixed/absolute descendants so the
           controls/timeline grid anchors to the shrunken area instead of the
           viewport. --kfc-video-shift pushes the shrunken player to the right
           by the chat width when chat is docked on the left (0 otherwise). */
        transform: translateX(var(--kfc-video-shift, 0px)) translateZ(0);
      }
      /* Kick's transient loading / blur overlays sit alongside the player
         layers and are deliberately NOT marked as ones (they hold no controls;
         see looksLikeFullscreenLayer, and 0.9.7 for what marking them broke).
         They still have to be told how wide the player is now, or the spinner
         they centre is centred on the viewport while the video sits shrunk to
         one side of it. Width and the docked-left shift only — deliberately no
         height, no overflow clipping, and the translateX doubles as a
         containing block so a position:fixed spinner inside one is centred on
         the video too. */
      [${VIDEO_OVERLAY_ATTR}] {
        width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        max-width: var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        transform: translateX(var(--kfc-video-shift, 0px));
      }
      /* Wide layers beside the player that carry their own z-index: during a
         server-side ad, Kick's ad progress bar (absolute, bottom, full
         width), its transparent "Visit advertiser" button (absolute, inset 0)
         and the wrapper around its "Ad 1 of 1 · 25s left" label and "Why am I
         seeing this ad" button (a plain zero-height div whose absolute
         children anchor to fsEl). Left alone they span the whole screen, and
         their z-index paints them over the chat. They get the area beside the
         chat: the video width and docked-left shift in side mode, and in
         overlay mode the full width less the floating chat (the control
         inset / shift that keep the timeline clear of it). That goes through
         left, deliberately not a transform: a
         transform makes a stacking context, which would drop the info button
         (z-controls) under Kick's transparent "Visit advertiser" button
         (z-player) so a click on it opened the advertiser. A static wrapper
         is pinned to the top as an absolute box, so it is the containing
         block for its children: made relative, it sat in fsEl's flow below
         the video, off-screen. It keeps its zero height — stretched to full
         height it covered the player and, holding a button, was re-marked as
         a player layer on the next pass, which put it back in the flow. */
      [${VIDEO_STRIP_ATTR}] {
        width: calc(var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) - var(--kfc-control-inset, 0px)) !important;
        max-width: calc(var(--kfc-video-width, calc(100% - var(--kfc-chat-width, ${CHAT_WIDTH}))) - var(--kfc-control-inset, 0px)) !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        left: calc(var(--kfc-video-shift, 0px) + var(--kfc-control-shift, 0px)) !important;
        right: auto !important;
      }
      [${VIDEO_STRIP_ATTR}="static"] {
        position: absolute !important;
        top: 0 !important;
      }
      /* Kick's transparent "Visit advertiser" button (z-player, 201) stays
         under its controls (z-controls, 202) only while both share fsEl's
         stacking context. The video-root transform gives the controls layer
         a stacking context of its own at z-index auto, which drops them below
         the button: during an ad, play, mute, the seekbar and every other
         control opened the advertiser instead. The button now lets clicks
         through, so the controls work and a click on the bare video does
         what it does outside an ad (onFsClick: resume a paused stream). No
         one can click through to the advertiser from the side layout; the
         ⓘ "Why am I seeing this ad" button still works. Only while the side
         chat is up — the markers exist only then; plain fullscreen keeps
         Kick's own stacking, where the controls already win. */
      [${VIDEO_STRIP_ATTR}][data-testid="ad-click-overlay"],
      [${VIDEO_OVERLAY_ATTR}][data-testid="ad-click-overlay"] {
        pointer-events: none !important;
      }
      /* Kick can keep the actual <video> inside one or more inner wrappers that
         are sized from the viewport rather than from the marked player layer.
         Constrain that wrapper chain too so the picture follows the timeline
         into the left-side video area when chat opens. */
      [${VIDEO_FRAME_ATTR}] {
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
      }
      [${VIDEO_ROOT_ATTR}] video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        object-fit: contain !important;
      }
      video[${VIDEO_ROOT_ATTR}] {
        object-fit: contain !important;
        object-position: center center !important;
      }
      video[${VIDEO_EL_ATTR}] {
        object-fit: contain !important;
        object-position: center center !important;
        pointer-events: none !important;
      }
      .kfc-chat-slot {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: var(--kfc-chat-width, ${CHAT_WIDTH});
        /* Dock on the left edge instead of the right when chat side is left. */
      }
      html.kfc-chat-left .kfc-chat-slot {
        right: auto;
        left: 0;
      }
      .kfc-chat-slot {
        background: #0e0e10;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        /* No explicit z-index. position:fixed already creates a stacking
           context, and the slot is appended after Kick's player layers so it
           renders on top by DOM order. Avoid a high z-index — it stacked over
           sibling overlays appended by other Kick userscripts (e.g. the
           kick-third-party-emotes autocomplete popup and tooltip, which the Fullscreen API
           forces those scripts to re-parent into fsEl, and which previously
           landed below our slot's background). */
      }
      /* Kick's player container (fsEl) typically has user-select: none so the
         video / controls aren't selectable. Once chat moves into our slot
         inside fsEl, it inherits that — making chat messages uncopyable.
         Force text selection back on inside the chat slot. The selector
         covers descendants so a chat ancestor with its own user-select:none
         can't block us. */
      .kfc-chat-slot,
      .kfc-chat-slot * {
        -webkit-user-select: text;
        user-select: text;
      }
      .kfc-chat-slot > * {
        flex: 1 1 auto;
        min-height: 0;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        max-height: none !important;
        width: 100% !important;
        visibility: visible !important;
      }
      /* Kick's chat lays itself out at every width the slot allows (260px
         up): its message rows carry their own min-w-0 and break-words, so
         long words, URLs and usernames wrap or truncate inside the panel.
         Clip any leftover horizontal overflow on Kick's chat root (its
         reply-to line can poke a few px past the edge) and keep emotes /
         images within the panel width; nothing else is needed.

         Never force min-width: 0 or overflow-wrap: anywhere on every
         descendant (0.27.2). Both used to be here, from when Kick's rows
         overflowed at narrow widths, and both broke more than they fixed
         once Kick's markup handled it. min-width: 0 let flex rows crush
         their buttons: the send button lost 10px and the gear 10px at the
         default 340px, and the pinned message's chevron shrank to 7px and
         spilled out of its card. overflow-wrap: anywhere split short
         tokens like the chatter count, "(254" / ")", in a 260px header.
         Measured against Kick's own layout in the same box at 260–640px:
         without them the chat, pinned message and chatter list match it
         node for node. */
      .kfc-chat-slot > * {
        overflow-x: hidden !important;
      }
      .kfc-chat-slot img,
      .kfc-chat-slot video,
      .kfc-chat-slot canvas {
        max-width: 100% !important;
      }
      /* Kick's chat input action bar — channel points, Kicks (gift shop),
         drops, the settings gear and the green "Chat" send button
         (#send-message-button). Kick sizes it for a wide chat: its left group
         takes lg:w-full, keyed off the viewport, which stays wide in
         fullscreen however narrow the slot is.

         Logged in, the row doesn't fit below ~340px: the left group alone is
         ~190px with a value like "52,1 tis.", and the gear + send pair needs
         88px more. Natively the send button would then be pushed off the
         panel. Squeezing doesn't work either — that is what 0.21–0.27 did by
         accident (see the min-width note above): the send button's label
         spilled out of it and the gear shrank. So the row wraps: when both
         groups fit, it is Kick's single row; when they don't, the right
         group (gear + send, kept at full size) drops to a second line, where
         its own ml-auto keeps it flush right. column-gap 0 is Kick's own
         lg:gap-0; the row gap matches the composer's gap-2 above it.

         Targeted via the stable #send-message-button id and Kick's
         data-testids so it survives class-name churn. */
      .kfc-chat-slot :has(> div > #send-message-button) {
        flex-wrap: wrap !important;
        column-gap: 0 !important;
        row-gap: .5rem !important;
      }
      .kfc-chat-slot :has(> #send-message-button) {
        flex-shrink: 0 !important;
      }
      /* Release the left group's forced width at every wrapper level, so it
         takes only what its buttons need and the wrap above happens only when
         they really don't fit. Kick nests a second w-full div between the
         channel-points button and the gift-shop's span; with lg:w-full the
         group would claim the whole row and always push the right group to
         the second line. Matched a level at a time via > * > rather than
         naming the span, so a wrapper swap in Kick's markup doesn't silently
         reopen it.

         The left group itself is released by position, not by what it holds
         (0.27.3): logged out it has no points or gift-shop button — it is
         empty, or holds only the drops button — so the testid selectors
         don't match it, and its lg:w-full sent the gear + send to a second
         row at every width (an 8px-lower row when empty, a whole extra row
         under the drops button). Anything in the row that isn't the send
         button's own group is the left group — except our folded bar's
         "Show more" button, which must not shrink. */
      .kfc-chat-slot :has(> div > #send-message-button) > :not(:has(#send-message-button)):not(#${BAR_MORE_ID}),
      .kfc-chat-slot :has(> [data-testid="channel-points-button"]),
      .kfc-chat-slot :has(> [data-testid="gift-shop-button"]),
      .kfc-chat-slot :has(> * > [data-testid="gift-shop-button"]) {
        width: auto !important;
        flex: 0 1 auto !important;
      }
      /* Folded action bar: the left group (points, Kicks, drops) goes
         behind one "Show more" button of ours, and the gear + green Chat send
         button stay, so the bar is a single row; pressing it brings the group
         back (the wrapped two-row layout above when it doesn't fit beside
         them). Always folded since 0.31.0, as kick-chat-utils folds the same
         bar in normal view; fitChatBar() only checks there is something to
         fold. The state lives on our slot, not on Kick's bar, which React
         re-renders. */
      #${BAR_MORE_ID} {
        display: none !important;
      }
      .kfc-chat-slot.kfc-bar-folded #${BAR_MORE_ID} {
        display: inline-flex !important;
        flex-shrink: 0 !important;
      }
      /* Our button, so the kick-* family look of the Chat button (surface,
         border, shadow, radius, type, green icon), at 32px tall to sit in
         Kick's 32px row beside its send button. No blur: the surface is
         opaque. While the bar is open it takes the family pressed tint. */
      #${BAR_MORE_ID} {
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        height: 32px;
        margin: 0;
        padding: 0 11px 0 7px;
        font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #fff;
        white-space: nowrap;
        background: #101013;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
        cursor: pointer;
        transition: background .08s;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      #${BAR_MORE_ID}:hover,
      #${BAR_MORE_ID}:focus-visible {
        background: linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013;
      }
      /* Keyboard focus on the script's floating buttons: the hover tint plus
         the family focus ring (DESIGN.md, 0.31.0). A mouse click never shows
         it: the Chat, control and Show more buttons blur after a click. */
      #${BTN_ID}:focus-visible,
      .kfc-control-btn:focus-visible,
      #${BAR_MORE_ID}:focus-visible {
        outline: 2px solid rgba(34,197,94,.65);
        outline-offset: 2px;
      }
      .kfc-chat-slot.kfc-bar-open #${BAR_MORE_ID} {
        background: linear-gradient(rgba(34,197,94,.18), rgba(34,197,94,.18)), #101013;
        border-color: rgba(34,197,94,.5);
      }
      #${BAR_MORE_ID} svg {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        fill: #22c55e;
        transition: transform .15s ease;
      }
      .kfc-chat-slot.kfc-bar-open #${BAR_MORE_ID} svg {
        transform: rotate(180deg);
      }
      /* Open, the points/Kicks/drops group takes the first row on its own
         and "Show less" opens the second, left of the gear + Chat, at every
         chat width (0.31.0; the same layout as kick-chat-utils' open bar in
         normal view). The group's full-row basis outranks the left-group
         release rule above by the extra .kfc-bar-open class. */
      .kfc-chat-slot.kfc-bar-open :has(> div > #send-message-button) > :not(:has(#send-message-button)):not(#${BAR_MORE_ID}) {
        flex: 0 0 100% !important;
      }
      .kfc-chat-slot.kfc-bar-open #${BAR_MORE_ID} {
        order: 1;
      }
      .kfc-chat-slot.kfc-bar-open :has(> #send-message-button) {
        order: 2;
      }
      .kfc-chat-slot.kfc-bar-folded:not(.kfc-bar-open) :has(> div > #send-message-button) > :not(:has(#send-message-button)):not(#${BAR_MORE_ID}) {
        display: none !important;
      }

      /* Chat Appearance's segmented choices (chat width 280px/340px/420px,
         message spacing Tight/Medium/Loose) are Radix radios in a 3-column
         grid inside a break-all panel. Below ~300px their 12px side padding
         leaves less room than "Medium" needs, so Kick broke the labels
         mid-word ("Medi/um", "280p/x"). Keep each label whole and trim the
         padding — the label is centred, so nothing moves while it fits.
         Scoped to the settings panel so poll/prediction options keep
         wrapping. */
      .kfc-chat-slot #chat-settings-panel [role="radiogroup"] > [role="radio"] {
        word-break: normal !important;
        white-space: nowrap !important;
        padding-inline: .25rem !important;
      }

      /* Emote picker: each emote set is one grid-cols-8 grid of fixed 36px
         tiles (40px below Kick's lg breakpoint) with 8px gaps — 344px of
         room that a narrower chat doesn't have, so tiles overlapped and the
         last column (plus its hover "Add to favourites" star) stuck out and
         scrolled the picker sideways. Fit as many columns as there is room
         for, capped at Kick's 8; a column may be up to 7px narrower than
         its tile (eating into the gap), which keeps Kick's 8 columns at its
         own 340px default. Wider than that it is Kick's layout unchanged. */
      .kfc-chat-slot #chat-emotes-picker-panel .grid-cols-8 {
        --kfc-emote-tile: 2.25rem;
        grid-template-columns: repeat(auto-fill, minmax(max(calc(var(--kfc-emote-tile) - 7px), calc((100% - 3.5rem) / 8)), 1fr)) !important;
      }
      @media (max-width: 63.999rem) {
        .kfc-chat-slot #chat-emotes-picker-panel .grid-cols-8 { --kfc-emote-tile: 2.5rem; }
      }
      .kfc-chat-slot #chat-emotes-picker-panel .overflow-y-auto {
        overflow-x: hidden !important;
      }

      /* Keep Kick's full-width bottom controls out from under the floating chat
         in overlay mode. The controls live in a full-width flex row that
         justifies its two button groups to the edges (play/volume/time left;
         PiP/clips/mini/fullscreen/settings right) and is also the positioned
         ancestor of the absolute bottom-0 seekbar. Shrinking this one row by the
         chat width moves the right-hand buttons to the chat's left edge AND sizes
         the timeline to the same width — so we must NOT also shrink the timeline
         itself, or it gets inset twice and leaves a chat-width gap on the right.
         No-op in side mode (--kfc-control-inset is 0 there). */
      [${VIDEO_ROOT_ATTR}] [class*="justify-between" i][class*="w-full" i] {
        width: calc(100% - var(--kfc-control-inset, 0px)) !important;
        max-width: calc(100% - var(--kfc-control-inset, 0px)) !important;
        /* In overlay mode with chat docked left, push the controls row right by
           the chat width so it clears the floating chat (0 otherwise). */
        margin-left: var(--kfc-control-shift, 0px) !important;
      }
      /* Overlay chat mode: the video keeps the full width (via --kfc-video-width
         set to 100%; see [${VIDEO_ROOT_ATTR}] above) and the chat panel floats
         semi-transparently over its right edge (Twitch-style overlay). The
         transparency is keyed on a class on our own chat slot, which Kick
         never touches. */
      .kfc-chat-slot.kfc-overlay {
        background: rgba(14,14,16,var(--kfc-overlay-opacity,.55));
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        transition: opacity .2s ease;
        /* Readability for chat text over video, since Kick's own opaque
           backgrounds are stripped below. Same trick as the info overlay. */
        text-shadow: 0 1px 3px rgba(0,0,0,.85), 0 0 6px rgba(0,0,0,.5);
      }
      .kfc-chat-slot.kfc-overlay.kfc-overlay-idle {
        opacity: 0;
        pointer-events: none;
      }
      /* Strip Kick's opaque chat backgrounds in overlay mode so the slot's
         frosted backdrop (and the video behind it) shows through instead of a
         solid dark panel. Backgrounds only — text, emotes (<img>), and badges
         are untouched. Left out:
         - buttons, so controls that rely on a fill (e.g. Kick's green "Chat"
           send button) keep their normal look;
         - bg-green-* accents and 1px separator lines (h-px / w-px): Kick draws
           dividers like the "New messages" rule and the gifters-bar lines as
           thin coloured divs (e.g. div.h-px.grow.bg-green-500);
         - Kick's footer pop-ups (0.27.5): emote picker, chat settings, gift
           shop, mention / command / emote suggestions, each a z-popover in
           #chatroom-footer over a bg-surface-bg-default box;
         - the pinned-message card (0.27.6), matched by its own structure
           (card > row > [data-testid=pinned-message-content]).
         The pop-ups and the pinned card sit over the messages, so stripped
         they were see-through, with chat text running through them.
         The exclusions sit in :where() so they add no specificity: the rule
         stays at (0,2,0) and the restore rules below (composer backing,
         separator lines) win. As a plain :not() list it weighed (0,5,1), so
         before 0.27.6 the composer's dark backing never applied. */
      .kfc-chat-slot.kfc-overlay *:where(:not(button):not([class*="bg-green" i]):not([class*="h-px" i]):not([class*="w-px" i]):not(#chatroom-footer [class*="z-popover"] *):not(:has(> div > [data-testid="pinned-message-content"]))) {
        background-color: transparent !important;
      }
      /* Restore a dark backing on the message composer so the input stays
         readable over video (like normal mode). It goes on Kick's bordered,
         rounded box around the field (the div two levels above the
         contenteditable, which also holds the identity badge and the emote
         button), and the field itself stays clear, so the whole box is one
         dark fill inside Kick's border with no box-in-a-box. [contenteditable]
         with any value also covers the locked "Followers only" composer.
         Plain inputs and textareas (e.g. the emote picker's search) get the
         same backing on themselves and their wrapper. */
      .kfc-chat-slot.kfc-overlay textarea,
      .kfc-chat-slot.kfc-overlay input:not([type="checkbox"]):not([type="radio"]),
      .kfc-chat-slot.kfc-overlay div:has(> textarea),
      .kfc-chat-slot.kfc-overlay div:has(> input:not([type="checkbox"]):not([type="radio"])),
      .kfc-chat-slot.kfc-overlay div:has(> * > [contenteditable]) {
        /* Near-solid dark so the input reads clearly over video, matching the
           normal-mode composer rather than the translucent panel. */
        background-color: rgba(12,12,14,.94) !important;
      }
      /* Thin separator lines (h-px / w-px) use a dark-grey fill that vanishes
         over video. Brighten the neutral ones so the gifters-bar top/bottom
         dividers and similar rules stay visible; green ones keep their accent. */
      .kfc-chat-slot.kfc-overlay [class*="h-px" i]:not([class*="bg-green" i]),
      .kfc-chat-slot.kfc-overlay [class*="w-px" i]:not([class*="bg-green" i]) {
        background-color: rgba(255,255,255,.4) !important;
      }

      /* Messages only: just the message list, nothing around it. Kick's chat
         column is header, then a body of [banners…, message box, footer]:
         - the header (title, Hide chat, active chatters) is the body's
           previous sibling;
         - banners (the leaderboard marquee, anything else Kick stacks above
           the messages) are the body's children other than the footer and
           the message box;
         - the pinned-message stack is the absolute layer just before
           #chatroom-messages; the card rule is a backstop if that moves;
         - #chatroom-footer holds the composer and the action bar.
         The bottom "more messages" layer after #chatroom-messages stays: it
         only shows while scrolled up. Selected by ids, test ids and sibling
         structure, never Tailwind classes. :has() can't nest, hence
         "+ * > #chatroom-footer" rather than a :has() inside a :has(). */
      .kfc-chat-slot.kfc-messages-only :has(+ * > #chatroom-footer),
      .kfc-chat-slot.kfc-messages-only :has(> #chatroom-footer) > :not(#chatroom-footer):not(:has(#chatroom-messages)),
      .kfc-chat-slot.kfc-messages-only :has(+ #chatroom-messages),
      .kfc-chat-slot.kfc-messages-only :has(> div > [data-testid="pinned-message-content"]),
      .kfc-chat-slot.kfc-messages-only #chatroom-footer {
        display: none !important;
      }
      /* Each message row ([data-index] > .group) is [message, hover toolbar];
         the toolbar (signed-in viewers only) holds Kick's Reply button, and
         Pin / Delete for moderators, and appears on hover. Hide the toolbar
         and the Reply button itself, and drop the row's hover highlight, so
         hovering a message changes nothing.
         Nothing here may depend on a label's words: Kick translates every
         aria-label ("Reply" is "Odpovědět" in Czech). The toolbar is matched
         by where it sits — any child of the row after the message that holds
         labelled buttons — and the Reply button by its design-system icon,
         ArrowCurveLeft, on a labelled button. The "Replying to …" line above
         a reply carries the SAME icon, but on a button with no aria-label
         inside the message itself: matching the icon alone (0.28.1) hid
         every reply message whole (0.29.1). */
      .kfc-chat-slot.kfc-messages-only #chatroom-messages [data-index] > * > :not(:first-child):has(> button[aria-label]),
      .kfc-chat-slot.kfc-messages-only #chatroom-messages button[aria-label]:has(> svg[data-ds-icon="ArrowCurveLeft"]) {
        display: none !important;
      }
      .kfc-chat-slot.kfc-messages-only #chatroom-messages [data-index] > :hover > :first-child {
        background-color: transparent !important;
      }

      /* Draggable divider between video and chat. A thin fixed strip straddling
         the chat's left edge; the value it tracks (--kfc-chat-width) drives both
         the video shrink and the chat width above. */
      #${RESIZE_ID} {
        position: fixed;
        top: 0;
        bottom: 0;
        right: var(--kfc-chat-width, ${CHAT_WIDTH});
        width: 12px;
        margin-right: -6px;
        cursor: ew-resize;
        z-index: 2147483646;
        touch-action: none;
        opacity: 1;
        transition: opacity .2s ease;
      }
      /* When docked left, the divider straddles the chat's right edge. */
      html.kfc-chat-left #${RESIZE_ID} {
        right: auto;
        left: var(--kfc-chat-width, ${CHAT_WIDTH});
        margin-right: 0;
        margin-left: -6px;
      }
      #${RESIZE_ID}.kfc-overlay-idle {
        opacity: 0;
        pointer-events: none;
      }
      #${RESIZE_ID}::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        background: rgba(255,255,255,.12);
        transition: background .12s ease;
      }
      #${RESIZE_ID}:hover::after,
      #${RESIZE_ID}.kfc-dragging::after {
        background: #22c55e;
      }
      /* Release-to-close cue: while the user drags the divider past the
         close threshold, the slot dims so it's obvious that letting go
         will close the side chat. Cleared on pointerup regardless of
         which way the cue goes (commit or revert). */
      .kfc-chat-slot.kfc-pending-close {
        opacity: 0.35;
        transition: opacity .12s ease;
      }

      [${POPOVER_CLONE_ATTR}] {
        z-index: 2147483647 !important;
        pointer-events: none !important;
      }
      /* Kick's own menus, dialogs and tooltips inside the fullscreen element
         — opened from the overlay's buttons, or Kick's own player menus — go
         above this script's controls, chat and stream info, as a popup does.
         Same top value as the cluster; later in the DOM, so they win. */
      :fullscreen > [data-fullscreen-portal-owner],
      :fullscreen > [data-radix-popper-content-wrapper],
      :fullscreen #user-identity {
        z-index: 2147483647 !important;
      }
      /* The chatter card hangs off the chat's edge through Kick's own
         --chat-width (right: var(--chat-width)), which is Kick's chat width,
         not the docked slot's. Scoped to the card, so Kick's :root value and
         its windowed layout are untouched. */
      :fullscreen #user-identity {
        --chat-width: var(--kfc-chat-width, ${CHAT_WIDTH});
      }
      /* Docked left, the card goes on the chat's other side — the left edge.
         No !important: an inline position Kick writes still wins. */
      html.kfc-chat-left :fullscreen #user-identity {
        left: var(--kfc-chat-width, ${CHAT_WIDTH});
        right: auto;
      }
      [${POPOVER_CLONE_ATTR}] * {
        z-index: 2147483647 !important;
      }

      /* Twitch-style streamer info overlay. A clone of Kick's existing
         channel-info card pinned to the top-left of the fullscreen element,
         tied to the same idle fade as the toggle button so it appears with
         the controls/timeline and disappears with them. Mostly click-through
         so empty overlay space still passes clicks to the player.
         Background is fully transparent — readability comes from a text
         shadow propagated to all descendants, the same trick Twitch uses
         for its fullscreen channel-info overlay. The wrapper itself remains
         click-through, while the cloned card content opts back into pointer
         events so links work and text can be selected. */
      #${INFO_ID} {
        position: absolute;
        top: 1.75rem;
        /* Offset right of the chat panel when chat is docked left (0 otherwise),
           so the info overlay isn't hidden behind the chat. */
        left: calc(var(--kfc-info-offset, 0px) + 1.75rem);
        z-index: 2147483646;
        /* Cap width to what's left between the offset (chat width when docked
           left) and the right edge, so it never overflows the viewport. */
        max-width: min(60%, calc(100% - var(--kfc-info-offset, 0px) - 3.5rem), ${INFO_MAX_WIDTH});
        pointer-events: none;
        opacity: 1;
        transition: opacity .2s ease;
        color: #fff;
        /* Subtle dark gradient backdrop so the cloned card text stays readable
           over bright video, while still feeling like an overlay (no hard box).
           Alpha is driven by --kfc-info-bg-opacity (default 0.6); the second
           stop keeps the original ~0.58 ratio for the same soft gradient. */
        background: linear-gradient(135deg,
          rgba(0,0,0,var(--kfc-info-bg-opacity,.6)),
          rgba(0,0,0,calc(var(--kfc-info-bg-opacity,.6) * 0.58)));
        padding: .75rem 1rem;
        border-radius: .5rem;
        box-sizing: border-box;
        user-select: text;
        -webkit-user-select: text;
        text-shadow: 0 1px 3px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.5);
      }
      #${INFO_ID} *,
      #${INFO_ID} *::before,
      #${INFO_ID} *::after {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      #${INFO_ID}.kfc-idle {
        opacity: 0;
      }
      /* The overlay carries links and Kick's action buttons, so it follows
         the cluster's click-through rules: nothing in it is clickable while
         faded out, or while fading back in (.kfc-unarmed — see the comment
         on #${WRAP_ID}.kfc-unarmed). The !important beats the
         pointer-events: auto the cloned card and its links opt into below. */
      #${INFO_ID}.kfc-idle,
      #${INFO_ID}.kfc-idle *,
      #${INFO_ID}.kfc-unarmed,
      #${INFO_ID}.kfc-unarmed * {
        pointer-events: none !important;
      }
      /* Reset positioning on the clone's root so a card that was originally
         absolutely positioned within its page layout doesn't escape the
         overlay frame. Inherited Tailwind utility classes (flex / gap /
         text-* / etc.) on descendants are preserved. */
      #${INFO_ID} > * {
        position: static !important;
        margin: 0 !important;
        width: auto !important;
        max-width: 100% !important;
        background: transparent !important;
        pointer-events: auto !important;
      }
      #${INFO_ID} a,
      #${INFO_ID} button {
        pointer-events: auto !important;
      }
      #${INFO_ID} a {
        cursor: pointer !important;
      }
      /* Viewer-count badge inlined next to the category link, e.g.
         "IRL • 682 Viewers". The cloned badge is forced to inline-flex so
         it sits on the same row as the category. The separator is drawn
         as a CSS circle so it doesn't depend on font glyph rendering. */
      #${INFO_ID} .kfc-info-separator {
        display: inline-block !important;
        width: .38em !important;
        height: .38em !important;
        margin: 0 .4rem !important;
        border-radius: 9999px !important;
        background: #fff !important;
        background-color: #fff !important;
        opacity: 1 !important;
        vertical-align: middle !important;
        flex: 0 0 auto !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline {
        display: inline-flex !important;
        align-items: center !important;
        gap: .25rem !important;
        margin: 0 !important;
        vertical-align: middle !important;
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline * {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline svg,
      #${INFO_ID} .kfc-info-viewer-inline svg * {
        fill: #fff !important;
        stroke: #fff !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline [class~="text-primary-base"] {
        color: ${VIEWER_COUNT_COLOR} !important;
      }
      #${INFO_ID} .kfc-info-viewer-inline [class~="text-subtle"] {
        color: #fff !important;
      }
      #${INFO_ID} .kfc-info-category-inline,
      #${INFO_ID} .kfc-info-category-inline * {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
        /* Kick renders the category link in a lighter weight than the rest
           of the overlay; bump it so "IRL" matches the streamer name / title
           / viewer-count text instead of looking thin. */
        font-weight: 600 !important;
      }
      /* Kick's action column (follow / subscribe / gift subs, then share and
         report) is stacked under the card — Kick's own narrow-screen layout
         — rather than beside it, so the overlay stays a compact block in the
         corner instead of a banner across the top of the video. Its two rows
         become one. */
      #${INFO_ID} .kfc-info-stacked {
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: .75rem !important;
      }
      #${INFO_ID} .kfc-info-actions {
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: .5rem !important;
      }
      #${INFO_ID} .kfc-info-actions > * {
        align-self: auto !important;
      }
      /* Per-part visibility from the settings panel. Set on the wrapper,
         which survives the reclone that replaces the card under it. */
      #${INFO_ID}.kfc-info-no-actions .kfc-info-actions,
      #${INFO_ID}.kfc-info-no-tags .kfc-info-tag {
        display: none !important;
      }
      /* Boost streamer name prominence. The cloned card's headings (or
         heading-shaped class patterns) get bolder white text so the name
         reads as the top element above the title. Size is only slightly
         larger than body text so a long username doesn't dominate the
         overlay (Kick's own compact card uses a similar restrained
         hierarchy). Not the title: Kick marks it up as an <h2> too, and
         sized and weighted like the name the two read as one block. It keeps
         Kick's own smaller, semibold text. */
      #${INFO_ID} :is(h1, h2, h3, [class*="username" i], [class*="streamer-name" i], [class*="channel-name" i]):not(${STREAM_TITLE_SEL}) {
        font-size: 1.15em !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        color: #fff !important;
      }
      /* Allow the stream title to wrap to 2 rows. Kick applies Tailwind's
         'truncate' / 'line-clamp-1' classes to the title in their normal
         page layout because horizontal space is tight there; in our
         overlay we have more room, so let long titles use a second line
         and only clip with an ellipsis past row 2. The override targets
         any descendant carrying those utility classes — covers the title
         specifically and is a no-op on shorter text that already fits.
         Headings (the streamer name) are excluded so a long username
         doesn't sprawl across two lines — except the title, a heading
         itself, which is named outright. */
      #${INFO_ID} [class*="truncate"]:not(h1):not(h2):not(h3),
      #${INFO_ID} [class*="line-clamp"]:not(h1):not(h2):not(h3),
      #${INFO_ID} ${STREAM_TITLE_SEL} {
        display: -webkit-box !important;
        -webkit-box-orient: vertical !important;
        -webkit-line-clamp: 2 !important;
        line-clamp: 2 !important;
        white-space: normal !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        /* Let the title use the overlay's full available width — Kick's
           own card constrains it tighter (max-w-* utility) for the in-page
           layout where space is shared with follow / subscribe buttons,
           but in our overlay the row has more room. */
        max-width: 100% !important;
        width: 100% !important;
      }

      /* The family toast spec, shared with every sibling kick-* toast: opaque
         #101013, neutral border, 8px radius, the family shadow, 8px 12px
         padding, 500 13px/1.3 system-ui text. (kick-chat-utils's scrolling
         stack would clip the outer shadow, so its cards keep only the inset.) */
      #${TOAST_ID} {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 2147483647;
        background: #101013;
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
        border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity .2s ease, transform .2s ease;
        pointer-events: none;
        max-width: 360px;
      }
      #${TOAST_ID}.kfc-toast-show {
        opacity: 1;
        transform: translateY(0);
      }
      /* Reduced motion: the toast fades in place instead of sliding down. */
      @media (prefers-reduced-motion: reduce) {
        #${TOAST_ID},
        #${TOAST_ID}.kfc-toast-show {
          transform: none;
          transition: opacity .2s ease;
        }
      }
    `;
    document.head.appendChild(style);
  };

  let savedChatParent = null;
  let savedChatNextSibling = null;
  let chatSlot = null;
  let videoRoots = [];
  let videoOverlays = [];
  let videoStrips = [];
  let videoFrames = [];
  let markedVideos = [];
  let videoRootHost = null;
  let videoRootObserver = null;
  let infoOverlay = null;
  let infoOverlaySource = null;
  let infoOverlayObserver = null;
  let infoViewerSource = null;
  let infoViewerObserver = null;
  let infoOverlayPending = false;
  let infoViewerAttrSyncPending = false;
  let active = false;
  let suppressObserver = false;
  // Timestamp guarded by RECONCILE_GUARD_MS in dataChatObserver: a `data-chat`
  // flip back to "false" within this window after enableSideChat is treated
  // as Kick's React reconciler reverting our optimistic write (rather than a
  // real user "hide chat" action), and we re-assert "true" instead of tearing
  // down. Falls back from the primary fix (clicking Kick's own chat-toggle
  // button to sync React state) when that button isn't findable.
  let enableSyncUntil = 0;
  let videoEl = null;
  let enabledAt = 0;
  let fullscreenVideoEl = null;
  let onVideoLoaded = null;
  let onVideoBuffering = null;
  let onVideoStateChange = null;
  let videoSwapObserver = null;
  // Watches the chat slot for Kick's chat error boundary fallback ("We are
  // sorry, but something went wrong"). When it latches, Kick won't reset it
  // on its own; we tear down the side layout so the user can re-dock without
  // a full page reload. See [[chat-error-recovery]].
  let chatErrorObserver = null;
  let chatErrorCheckScheduled = 0;
  let chatErrorRecovering = false;
  // Set true synchronously by triggers we know cause Kick to reload the player
  // (quality change, seekbar, go-to-live). The old <video> element can briefly
  // still report readyState=4 in the gap between our teardown and Kick wiping
  // the element, which would otherwise let updateBtnLabel re-enable the Chat
  // button. With the flag set, the button stays disabled until the monitor's
  // canplay/loadeddata handler clears it. The monitor's loadstart/emptied
  // handler raises the flag too, so reloads we *didn't* trigger ourselves
  // (e.g. a backend-driven re-mount) are also covered as soon as the video
  // fires the corresponding event.
  let videoReloading = false;
  // Grace delay (ms) between the video firing canplay/loadeddata and the Chat
  // button becoming clickable again. canplay can fire while React is still
  // mid-commit on Kick's player tree, and a click that lands in that window
  // can still trip the 404. The delay gives the reconciler time to settle.
  const VIDEO_READY_GRACE_MS = 750;
  let videoReadyTimer = 0;
  const clearVideoReadyTimer = () => {
    if (videoReadyTimer) {
      clearTimeout(videoReadyTimer);
      videoReadyTimer = 0;
    }
  };
  // Safety net for the capture-phase handlers: when we mark videoReloading on a
  // user click that *should* re-mount the player (quality option, seekbar,
  // go-live), we still need to recover if Kick decides not to reload (e.g. the
  // user clicked the already-selected quality). Without this, the flag stays
  // true, the grace timer never starts, and the button is stuck disabled until
  // fullscreen is exited.
  const RELOAD_SAFETY_MS = 5000;
  let reloadSafetyTimer = 0;
  const clearReloadSafetyTimer = () => {
    if (reloadSafetyTimer) {
      clearTimeout(reloadSafetyTimer);
      reloadSafetyTimer = 0;
    }
  };

  // Pending-enable state: when the user clicks Chat while the video is still
  // loading (readyState < 2), we defer the layout change until the video reaches
  // a stable state. Changing the fullscreen DOM mid-load can trip React's
  // reconciler (Kick is re-mounting parts of the player tree right then) and
  // end with a 404.
  let pendingVideoEl = null;
  let pendingOnReady = null;
  let pendingTimeoutId = 0;
  const clearPendingEnable = () => {
    if (pendingVideoEl && pendingOnReady) {
      pendingVideoEl.removeEventListener('loadeddata', pendingOnReady);
      pendingVideoEl.removeEventListener('canplay', pendingOnReady);
    }
    if (pendingTimeoutId) clearTimeout(pendingTimeoutId);
    pendingVideoEl = null;
    pendingOnReady = null;
    pendingTimeoutId = 0;
  };

  // Not every <video> in the fullscreen element is the stream. A chatter's user
  // card (`#user-identity`, opened by clicking a name in chat) plays a looping
  // tier animation (static.kick.com/tier/animation/level-NN.webm) for
  // higher-tier subs, and the chat can hold video emotes. Treating either as
  // the player made the card a player layer: it was stretched over the whole
  // video area. Every "find the video" lookup goes through these.
  const NON_PLAYER_VIDEO_HOST_SEL = '#user-identity, .kfc-chat-slot';
  const isPlayerVideo = (video) =>
    video instanceof Element && !video.closest(NON_PLAYER_VIDEO_HOST_SEL);
  const queryPlayerVideo = (root) => {
    if (!root?.querySelectorAll) return null;
    for (const video of root.querySelectorAll('video')) {
      if (isPlayerVideo(video)) return video;
    }
    return null;
  };
  const holdsPlayerVideo = (el) =>
    el?.matches?.('video') ? isPlayerVideo(el) : !!queryPlayerVideo(el);

  // Kick's portaled popups. In fullscreen they render inside the fullscreen
  // element — a dialog's backdrop as a full-coverage child of it — and are
  // not player layers: marking one would shrink it beside the chat.
  // `#user-identity` is the chatter card: no dialog role, so it is named.
  const KICK_POPUP_SEL =
    '[data-fullscreen-portal-owner], [data-radix-popper-content-wrapper], [data-radix-focus-guard], [role="dialog"], [role="alertdialog"], [role="menu"], #user-identity';
  const isKickPopup = (el) => {
    const popup = el instanceof Element && el.closest(KICK_POPUP_SEL);
    // A match that holds the stream is a page-level wrapper around the
    // player, not a popup — otherwise every click on the video would count
    // as one. Only the stream counts: the user card holds a video of its own.
    return !!popup && !queryPlayerVideo(popup);
  };

  const isKfcOwnedChild = (el) =>
    el === chatSlot ||
    el.id === WRAP_ID ||
    el.id === TOAST_ID ||
    el.classList?.contains('kfc-chat-slot');

  const coversFullscreen = (el) => {
    const rect = el.getBoundingClientRect();
    // While side chat is open the player layers are shrunk to the left of the
    // chat, so measure "covers the player" against the available video width
    // (viewport minus chat), not the full viewport. Otherwise a wide chat can
    // push a marked controls layer below the 70%-of-viewport threshold; the
    // next re-mark pass then drops its marker, it loses the translateZ(0)
    // containing block, and Kick's position:fixed timeline escapes across the
    // chat panel. In overlay mode the video keeps full width, so the basis is
    // the full viewport regardless.
    const basisWidth =
      active && !overlayMode ? Math.max(1, window.innerWidth - chatWidth) : window.innerWidth;
    return (
      rect.width >= basisWidth * 0.7 &&
      rect.height >= window.innerHeight * 0.7
    );
  };

  const looksLikePlayerControls = (el) =>
    !!el.querySelector?.(
      'button, [role="button"], [role="slider"], [class*="group/seekbar"], [class*="seekbar"]'
    );

  // Mark direct children of fsEl that are likely to be player layers. The video
  // owner is always marked, even before it has measured. Other large layers are
  // only marked when they contain controls, which avoids turning Kick's transient
  // loading/blur overlays into transformed hit targets above the timeline.
  const looksLikeFullscreenLayer = (el) => {
    if (holdsPlayerVideo(el)) return true;
    return coversFullscreen(el) && looksLikePlayerControls(el);
  };

  const refreshVideoRoots = (fsEl) => {
    if (!fsEl) return;
    const roots = Array.from(fsEl.children).filter(
      (child) =>
        child instanceof Element &&
        !isKfcOwnedChild(child) &&
        !isKickPopup(child) &&
        looksLikeFullscreenLayer(child)
    );
    const nextRoots = new Set(roots);
    videoRoots.forEach((root) => {
      if (!nextRoots.has(root)) root.removeAttribute(VIDEO_ROOT_ATTR);
    });
    roots.forEach((root) => root.setAttribute(VIDEO_ROOT_ATTR, ''));
    videoRoots = roots;
    refreshVideoOverlays(fsEl, nextRoots);
    refreshVideoFrames(roots);
  };

  // The large layers `looksLikeFullscreenLayer` deliberately leaves unmarked:
  // Kick's transient loading / blur overlays, which carry no controls (that is
  // the test) and so must not get the full player-layer treatment — 0.9.7 gave
  // it to them and they became transformed hit targets sitting above the
  // timeline. They still need *sizing*, though: left alone they keep the whole
  // viewport's width while the player has been shrunk to the left of the chat,
  // so the buffering spinner they centre lands at the centre of the screen
  // rather than the centre of the video. They get width and the docked-left
  // shift, and nothing else — no height, no overflow clipping, no restacking.
  const refreshVideoOverlays = (fsEl, roots) => {
    const overlays = Array.from(fsEl.children).filter(
      (child) =>
        child instanceof Element &&
        !roots.has(child) &&
        !isKfcOwnedNode(child) &&
        !isKfcOwnedChild(child) &&
        !isKickPopup(child) &&
        !isRaisedLayer(child) &&
        coversFullscreen(child)
    );
    const nextOverlays = new Set(overlays);
    videoOverlays.forEach((overlay) => {
      if (!nextOverlays.has(overlay)) overlay.removeAttribute(VIDEO_OVERLAY_ATTR);
    });
    overlays.forEach((overlay) => overlay.setAttribute(VIDEO_OVERLAY_ATTR, ''));
    videoOverlays = overlays;
    refreshVideoStrips(fsEl, roots, nextOverlays);
  };

  // A positioned layer with its own z-index (Kick's transparent "Visit
  // advertiser" button, z-player, during an ad) paints over the chat slot,
  // which has none: the overlay rule's transform only makes it a stacking
  // context at that same z-index. It is sized as a strip instead, which also
  // keeps it out from under the floating chat in overlay mode.
  const isRaisedLayer = (el) => {
    const style = getComputedStyle(el);
    return (
      (style.position === 'absolute' || style.position === 'fixed') && style.zIndex !== 'auto'
    );
  };

  // The wide layers neither test above catches (Kick's ad progress bar,
  // ad-label wrapper and ad click button; see the [data-kfc-video-strip]
  // rule). Measured against the area beside the chat in both modes, so a
  // strip already narrowed to it stays marked. A static wrapper with no box
  // of its own is measured by its positioned children, which are what anchor
  // to fsEl: fsEl is sometimes a flex row, and there the wrapper is a 0px-wide
  // item.
  const spansVideoWidth = (el) => {
    const basisWidth = active ? Math.max(1, window.innerWidth - chatWidth) : window.innerWidth;
    const rect = el.getBoundingClientRect();
    if (rect.width >= basisWidth * 0.7) return true;
    if ((rect.width && rect.height) || getComputedStyle(el).position !== 'static') return false;
    let left = Infinity;
    let right = -Infinity;
    for (const child of el.children) {
      const position = getComputedStyle(child).position;
      if (position !== 'absolute' && position !== 'fixed') continue;
      const box = child.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      left = Math.min(left, box.left);
      right = Math.max(right, box.right);
    }
    return right - left >= basisWidth * 0.7;
  };

  const refreshVideoStrips = (fsEl, roots, overlays) => {
    const strips = Array.from(fsEl.children).filter(
      (child) =>
        child instanceof Element &&
        !roots.has(child) &&
        !overlays.has(child) &&
        !isKfcOwnedNode(child) &&
        !isKfcOwnedChild(child) &&
        !isKickPopup(child) &&
        getComputedStyle(child).display !== 'contents' &&
        spansVideoWidth(child)
    );
    const nextStrips = new Set(strips);
    videoStrips.forEach((strip) => {
      if (!nextStrips.has(strip)) strip.removeAttribute(VIDEO_STRIP_ATTR);
    });
    strips.forEach((strip) => {
      if (strip.hasAttribute(VIDEO_STRIP_ATTR)) return;
      const position = getComputedStyle(strip).position;
      strip.setAttribute(VIDEO_STRIP_ATTR, position === 'static' ? 'static' : '');
    });
    videoStrips = strips;
  };

  const refreshVideoFrames = (roots) => {
    const frames = [];
    const videos = [];
    roots.forEach((root) => {
      if (root.matches?.('video')) videos.push(root);
      root.querySelectorAll?.('video').forEach((video) => {
        if (!isPlayerVideo(video)) return;
        videos.push(video);
        let node = video.parentElement;
        while (node && node !== root) {
          if (node instanceof Element) frames.push(node);
          node = node.parentElement;
        }
      });
    });
    const nextFrames = new Set(frames);
    videoFrames.forEach((frame) => {
      if (!nextFrames.has(frame)) frame.removeAttribute(VIDEO_FRAME_ATTR);
    });
    nextFrames.forEach((frame) => frame.setAttribute(VIDEO_FRAME_ATTR, ''));
    videoFrames = Array.from(nextFrames);

    const nextVideos = new Set(videos);
    markedVideos.forEach((video) => {
      if (!nextVideos.has(video)) video.removeAttribute(VIDEO_EL_ATTR);
    });
    nextVideos.forEach((video) => video.setAttribute(VIDEO_EL_ATTR, ''));
    markedVideos = Array.from(nextVideos);
  };

  const clearVideoRoots = () => {
    videoRoots.forEach((root) => root.removeAttribute(VIDEO_ROOT_ATTR));
    videoRoots = [];
    videoOverlays.forEach((overlay) => overlay.removeAttribute(VIDEO_OVERLAY_ATTR));
    videoOverlays = [];
    videoStrips.forEach((strip) => strip.removeAttribute(VIDEO_STRIP_ATTR));
    videoStrips = [];
    videoFrames.forEach((frame) => frame.removeAttribute(VIDEO_FRAME_ATTR));
    videoFrames = [];
    markedVideos.forEach((video) => video.removeAttribute(VIDEO_EL_ATTR));
    markedVideos = [];
  };

  const stopVideoRootObserver = () => {
    if (videoRootObserver) {
      videoRootObserver.disconnect();
      videoRootObserver = null;
    }
    clearVideoRoots();
    videoRootHost = null;
  };

  const startVideoRootObserver = (fsEl) => {
    stopVideoRootObserver();
    videoRootHost = fsEl;
    // Re-mark on subsequent frames — when fsEl was just made fullscreen the
    // children haven't necessarily measured to their final size yet, so a
    // single sync call can miss them.
    const isPlayerMutation = (mutation) => {
      const target = mutation.target;
      return target instanceof Node && !chatSlot?.contains(target);
    };
    const refreshSoon = (mutations = []) => {
      if (mutations.length && !mutations.some(isPlayerMutation)) return;
      if (!active || videoRootHost !== fsEl) return;
      refreshVideoRoots(fsEl);
      requestAnimationFrame(() => {
        if (active && videoRootHost === fsEl) refreshVideoRoots(fsEl);
      });
      setTimeout(() => {
        if (active && videoRootHost === fsEl) refreshVideoRoots(fsEl);
      }, 150);
    };
    videoRootObserver = new MutationObserver(refreshSoon);
    videoRootObserver.observe(fsEl, { childList: true, subtree: true });
    refreshSoon();
  };

  // When the user changes stream quality (or anything else that causes Kick to reload
  // the player), Kick's React reconciliation conflicts with our layout and can
  // navigate the page to a 404 error. Tearing the layout down at the first sign of
  // a reload prevents the conflict.
  const teardownIfActive = (reason) => {
    if (!active) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    log('teardown triggered by', reason);
    disableSideChat(fs);
  };
  const onVideoEmptied = () => teardownIfActive('video emptied');
  const onVideoLoadStart = () => {
    // Ignore the initial load that happens right after we attach the listener.
    if (Date.now() - enabledAt < 1500) return;
    teardownIfActive('video loadstart');
  };
  const onPopState = () => teardownIfActive('popstate');
  window.addEventListener('popstate', onPopState);

  // Reloading the video element (via emptied/loadstart) can be too late: React's
  // reconciler may already be mid-commit, and Kick's error boundary can navigate
  // to its 404 page before our async handlers fire. Catch the user's click on
  // actions that re-mount the player (quality change, seeking) in the capture
  // phase and tear down synchronously, so the DOM is back in Kick's expected
  // shape before its onClick runs.
  const QUALITY_OPTION_RE = /^(?:auto|source|original|\d{2,4}p(?:\d{2})?(?:\s*60)?)$/i;
  // Quality items in Kick's popover are plain divs without a button/role, so closest()
  // on tag/role selectors misses them. Walk up a few levels checking textContent.
  const isQualityOptionClick = (target) => {
    let node = target;
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      const text = (node.textContent || '').trim();
      if (text && text.length <= 16 && QUALITY_OPTION_RE.test(text)) return text;
      node = node.parentElement;
    }
    return null;
  };
  // The seekbar uses Tailwind's group/seekbar class.
  const isSeekbarClick = (target) =>
    !!target.closest('[class*="group/seekbar"], [class*="seekbar"]');
  // Only a live stream's seekbar re-mounts the player (the live → DVR switch).
  // On a VOD (/<channel>/videos/<id>) or a clip (/<channel>/clips/<id>) it
  // seeks the same <video> in place, with no loadstart or emptied and the
  // player tree left standing, so tearing the chat down there only closed it
  // on every scrub. A reload that does happen is still caught by loadstart.
  const isRecordingPage = () => /^\/[^/]+\/(?:videos|clips)\/[^/]+/.test(location.pathname);
  // "Go to live" / "Jump to live" — exiting DVR mode also re-mounts the player.
  // Kick translates the label ("Přejít na LIVE" in Czech, "Zum Live" in
  // German), so the English pattern only catches English. The language-free
  // match (0.29.2) is the button's shape, from Kick's player code
  // (MainPlayerControls.Status): a plain button in the player whose children
  // are exactly an icon and one text span, with no aria-label of its own and
  // outside any menu or dialog. At the live edge the same button reads
  // "LIVE" — an untranslated literal — and clicking it reloads nothing, so
  // that text is left out. Kick's other player buttons are icon buttons with
  // an aria-label, and its menus' items sit inside role="menu".
  const GO_LIVE_RE = /^(?:go\s*to\s*live|jump\s*to\s*live|back\s*to\s*live|skip\s*to\s*live|go\s*live)$/i;
  const LIVE_STATUS_MENU_SELECTOR =
    '[role="menu"], [role="menuitem"], [role="menuitemradio"], [role="dialog"], [role="listbox"], [role="radiogroup"]';
  const liveStatusText = (btn) => {
    if (!btn || btn.getAttribute('aria-label')) return null;
    const kids = btn.children;
    if (!kids || kids.length !== 2) return null;
    if (String(kids[0].tagName).toLowerCase() !== 'svg') return null;
    if (String(kids[1].tagName).toLowerCase() !== 'span') return null;
    const text = (kids[1].textContent || '').trim();
    if (!text || text.length > 24 || text === 'LIVE') return null;
    if (btn.closest(LIVE_STATUS_MENU_SELECTOR)) return null;
    return text;
  };
  const isGoLiveClick = (target) => {
    let node = target;
    for (let i = 0; i < 4 && node && node !== document.body; i++) {
      const text = (node.textContent || '').trim();
      if (text && text.length <= 24 && GO_LIVE_RE.test(text)) return text;
      node = node.parentElement;
    }
    const btn = target.closest('button');
    const player = document.querySelector('#injected-channel-player, [data-testid="player"]');
    if (!btn || !player?.contains(btn)) return null;
    // Kick's chat pill is an icon and a word too; it is a chat toggle,
    // handled as one, never a reload.
    if (looksLikeChatToggleBtn(btn)) return null;
    return liveStatusText(btn);
  };
  // Raise videoReloading synchronously on known reload triggers so the Chat
  // button disables before the user can click it. When side chat is active we
  // also tear down preemptively to avoid the reconciler collision; when it is
  // not, we just flip the flag so the button reflects the impending reload.
  const markReloadAndMaybeTeardown = (fs, reason) => {
    videoReloading = true;
    clearReloadSafetyTimer();
    reloadSafetyTimer = setTimeout(() => {
      reloadSafetyTimer = 0;
      // No loadstart/emptied fired — the click didn't actually reload the
      // player (likely a no-op click on the already-selected quality). Release
      // the flag so the Chat button isn't stuck disabled.
      if (videoReloading) {
        log(reason, 'safety timeout, releasing videoReloading');
        videoReloading = false;
        updateBtnLabel();
      }
    }, RELOAD_SAFETY_MS);
    if (active) {
      log(reason, 'detected, tearing down preemptively');
      disableSideChat(fs);
    } else {
      log(reason, 'detected, disabling Chat button until reload completes');
      updateBtnLabel();
    }
  };
  // Nothing inside our own UI re-mounts the player, and the text tests above
  // are loose enough to match plenty there: Kick puts each chat message's text
  // straight into its own <span>, so clicking a message that just says "1080p",
  // "source" or "go live" read as a quality / go-live click and tore the side
  // chat down; and kick-quality-saver's panel, mounted in our control wrap, has
  // chips labelled exactly "Auto" / "1080p60". A real quality change from that
  // panel is still caught — it is applied by clicking Kick's own menu items.
  const onDocClickCapture = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    if (isKfcOwnedNode(target)) return;
    const quality = isQualityOptionClick(target);
    if (quality) return markReloadAndMaybeTeardown(fs, `quality option click (${quality})`);
    if (isSeekbarClick(target)) {
      if (isRecordingPage()) return;
      return markReloadAndMaybeTeardown(fs, 'seekbar click');
    }
    const goLive = isGoLiveClick(target);
    if (goLive) return markReloadAndMaybeTeardown(fs, `go-to-live click (${goLive})`);
  };
  document.addEventListener('click', onDocClickCapture, true);
  // Seeking via keyboard (arrow keys) or pointerdown on the seekbar also re-mounts
  // the player tree without going through a click event. Cover those too.
  const onDocPointerDownCapture = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!isSeekbarClick(target) || isRecordingPage()) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fs) return;
    if (isKfcOwnedNode(target)) return;
    markReloadAndMaybeTeardown(fs, 'seekbar pointerdown');
  };
  document.addEventListener('pointerdown', onDocPointerDownCapture, true);

  // When chat starts hidden (data-chat="false") and the user enables our side layout,
  // Kick's internal "is chat shown" state is out of sync with the DOM. The next click
  // on Kick's "Hide chat" button toggles Kick's state from hidden→shown — so data-chat
  // doesn't change to "false" and the MutationObserver doesn't fire. Catch the click
  // directly so one click always tears down, regardless of Kick's internal state.
  // Also match "Show chat": in the out-of-sync case Kick still labels its toggle
  // "Show chat" (because it thinks chat is hidden) even though our slot is visible,
  // so the first click on what the user sees as a close button is on "Show chat".
  // Listen at document level (capture) rather than on chatSlot, because when
  // Kick's React thinks chat is hidden it renders the toggle as a floating
  // button OUTSIDE the chat panel (and therefore outside our slot). That used
  // to require two clicks — the first to flip Kick's state back to "shown"
  // (no data-chat change → observer doesn't fire), the second to actually
  // close. A document-level capture handler catches the toggle wherever Kick
  // mounts it.
  // Kick's native player gestures — double-click to exit fullscreen, single
  // click to play/pause — are both handled on the `<video>` element, but we set
  // `pointer-events: none` on the marked video while side chat is active so
  // clicks pass through to Kick's controls (introduced in 0.9.7). That blocks
  // both. Provide our own while the side chat is up, so users keep the gestures
  // they have in the non-side-chat layout.
  //
  // Shared gate for both: the click has to be on the bare player surface. Our
  // own UI, the chat panel, and anything Kick made interactive run their own
  // handlers and must not also pause the stream or tear fullscreen down.
  // Anything of ours that lives inside the fullscreen element. `isKfcOwnedChild`
  // answers the same question for *direct children* of fsEl; this one answers it
  // for a node at any depth, which is what a hit test or a DOM search needs.
  const KFC_OWN_UI_SEL = `#${WRAP_ID}, #${SETTINGS_PANEL_ID}, #${INFO_ID}, #${RESIZE_ID}, #${TOAST_ID}`;
  const isKfcOwnedNode = (el) =>
    el instanceof Element &&
    (!!el.closest(KFC_OWN_UI_SEL) || !!(chatSlot && (el === chatSlot || chatSlot.contains(el))));
  const isVideoSurfaceTarget = (target) => {
    if (!(target instanceof Element)) return false;
    // Inside the chat slot is text selection / message UI; likewise our own
    // control cluster, settings panel, info overlay, divider and toast.
    if (isKfcOwnedNode(target)) return false;
    // Kick's own menus, dialogs and tooltips, which in fullscreen render inside
    // the fullscreen element — a click on a menu's text is not a click on the
    // video, and a double-click there must not exit fullscreen.
    if (isKickPopup(target)) return false;
    // Kick's own controls (timeline scrub, setting buttons, menu items, links).
    if (
      target.closest('button, [role="button"], [role="slider"], a, input, textarea, select, [contenteditable]')
    ) return false;
    // The seekbar re-mounts the player; onDocClickCapture owns that path.
    if (isSeekbarClick(target)) return false;
    return true;
  };
  const isVideoSurfaceClick = (e) => isVideoSurfaceTarget(e.target);
  const findPlayerVideo = () =>
    markedVideos.find((video) => video.isConnected) ||
    (videoEl?.isConnected ? videoEl : null) ||
    null;
  // **Clicking the video only ever resumes it — it never pauses it.** Kick's own
  // handler toggles, but a click that pauses is the one nobody means: it is what
  // a mis-aimed click on the player, or the click that re-activates the window,
  // turns into. So a click while the stream is playing is deliberately inert.
  const canResumeByClick = () => {
    const video = findPlayerVideo();
    return !!video && video.paused;
  };
  // The cursor has to say the same thing the click does — including saying
  // nothing when the click would do nothing, so the pointer hand appears only
  // while a click would actually resume playback. Kick's own `cursor: pointer`
  // is on the <video>, which never gets hit while it is click-through, and the
  // CSS fallback on the marked video layers only covers the hit landing on one
  // of *those* (Kick stacks its own full-size layers over the video, and any of
  // them may carry an explicit cursor that beats an inherited one). So drive it
  // from the same two conditions the click uses. One inline property on one
  // element at a time, removed as soon as it stops applying (and on teardown),
  // so nothing of Kick's is left rewritten.
  let hoverTarget = null;
  let cursorTarget = null;
  const clearSurfaceCursor = () => {
    if (!cursorTarget) return;
    cursorTarget.style.removeProperty('cursor');
    cursorTarget = null;
  };
  // Teardown: drop the remembered hover as well, so a detached node isn't held
  // and the next fullscreen session starts from nothing.
  const resetSurfaceCursor = () => {
    clearSurfaceCursor();
    hoverTarget = null;
  };
  // Re-evaluated on pointer movement *and* on play/pause, since the answer
  // changes with playback state while the pointer sits still.
  const refreshSurfaceCursor = () => {
    const next =
      active && hoverTarget && isVideoSurfaceTarget(hoverTarget) && canResumeByClick()
        ? hoverTarget
        : null;
    if (next === cursorTarget) return;
    clearSurfaceCursor();
    if (!next) return;
    cursorTarget = next;
    next.style.setProperty('cursor', 'pointer', 'important');
  };
  const applySurfaceCursor = (target) => {
    hoverTarget = target instanceof Element ? target : null;
    refreshSurfaceCursor();
  };
  // Double-click → exit fullscreen. Same trust rule as onFsClick below: only a
  // real double-click counts, so another script dispatching events at the
  // player can't throw the user out of fullscreen.
  const onFsDblClick = (e) => {
    if (!active) return;
    if (!e.isTrusted) return;
    if (!isVideoSurfaceClick(e)) return;
    log('double-click on video area, exiting fullscreen');
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };
  // Click → resume. One-way on purpose (see canResumeByClick): a click on a
  // playing stream does nothing at all, so nothing can pause the stream by
  // accident, and the double-click that exits fullscreen has nothing to undo.
  //
  // Only real pointer clicks count. A script-dispatched click carries
  // detail === 0 (see wireControlButton for the sibling userscript that fires
  // them), and starting playback off another script's synthetic click is
  // exactly the kind of thing 0.21.9 went to lengths to stop.
  const onFsClick = (e) => {
    if (!active) return;
    if (!e.isTrusted || e.detail < 1) return;
    if (!isVideoSurfaceClick(e)) return;
    const video = findPlayerVideo();
    if (!video || !video.paused) return;
    log('click on video area, resuming playback');
    // The gesture is still live (no timer between the click and here), so
    // autoplay policies let this through; a rejection is nothing we can act on
    // either way.
    video.play()?.catch?.(() => {});
  };

  // Anchored, with a real space and a word end: the label has to *be* "hide
  // chat" / "show chat" etc., not merely contain those letters. Kick renders
  // every chat username as a <button>, and the unanchored form matched names
  // like "OpenChatFan" or "xshowchatx" — clicking one tore the side chat down,
  // and findKickShowChatBtn could click one while syncing Kick's state. The \b
  // also keeps "show chatters"-style labels out.
  const CHAT_TOGGLE_RE = /^(?:hide|close|collapse|show|open|expand)\s+chat\b/;
  // Narrower: only the verbs that mean "make chat appear". findKickShowChatBtn
  // clicks what it finds, so it must never land on the *hide* control.
  const SHOW_CHAT_RE = /^(?:show|open|expand)\s+chat\b/;
  // Kick's chat-toggle controls carry no telling label: no aria-label, no
  // title, and at most the bare word "Chat". Recognise them by the SVG path data,
  // taking the first ~12 chars of the arrow path's `d` — distinctive enough
  // that nothing else on the page shares it (verified: exactly one matching
  // path element each), but short enough to survive minor minifier changes.
  //
  // There are TWO separate buttons, not one CSS-flipped button as this code
  // assumed until 0.21.7, and **both are in the DOM in both states** — the
  // inactive one is either 0x0 or parked off-screen, never absent. So a lookup
  // that wants a specific direction cannot just take the first icon match.
  //   • Show chat — floating, over the player, `div.absolute.top-7`.
  //   • Hide chat — in the chat panel's own header, 12px in from its left edge.
  // Kick swapped the hide button to its own mirrored icon at some point, which
  // this only knew the "show" half of; see the 0.21.7 changelog entry for what
  // that broke.
  const KICK_SHOW_CHAT_PATH_SIG = 'M8.79052 14.6146';
  const KICK_HIDE_CHAT_PATH_SIG = 'm22.24 6.74';
  const hasPathSig = (btn, sig) => {
    for (const p of btn.querySelectorAll('path[d]')) {
      if ((p.getAttribute('d') || '').startsWith(sig)) return true;
    }
    return false;
  };
  // Kick has since moved both toggles onto its design-system icons, which name
  // themselves (`data-ds-icon`) — a sturdier signature than path data, which
  // went stale with the redraw and made closing the chat take two clicks again
  // (0.24.3). Hide is the chat header's CollapseRight; Show is now a "Chat"
  // button with MessagesOutline, floating over the player. That icon is
  // generic, so the show button must also sit in the player's own container —
  // findKickShowChatBtn *clicks* what this matches.
  const KICK_HIDE_CHAT_ICON = 'CollapseRight';
  const KICK_SHOW_CHAT_ICON = 'MessagesOutline';
  const hasDsIcon = (btn, name) => !!btn.querySelector(`svg[data-ds-icon="${name}"]`);
  const isKickHideChatBtn = (btn) =>
    hasPathSig(btn, KICK_HIDE_CHAT_PATH_SIG) || hasDsIcon(btn, KICK_HIDE_CHAT_ICON);
  const isKickShowChatBtn = (btn) => {
    if (hasPathSig(btn, KICK_SHOW_CHAT_PATH_SIG)) return true;
    if (!hasDsIcon(btn, KICK_SHOW_CHAT_ICON) || isKfcOwnedNode(btn)) return false;
    const player = document.querySelector('#injected-channel-player, [data-testid="player"]');
    return !!player?.parentElement?.contains(btn);
  };
  // Either direction — used to spot that the *user* clicked a chat toggle, where
  // which one it was doesn't matter.
  const looksLikeChatToggleBtn = (btn) => isKickShowChatBtn(btn) || isKickHideChatBtn(btn);
  // Best-effort lookup for Kick's own "Show chat" button anywhere on the page.
  // Used during enableSideChat to sync Kick's React state when it thinks chat
  // is hidden (otherwise React reconciles our data-chat="true" back to "false"
  // and the dataChatObserver immediately tears the layout down). Deliberately
  // matches the show direction only: the hide button is present in the DOM at
  // the same time, and clicking that one here would drive Kick's state the
  // wrong way.
  const findKickShowChatBtn = () => {
    const buttons = document.querySelectorAll('button');
    // Pass 1: explicit text/aria/title match — the most reliable signal.
    for (const b of buttons) {
      if (b.id === BTN_ID) continue;
      const text = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
      const title = (b.getAttribute('title') || '').trim().toLowerCase();
      if (
        SHOW_CHAT_RE.test(text) ||
        SHOW_CHAT_RE.test(aria) ||
        SHOW_CHAT_RE.test(title)
      ) return b;
    }
    // Pass 2: icon signature (design-system name, or legacy path data).
    for (const b of buttons) {
      if (b.id === BTN_ID) continue;
      if (isKickShowChatBtn(b)) return b;
    }
    return null;
  };

  const onDocChatToggleClickCapture = (e) => {
    if (!active) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest('button');
    if (!btn) return;
    if (btn.id === BTN_ID) return; // ignore our own Chat toggle
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
    const title = (btn.getAttribute('title') || '').trim().toLowerCase();
    if (
      !CHAT_TOGGLE_RE.test(text) &&
      !CHAT_TOGGLE_RE.test(aria) &&
      !CHAT_TOGGLE_RE.test(title) &&
      !looksLikeChatToggleBtn(btn)
    ) return;
    log('chat-toggle button clicked, scheduling teardown');
    // Let Kick's own onClick handler run first, then tear down on the next tick.
    setTimeout(() => {
      if (!active) return;
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) disableSideChat(fs);
    }, 0);
  };
  document.addEventListener('click', onDocChatToggleClickCapture, true);

  // ── Chat-width resize ──────────────────────────────────────────────────
  // The chat panel width is a CSS variable (--kfc-chat-width) referenced by
  // both the chat slot and the video-shrink calc. A fixed-position divider
  // handle drives it via pointer drag. Width is persisted (see saveSettings).
  // viewportWidth is a parameter (not always read live) so the per-frame divider
  // drag can pass a value cached at pointerdown: reading window.innerWidth during
  // a move forces a synchronous reflow of Kick's chat subtree that the move just
  // dirtied, which is what makes the chat stutter while dragging.
  const clampChatWidth = (px, viewportWidth = window.innerWidth) =>
    Math.max(CHAT_WIDTH_MIN, Math.min(px, CHAT_WIDTH_MAX, Math.round(viewportWidth * 0.6)));

  const applyChatWidth = () => {
    document.documentElement.style.setProperty('--kfc-chat-width', `${chatWidth}px`);
  };

  // Highlight the width preset chip (if any) that matches the current width, so
  // the selection is visible — including after a reload, since chatWidth is
  // restored from storage before the panel is built.
  const updateWidthChips = () => {
    document
      .querySelectorAll(`#${SETTINGS_PANEL_ID} .kfc-settings-chip[data-kfc-width]`)
      .forEach((chip) => {
        chip.classList.toggle('kfc-selected', Number(chip.dataset.kfcWidth) === chatWidth);
      });
  };

  const setChatWidth = (px, viewportWidth) => {
    chatWidth = clampChatWidth(px, viewportWidth);
    applyChatWidth();
    scheduleLiveResizeLayout();
    updateWidthChips();
    persistSettings();
  };

  const resetSessionSettings = () => {
    chatWidth = parseInt(CHAT_WIDTH, 10);
    chatSide = 'right';
    overlayMode = false;
    infoHidden = false;
    infoBgOpacity = 60;
    infoShowActions = true;
    infoShowTags = true;
    overlayOpacity = 55;
    autoHideOverlayChat = true;
    autoHideControls = true;
    openChatAsOverlay = false;
    restoreChatOnFullscreen = true;
    messagesOnly = false;
    idleDelayMs = 4000;
    muteAds = false;
    updateAdMuteWatch();
    applyChatWidth();
    updateWidthChips();
    syncControlState();
    onFsMouseMove();
    nudgePlayerResize();
    saveSettings();
  };

  let resizeHandle = null;
  let resizing = false;
  let resizeLayoutFrame = 0;
  let resizePendingClose = false;
  // Divider-drag state. Pointer moves are coalesced to one width update per
  // animation frame (resizeMoveFrame) so a high-polling mouse / high-refresh
  // display can't trigger several full chat relayouts per frame, and the
  // viewport width is snapshotted at pointerdown (resizeViewportWidth) so the
  // per-frame clamp never reads layout mid-drag.
  let resizeMoveFrame = 0;
  let resizePointerX = 0;
  let resizeViewportWidth = 0;
  let resizeStartWidth = 0;

  const setResizeUiState = (isResizing) => {
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.classList.toggle('kfc-resizing', isResizing);
  };

  const scheduleLiveResizeLayout = () => {
    // While the divider is actively dragged the chat width is driven entirely by
    // the --kfc-chat-width CSS variable (rewritten every frame in setChatWidth),
    // which resizes the video box live via CSS (width: calc(100% - chat width),
    // object-fit: contain) with no JS. Re-running the heavy player relayout on
    // every pointermove — refreshVideoRoots plus a synthetic window 'resize'
    // that makes Kick's React player re-measure — is what makes the drag feel
    // laggy, so defer it to pointerup, where nudgePlayerResize() fires the final
    // reflow. Discrete width changes (preset chips, reset) aren't dragging, so
    // they still relayout immediately.
    if (resizing) return;
    if (resizeLayoutFrame) return;
    resizeLayoutFrame = requestAnimationFrame(() => {
      resizeLayoutFrame = 0;
      if (active && videoRootHost) refreshVideoRoots(videoRootHost);
      window.dispatchEvent(new Event('resize'));
    });
  };

  // Apply the latest pointer position to the chat width. Runs at most once per
  // animation frame (scheduled from onResizePointerMove) so the chat subtree
  // reflows once per frame instead of once per raw pointermove.
  const applyResizeFromPointer = () => {
    resizeMoveFrame = 0;
    if (!resizing) return;
    // Width is the pointer's distance from the docked edge: from the right edge
    // of the viewport when docked right, from the left edge when docked left.
    // Use the viewport width snapshotted at pointerdown so this never reads
    // layout (which would force a synchronous reflow of the just-dirtied chat).
    const rawWidth =
      chatSide === 'left' ? resizePointerX : resizeViewportWidth - resizePointerX;
    setChatWidth(rawWidth, resizeViewportWidth);
    // Arm a release-to-close: when the *raw* (pre-clamp) width is pulled well
    // past the minimum, releasing the pointer will tear the side chat down
    // instead of just clamping at min. The slot dims mid-drag so the gesture
    // is visible before commit.
    const armed = rawWidth < CHAT_WIDTH_CLOSE_THRESHOLD;
    if (armed !== resizePendingClose) {
      resizePendingClose = armed;
      if (chatSlot) chatSlot.classList.toggle('kfc-pending-close', armed);
    }
  };

  const onResizePointerMove = (e) => {
    if (!resizing) return;
    resizePointerX = e.clientX;
    if (resizeMoveFrame) return;
    resizeMoveFrame = requestAnimationFrame(applyResizeFromPointer);
  };

  const onResizeDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setChatWidth(parseInt(CHAT_WIDTH, 10));
    nudgePlayerResize();
  };

  const onResizePointerUp = (e) => {
    if (!resizing) return;
    resizing = false;
    if (resizeMoveFrame) {
      cancelAnimationFrame(resizeMoveFrame);
      resizeMoveFrame = 0;
    }
    setResizeUiState(false);
    if (resizeHandle) {
      resizeHandle.classList.remove('kfc-dragging');
      try { resizeHandle.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (chatSlot) chatSlot.classList.remove('kfc-pending-close');
    window.removeEventListener('pointermove', onResizePointerMove);
    window.removeEventListener('pointerup', onResizePointerUp);
    window.removeEventListener('pointercancel', onResizePointerUp);
    // pointercancel (e.g. browser stealing the pointer) shouldn't trigger a
    // close — only an actual pointerup release means the user committed.
    const shouldClose = resizePendingClose && e.type !== 'pointercancel';
    resizePendingClose = false;
    if (shouldClose) {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl && active) {
        log('resize divider released past close threshold; closing side chat');
        // The drag clamped the width to the minimum on its way past it. The
        // gesture means "close", not "make it narrow", so the chat reopens
        // at the width it had before the drag.
        setChatWidth(resizeStartWidth, resizeViewportWidth);
        disableSideChat(fsEl);
        return;
      }
    }
    nudgePlayerResize();
  };

  const onResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    // Snapshot the viewport width once; it can't change during a fullscreen
    // drag, and reading it per-move would force a synchronous chat reflow.
    resizeViewportWidth = window.innerWidth;
    resizePointerX = e.clientX;
    resizeStartWidth = chatWidth;
    setResizeUiState(true);
    if (resizeHandle) {
      resizeHandle.classList.add('kfc-dragging');
      try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) {}
    }
    window.addEventListener('pointermove', onResizePointerMove);
    window.addEventListener('pointerup', onResizePointerUp);
    window.addEventListener('pointercancel', onResizePointerUp);
  };

  const mountResizeHandle = (fsEl) => {
    removeResizeHandle();
    resizeHandle = document.createElement('div');
    resizeHandle.id = RESIZE_ID;
    resizeHandle.setAttribute('aria-hidden', 'true');
    resizeHandle.addEventListener('pointerdown', onResizePointerDown);
    resizeHandle.addEventListener('dblclick', onResizeDoubleClick);
    fsEl.appendChild(resizeHandle);
  };

  const removeResizeHandle = () => {
    if (resizing) onResizePointerUp({ pointerId: -1 });
    if (resizeHandle) {
      resizeHandle.removeEventListener('pointerdown', onResizePointerDown);
      resizeHandle.removeEventListener('dblclick', onResizeDoubleClick);
      resizeHandle.remove();
      resizeHandle = null;
    }
  };

  // Kick's chat subtree sometimes throws during a later render (websocket
  // reconnect, mod action, pinned-message update) and Kick's own error
  // boundary inside the chat shows "We are sorry, but something went wrong.
  // Please try again later." The boundary doesn't reset on its own, so
  // without intervention the user has to reload the whole page. Once we
  // detect the fallback inside our chat slot we tear the side layout down,
  // which puts the chat node back where Kick expects it and gives the user
  // a Chat button to retry with. We don't try to reset Kick's React state —
  // re-opening side chat may or may not recover depending on whether Kick
  // remounted the subtree, but the user is no longer stuck.
  // The boundary's text is translated with Kick's language (Chatroom
  // .error_fallback: "Něco se pokazilo. Zkus to znovu později." in Czech),
  // so the English text alone missed every crash in another language. The
  // language-free sign (0.29.2): the fallback replaces Kick's whole chat
  // subtree, so #chatroom-messages leaves the slot and doesn't come back.
  // It only counts once the list has been seen in this slot (a chat still
  // loading has none yet) and once it has stayed gone for
  // CHAT_LIST_GONE_MS, so a quick remount (a chatroom switch, a reconnect)
  // never closes the side chat. A real crash is permanent; waiting costs
  // nothing but those seconds.
  const CHAT_ERROR_RE = /we are sorry,?\s*but something went wrong/i;
  const CHAT_LIST_GONE_MS = 3000;
  let chatListSeen = false;
  let chatListGoneSince = 0;
  let chatListGoneTimer = 0;

  // What the slot shows: null (a working chat, or one still loading),
  // 'pending' (the list just went missing), or why it counts as crashed.
  const chatCrashState = (slot, now) => {
    if (CHAT_ERROR_RE.test(slot.textContent || '')) return 'error text';
    if (slot.querySelector('#chatroom-messages')) {
      chatListSeen = true;
      chatListGoneSince = 0;
      return null;
    }
    if (!chatListSeen) return null;
    if (!chatListGoneSince) chatListGoneSince = now;
    return now - chatListGoneSince >= CHAT_LIST_GONE_MS ? 'message list gone' : 'pending';
  };

  const resetChatCrashState = () => {
    chatListSeen = false;
    chatListGoneSince = 0;
    clearTimeout(chatListGoneTimer);
    chatListGoneTimer = 0;
  };

  const checkChatCrash = (fsEl) => {
    if (chatErrorRecovering || !chatSlot) return;
    const state = chatCrashState(chatSlot, Date.now());
    if (state === 'pending') {
      // The fallback is static, so no mutation may come to re-check it:
      // look again once the wait is over.
      if (!chatListGoneTimer) {
        chatListGoneTimer = setTimeout(() => {
          chatListGoneTimer = 0;
          checkChatCrash(fsEl);
        }, CHAT_LIST_GONE_MS + 50);
      }
      return;
    }
    if (!state) return;
    chatErrorRecovering = true;
    log('Kick chat error boundary detected (' + state + '); tearing down side chat');
    dumpRecentErrors('Kick chat crashed');
    showToast(uiText().chatErrored);
    stopChatErrorWatcher();
    disableSideChat(fsEl);
    chatErrorRecovering = false;
  };

  const startChatErrorWatcher = (fsEl) => {
    if (!chatSlot || chatErrorObserver) return;
    startConsoleErrorCapture();
    resetChatCrashState();
    chatErrorObserver = new MutationObserver(() => {
      // Coalesce a burst of message mutations into one textContent read per
      // frame; on a busy stream we'd otherwise re-scan the slot once per
      // arriving message for no benefit.
      if (chatErrorCheckScheduled || chatErrorRecovering) return;
      chatErrorCheckScheduled = requestAnimationFrame(() => {
        chatErrorCheckScheduled = 0;
        if (chatErrorRecovering || !chatSlot) return;
        refreshChatBar();
        checkChatCrash(fsEl);
      });
    });
    chatErrorObserver.observe(chatSlot, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  const stopChatErrorWatcher = () => {
    stopConsoleErrorCapture();
    if (chatErrorObserver) {
      chatErrorObserver.disconnect();
      chatErrorObserver = null;
    }
    if (chatErrorCheckScheduled) {
      cancelAnimationFrame(chatErrorCheckScheduled);
      chatErrorCheckScheduled = 0;
    }
    resetChatCrashState();
  };

  // ── Chat action bar fold ─────────────────────────────────────────────
  // Kick's action bar (points, Kicks, drops, gear, the green Chat send
  // button) is folded: points, Kicks and drops go behind one "Show more"
  // button (the gear and Chat stay), which brings them back on demand.
  // Always folded since 0.31.0 (before, only when the row would wrap), the
  // same as kick-chat-utils' fold of this bar in normal view; it steps aside
  // inside our .kfc-chat-slot. The bar is found from the send button and
  // re-found whenever the chat slot's subtree changes, since React replaces
  // it on remounts (log-in, chatroom switch).
  let chatBar = null;

  const chatBarRightGroup = (bar) => bar.querySelector(':scope > * > #send-message-button')?.parentElement || null;

  // Anything to fold: logged out the left group can be empty (or hold only
  // drops), and an empty fold would leave a button that shows nothing.
  const chatBarHasLeft = (bar, right) => Array.from(bar.children)
    .some((el) => el !== right && el.id !== BAR_MORE_ID && !!el.querySelector('button, a'));

  const setChatBarOpen = (open) => {
    if (!chatSlot) return;
    chatSlot.classList.toggle('kfc-bar-open', open);
    const btn = document.getElementById(BAR_MORE_ID);
    if (!btn) return;
    btn.setAttribute('aria-expanded', String(open));
    const t = uiText();
    btn.setAttribute('aria-label', open ? t.fewerActions : t.moreActions);
    const label = btn.querySelector('span');
    if (label) label.textContent = open ? t.showLess : t.showMore;
  };

  const fitChatBar = () => {
    if (!chatSlot || !chatBar) return;
    const right = chatBarRightGroup(chatBar);
    const fold = !!right && chatBarHasLeft(chatBar, right);
    if (fold === chatSlot.classList.contains('kfc-bar-folded')) return;
    chatSlot.classList.toggle('kfc-bar-folded', fold);
    if (!fold) setChatBarOpen(false);
    log(fold ? 'chat action bar folded' : 'chat action bar: nothing to fold');
  };

  const onChatBarMoreClick = (e) => {
    if (!e.isTrusted) return;
    if (e.detail) e.currentTarget.blur();
    setChatBarOpen(!chatSlot?.classList.contains('kfc-bar-open'));
  };

  const ensureChatBarMoreButton = (bar) => {
    let btn = document.getElementById(BAR_MORE_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BAR_MORE_ID;
      btn.type = 'button';
      // The label goes in the aria-label too, with "chat" in it (see the
      // aria-label contract on the cluster's controls).
      btn.setAttribute('aria-label', uiText().moreActions);
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = `${BAR_MORE_SVG}<span></span>`;
      btn.querySelector('span').textContent = uiText().showMore;
      btn.addEventListener('click', onChatBarMoreClick);
    }
    if (bar.firstElementChild !== btn) bar.prepend(btn);
  };

  const unbindChatBar = () => {
    chatBar = null;
    if (chatSlot) {
      setChatBarOpen(false);
      chatSlot.classList.remove('kfc-bar-folded');
    }
    document.getElementById(BAR_MORE_ID)?.remove();
  };

  // Cheap enough to run on every coalesced chat mutation: one id lookup and a
  // query in a handful of nodes, writing only when something changed.
  const refreshChatBar = () => {
    if (!chatSlot) return;
    const send = chatSlot.querySelector('#send-message-button');
    const bar = send?.parentElement?.parentElement || null;
    if (bar !== chatBar) {
      unbindChatBar();
      if (!bar) return;
      chatBar = bar;
    }
    ensureChatBarMoreButton(bar);
    fitChatBar();
  };

  const enableSideChat = (fsEl) => {
    if (!fsEl) {
      log('enableSideChat: no fullscreen element');
      return;
    }
    if (active || pendingVideoEl) return;

    // Defer while the video is still loading — Kick's React is in the middle
    // of mounting the player tree, and changing the fullscreen DOM mid-mount
    // can still cause reconciliation to fail and Kick to navigate to its 404
    // page.
    const probeVideo = queryPlayerVideo(fsEl);
    if (!probeVideo) {
      log('no video element yet, ignoring click — button should be disabled');
      return;
    }
    if (videoReloading || probeVideo.readyState < 2) {
      log('video still loading (readyState=', probeVideo.readyState, '), deferring enable');
      pendingVideoEl = probeVideo;
      pendingOnReady = () => {
        clearPendingEnable();
        const currentFs = document.fullscreenElement || document.webkitFullscreenElement;
        if (currentFs && !active) enableSideChat(currentFs);
      };
      // 10s ceiling so a stalled load doesn't leave the user stuck. If we hit
      // it we silently abandon — the next Chat click can retry.
      pendingTimeoutId = setTimeout(() => {
        log('video load deadline reached, abandoning pending enable');
        clearPendingEnable();
      }, 10000);
      probeVideo.addEventListener('loadeddata', pendingOnReady);
      probeVideo.addEventListener('canplay', pendingOnReady);
      return;
    }

    const chat = findChat();
    if (!chat) {
      warn('chat container not found. Lookup diagnostics:', getChatLookupDiagnostics());
      showToast(uiText().chatNotFound);
      return;
    }
    log('enableSideChat: using chat node', chat);
    overlayMode = openChatAsOverlay;

    // If Kick's React state currently says chat is HIDDEN, just writing
    // data-chat="true" is not enough: React will reconcile the attribute back
    // to "false" on its next commit, our dataChatObserver fires, and the
    // side-chat layout collapses immediately. Sync Kick's state first by
    // programmatically clicking its own chat-toggle button — that flips
    // React's `isChatShown` to true so the attribute write below is what
    // React itself wants and the reconcile is a no-op.
    const dataChatHostBefore = document.querySelector('[data-chat]');
    const kickStateHidden =
      dataChatHostBefore?.getAttribute('data-chat') === 'false';
    if (kickStateHidden) {
      const kickBtn = findKickShowChatBtn();
      if (kickBtn) {
        log('Kick state is hidden; syncing via programmatic click on Kick toggle');
        // Suppress both the dataChatObserver (Kick's onClick may set
        // data-chat="true" → no teardown wanted) and the document-level
        // chat-toggle click capture (active is still false here so it would
        // bail anyway, but be defensive).
        suppressObserver = true;
        kickBtn.click();
        // Release after Kick's React has had a tick to commit the state flip.
        setTimeout(() => { suppressObserver = false; }, 0);
      } else {
        warn('Kick state is hidden but no chat-toggle button found to sync');
      }
    }

    // Make sure Kick's CSS is in the "chat visible" state before we move the node.
    suppressObserver = true;
    const flipped = setKickDataChat('true');
    log('enableSideChat: set data-chat="true" on', flipped, 'element(s)');
    // Release the suppression on the next microtask so the observer ignores our own write.
    queueMicrotask(() => {
      suppressObserver = false;
    });
    // Open the reconcile-guard window: if React commits data-chat="false"
    // shortly after this enable (because the programmatic sync click didn't
    // find a button or didn't flip Kick's state), the observer below will
    // re-assert "true" instead of tearing the layout down.
    enableSyncUntil = Date.now() + 500;

    chatSlot = document.createElement('div');
    chatSlot.className = 'kfc-chat-slot';
    // Note: the chat-toggle click handler is attached at document level so it
    // catches Kick's floating "Show chat" button (rendered outside chatSlot
    // when Kick's internal state thinks chat is hidden), not just clicks
    // inside the panel.

    savedChatParent = chat.parentNode;
    savedChatNextSibling = chat.nextSibling;
    chatSlot.appendChild(chat);

    fsEl.appendChild(chatSlot);
    fsEl.classList.add('kfc-active');
    // Apply the current (per-session) chat width and layout mode, then mount
    // the draggable divider between video and chat.
    applyChatWidth();
    mountResizeHandle(fsEl);

    active = true;
    syncControlState();
    // Mark Kick's player layers in place so the CSS shrink applies without
    // moving them into a wrapper (which would break React's reconciler on
    // background refreshes and 404 the page).
    startVideoRootObserver(fsEl);
    // Adopt Kick's body-portaled popovers (emote-name tooltips, etc.) into
    // fsEl so they remain visible while in fullscreen.
    startPopoverPortal(fsEl);
    // Watch for Kick's chat error boundary fallback so the user isn't stuck
    // having to reload the page when Kick's chat subtree throws.
    startChatErrorWatcher(fsEl);
    refreshChatBar();

    const wrap = document.getElementById(WRAP_ID);
    if (wrap) fsEl.appendChild(wrap);

    enabledAt = Date.now();
    videoEl = queryPlayerVideo(fsEl);
    if (videoEl) {
      videoEl.addEventListener('emptied', onVideoEmptied);
      videoEl.addEventListener('loadstart', onVideoLoadStart);
      // Whether a click would do anything depends on playback state, so the
      // cursor has to follow it even when the pointer never moves.
      videoEl.addEventListener('play', refreshSurfaceCursor);
      videoEl.addEventListener('pause', refreshSurfaceCursor);
    }
    fsEl.addEventListener('dblclick', onFsDblClick);
    fsEl.addEventListener('click', onFsClick);
    updateBtnLabel();
    nudgePlayerResize();
  };

  const disableSideChat = (fsEl) => {
    if (!fsEl || !chatSlot) return;
    // Mark inactive immediately so re-entrant teardown attempts (e.g. popstate firing
    // while we're already cleaning up) short-circuit out.
    active = false;
    stopChatErrorWatcher();
    unbindChatBar();
    stopVideoRootObserver();
    stopPopoverPortal();
    if (videoEl) {
      videoEl.removeEventListener('emptied', onVideoEmptied);
      videoEl.removeEventListener('loadstart', onVideoLoadStart);
      videoEl.removeEventListener('play', refreshSurfaceCursor);
      videoEl.removeEventListener('pause', refreshSurfaceCursor);
      videoEl = null;
    }
    fsEl.removeEventListener('dblclick', onFsDblClick);
    fsEl.removeEventListener('click', onFsClick);
    resetSurfaceCursor();

    // Put chat back where it came from.
    const chat = chatSlot.firstChild;
    if (chat && savedChatParent) {
      if (savedChatNextSibling && savedChatNextSibling.parentNode === savedChatParent) {
        savedChatParent.insertBefore(chat, savedChatNextSibling);
      } else {
        savedChatParent.appendChild(chat);
      }
    }

    fsEl.classList.remove('kfc-active');
    removeResizeHandle();
    chatSlot.remove();
    chatSlot = null;
    savedChatParent = null;
    savedChatNextSibling = null;
    // active is already false above; reset the control cluster + video-width
    // override accordingly (clears kfc-chat-open, --kfc-video-width).
    syncControlState();

    // If we're still in fullscreen after the teardown (i.e. this wasn't an
    // exit-fullscreen teardown), re-arm the monitor so it picks up any new
    // <video> element Kick mounts. Callers that know a reload is imminent
    // (quality change, seek, go-live) set videoReloading=true *before*
    // calling here so the button stays disabled across the gap until the
    // monitor's loadstart/canplay events take over.
    const stillFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (stillFs === fsEl) {
      startVideoLoadingMonitor(fsEl);
    }

    updateBtnLabel();

    // Re-attach the toggle button wrapper to the fullscreen element so it stays visible.
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) fsEl.appendChild(wrap);

    nudgePlayerResize();
  };

  // Kick's player computes video dimensions from window size, not from its parent.
  // After we swap layouts we need to convince it to re-measure. A single resize on
  // the same tick often misses, so we fire on the next frame and once more shortly
  // after for good measure.
  const nudgePlayerResize = () => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    fire();
    requestAnimationFrame(fire);
    setTimeout(fire, 150);
  };

  const updateBtnLabel = () => {
    // Per-button visibility (Chat vs. layout-mode toggle) is handled in CSS via
    // .kfc-active scoping so the wrap stays visible to host the other controls.
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const label = btn.querySelector('span');
    const t = uiText();
    if (label) label.textContent = t.chat;

    // Check video loading state to set correct disabled state and aria-label
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      const video = queryPlayerVideo(fs);
      const isLoaded = !videoReloading && video && video.readyState >= 2;
      btn.disabled = !isLoaded;
      btn.setAttribute('aria-label', active ? t.hideChat : isLoaded ? t.showChat : t.loadingVideo);
    } else {
      btn.setAttribute('aria-label', t.showChat);
    }
  };

  // Events that may change whether the button should be enabled. `loadstart`/
  // `emptied` are reload triggers (handled by onVideoBuffering, which also
  // raises videoReloading). The rest are benign state changes (buffering during
  // playback, seeking, etc.) where we just want updateBtnLabel to reflect the
  // current readyState without touching the reload flag.
  const VIDEO_STATE_EVENTS = ['waiting', 'stalled', 'seeking', 'seeked', 'playing', 'pause'];

  const detachVideoListeners = () => {
    if (fullscreenVideoEl) {
      if (onVideoLoaded) {
        fullscreenVideoEl.removeEventListener('loadeddata', onVideoLoaded);
        fullscreenVideoEl.removeEventListener('canplay', onVideoLoaded);
      }
      if (onVideoBuffering) {
        fullscreenVideoEl.removeEventListener('loadstart', onVideoBuffering);
        fullscreenVideoEl.removeEventListener('emptied', onVideoBuffering);
      }
      if (onVideoStateChange) {
        VIDEO_STATE_EVENTS.forEach((evt) =>
          fullscreenVideoEl.removeEventListener(evt, onVideoStateChange)
        );
      }
    }
    fullscreenVideoEl = null;
    onVideoLoaded = null;
    onVideoBuffering = null;
    onVideoStateChange = null;
  };

  const attachVideoListeners = (video) => {
    fullscreenVideoEl = video;
    onVideoLoaded = () => {
      // Don't clear the flag immediately — schedule it. A `loadstart`/`emptied`
      // that fires during the grace window will cancel the timer and keep the
      // button disabled until the next stable canplay.
      clearVideoReadyTimer();
      log('video reported ready, deferring button re-enable by', VIDEO_READY_GRACE_MS, 'ms');
      videoReadyTimer = setTimeout(() => {
        videoReadyTimer = 0;
        // Re-check that the video is still actually loaded — Kick may have
        // started another reload during the grace window without us seeing a
        // loadstart (e.g. element swap).
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fs) return;
        const current = fullscreenVideoEl;
        if (!current || current.readyState < 2) {
          log('grace expired but video no longer ready, keeping button disabled');
          return;
        }
        videoReloading = false;
        updateBtnLabel();
        log('grace expired, button enabled');
      }, VIDEO_READY_GRACE_MS);
    };
    // loadstart/emptied also fire when Kick remounts/reloads the player, so
    // catch them here too — re-enabling the button only happens once we hear
    // canplay/loadeddata again and the grace timer elapses.
    onVideoBuffering = () => {
      // A real reload is underway — let the canplay/loadeddata + grace path
      // take over and stop the capture-phase safety net.
      clearReloadSafetyTimer();
      clearVideoReadyTimer();
      videoReloading = true;
      updateBtnLabel();
      log('video buffering/reloading, button disabled');
    };
    // updateBtnLabel reads video.readyState directly, so re-running it on every
    // playback state change keeps the Chat button disabled whenever the video
    // is loading/buffering — without needing the videoReloading flag for the
    // benign cases.
    onVideoStateChange = () => {
      updateBtnLabel();
    };
    video.addEventListener('loadeddata', onVideoLoaded);
    video.addEventListener('canplay', onVideoLoaded);
    video.addEventListener('loadstart', onVideoBuffering);
    video.addEventListener('emptied', onVideoBuffering);
    VIDEO_STATE_EVENTS.forEach((evt) => video.addEventListener(evt, onVideoStateChange));
  };

  const startVideoLoadingMonitor = (fsEl) => {
    // Remember which element we were on *before* the detach. Re-attaching
    // to the same element should NOT synthesize a synthetic onVideoLoaded —
    // the readyState we'd be reading is stale (the player is mid-reload),
    // and triggering the grace timer here would re-enable the button before
    // Kick has actually swapped to the new video. We only synthesize when
    // we land on a genuinely different element.
    const previousVideo = fullscreenVideoEl;
    detachVideoListeners();
    if (videoSwapObserver) {
      videoSwapObserver.disconnect();
      videoSwapObserver = null;
    }

    const tryAttach = () => {
      const video = queryPlayerVideo(fsEl);
      if (!video) return false;
      if (video === fullscreenVideoEl) return true;
      detachVideoListeners();
      attachVideoListeners(video);
      // Synthesize the grace-delayed clear only when we attached to a
      // genuinely different <video> element than the previous one — this
      // covers the case where Kick swapped the element fast enough that the
      // new one is already past readyState 2 by the time the
      // MutationObserver wakes. For same-element re-attach (e.g. the initial
      // call inside disableSideChat right after a quality click), we wait
      // for the real loadstart → loadeddata/canplay sequence instead.
      if (video !== previousVideo && videoReloading && video.readyState >= 2 && onVideoLoaded) {
        onVideoLoaded();
      }
      updateBtnLabel();
      log('video monitor attached, readyState=', video.readyState, 'newElement=', video !== previousVideo);
      return true;
    };

    tryAttach();

    // Kick may replace the <video> element entirely on quality change or DVR
    // exit — re-attach listeners whenever the player subtree changes. Skip
    // mutations whose target is inside our chat slot: chat-message churn
    // would otherwise fire this callback hundreds of times per minute during
    // busy streams, each running a fresh querySelector('video') on the
    // whole fsEl subtree. Same filter trick videoRootObserver uses.
    videoSwapObserver = new MutationObserver((mutations) => {
      if (chatSlot && mutations.every((m) => chatSlot.contains(m.target))) return;
      const currentVideo = queryPlayerVideo(fsEl);
      if (!currentVideo) return;
      if (currentVideo !== fullscreenVideoEl) {
        log('video element swapped, re-attaching monitor');
        tryAttach();
      }
    });
    videoSwapObserver.observe(fsEl, { childList: true, subtree: true });
  };

  const stopVideoLoadingMonitor = () => {
    clearVideoReadyTimer();
    clearReloadSafetyTimer();
    detachVideoListeners();
    if (videoSwapObserver) {
      videoSwapObserver.disconnect();
      videoSwapObserver = null;
    }
    videoReloading = false;
  };

  // Kick renders small popovers (emote-name tooltips, etc.) by appending them
  // to document.body. The Fullscreen API only displays descendants of the
  // fullscreen element, so once the player is fullscreen, hovering an emote
  // inside the side chat shows no tooltip even though Kick is rendering one.
  //
  // We *clone* these popovers into fsEl rather than moving them. Moving them
  // (the obvious approach) breaks React's reconciliation: Kick uses
  // createPortal with body as the container, and React's unmount path calls
  // body.removeChild(popover) on cleanup. If the popover has been moved into
  // fsEl, removeChild throws NotFoundError, Kick's error boundary catches it,
  // and the page navigates to its 404 / "We are sorry, something went wrong"
  // page (with the moved popover left stranded on top of the 404).
  //
  // Cloning side-steps that. The original stays in body where React expects
  // it (and is unmounted normally — invisibly to the user, since the
  // Fullscreen API hides it). The clone in fsEl is what the user actually
  // sees. We track original→clone in a Map, and remove the clone when the
  // original is removed from body. Styling carries over because the clone
  // keeps the original's class names and inline styles — global Kick /
  // Tailwind rules match the clone the same way they match the original.
  // Position is preserved because Floating UI / Radix write
  // viewport-relative `position: fixed` inline styles, which render the
  // clone in the same screen location as the (hidden) original.
  //
  // A per-popover sync observer (`popoverSyncObservers`) re-clones when the
  // original's subtree changes (childList / characterData). React often
  // mounts the popover wrapper first and writes the tooltip content into
  // it on a later commit; without sync, the initial clone would be the
  // empty wrapper and the user would see nothing. We also take a couple of
  // delayed one-shot re-clones after adoption to catch tooltip wrappers
  // whose final `style` / `data-state` lands via attribute-only updates,
  // without observing animation attributes forever.
  //
  // The design system rule "no tooltips, no menus, no popovers" applies to
  // UI we paint ourselves, not to making Kick's existing popovers visible.
  const POPOVER_SELECTORS = [
    '[role="tooltip"]',
    '[data-radix-popper-content-wrapper]',
    '[data-radix-portal]',
    '[data-floating-ui-portal]',
    '[data-popper-placement]',
  ];
  const POPOVER_SELECTOR_STR = POPOVER_SELECTORS.join(',');
  const POPOVER_CLONE_ATTR = 'data-kfc-popover-clone';

  const isPopoverHost = (el) =>
    el instanceof Element &&
    (el.matches?.(POPOVER_SELECTOR_STR) || !!el.querySelector?.(POPOVER_SELECTOR_STR));

  let popoverPortalObserver = null;
  let popoverPortalHost = null;
  const popoverClones = new Map(); // original Element -> clone Element
  const popoverSyncObservers = new Map(); // original Element -> MutationObserver

  const removePopoverClone = (original) => {
    const clone = popoverClones.get(original);
    if (clone) {
      try {
        clone.remove();
      } catch (err) {
        log('remove popover clone failed:', err);
      }
      popoverClones.delete(original);
    }
    const syncObserver = popoverSyncObservers.get(original);
    if (syncObserver) {
      syncObserver.disconnect();
      popoverSyncObservers.delete(original);
    }
  };

  const adoptPopover = (node, fsEl) => {
    if (!(node instanceof Element)) return;
    if (fsEl.contains(node) || isKfcOwnedChild(node)) return;
    if (node.hasAttribute?.(POPOVER_CLONE_ATTR)) return;
    if (!isPopoverHost(node)) return;
    if (popoverClones.has(node)) return;
    // With subtree:true on the body observer we can see popovers added at
    // any depth, so check whether one of our existing adopted originals
    // already contains this node — if so, the sync observer on that
    // adopted ancestor will already track the new content.
    for (const adopted of popoverClones.keys()) {
      if (adopted.contains?.(node)) return;
    }

    // React mounts the popover wrapper first and writes the tooltip content
    // into it on a later commit. A single clone taken at adoption time
    // therefore captures an empty wrapper and the user sees nothing.
    // Re-clone the original on subtree mutations (childList / characterData)
    // so the clone tracks the original. Attribute mutations are not observed
    // continuously because Radix/Floating UI flip `data-state` / inline
    // `style` on animation ticks; delayed one-shot re-clones below catch
    // the settled visible/positioned state without permanent churn.
    let pendingReclone = false;
    const performReclone = () => {
      pendingReclone = false;
      if (!popoverClones.has(node) && popoverSyncObservers.get(node) == null) return; // disposed
      if (!document.body.contains(node)) return; // original already gone
      try {
        const newClone = node.cloneNode(true);
        newClone.setAttribute(POPOVER_CLONE_ATTR, '');
        const existing = popoverClones.get(node);
        if (existing && existing.parentNode) {
          existing.replaceWith(newClone);
        } else {
          fsEl.appendChild(newClone);
        }
        popoverClones.set(node, newClone);
      } catch (err) {
        log('reclone popover failed:', err);
      }
    };
    const scheduleReclone = () => {
      if (pendingReclone) return;
      pendingReclone = true;
      requestAnimationFrame(performReclone);
    };

    try {
      const clone = node.cloneNode(true);
      clone.setAttribute(POPOVER_CLONE_ATTR, '');
      fsEl.appendChild(clone);
      popoverClones.set(node, clone);
    } catch (err) {
      log('clone popover failed:', err);
      return;
    }

    const syncObserver = new MutationObserver(() => scheduleReclone());
    syncObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    popoverSyncObservers.set(node, syncObserver);
    requestAnimationFrame(scheduleReclone);
    setTimeout(scheduleReclone, 50);
    setTimeout(scheduleReclone, 150);
    log('cloned popover into fsEl');
  };

  // Reconcile tracked originals when something is removed from body. The
  // direct match handles the common case (Kick removes the popover wrapper
  // itself). The contains() scan handles the rarer case where a removed
  // ancestor took our tracked popover with it. The final `document.body.contains`
  // sweep covers anything we missed (e.g. removals deeper than the direct
  // children we observe).
  const reconcilePopoverClones = (removedNode) => {
    if (removedNode instanceof Element && popoverClones.has(removedNode)) {
      removePopoverClone(removedNode);
    }
    const toRemove = [];
    popoverClones.forEach((_clone, original) => {
      if (
        (removedNode instanceof Element && removedNode.contains?.(original)) ||
        !document.body.contains(original)
      ) {
        toRemove.push(original);
      }
    });
    toRemove.forEach((o) => removePopoverClone(o));
  };

  const startPopoverPortal = (fsEl) => {
    stopPopoverPortal();
    popoverPortalHost = fsEl;
    // Adopt any popovers that are already on screen when we activate. Scan
    // the whole body subtree so we catch popovers Kick already mounted into
    // nested portal containers before we started observing.
    document.body.querySelectorAll(POPOVER_SELECTOR_STR).forEach((el) => {
      if (!fsEl.contains(el)) adoptPopover(el, fsEl);
    });
    popoverPortalObserver = new MutationObserver((muts) => {
      if (popoverPortalHost !== fsEl) return;
      for (const m of muts) {
        m.addedNodes.forEach((n) => adoptPopover(n, fsEl));
        m.removedNodes.forEach((n) => reconcilePopoverClones(n));
      }
    });
    // subtree:true so we catch popovers Kick mounts into nested portal
    // containers (not all React apps portal directly to body — some
    // userscripts and Kick chrome may add intermediate containers).
    popoverPortalObserver.observe(document.body, { childList: true, subtree: true });
  };

  const stopPopoverPortal = () => {
    if (popoverPortalObserver) {
      popoverPortalObserver.disconnect();
      popoverPortalObserver = null;
    }
    popoverSyncObservers.forEach((observer) => observer.disconnect());
    popoverSyncObservers.clear();
    popoverClones.forEach((clone) => {
      try {
        clone.remove();
      } catch (err) {
        log('teardown remove popover clone failed:', err);
      }
    });
    popoverClones.clear();
    popoverPortalHost = null;
  };

  // First match for `selector` that isn't one of our own nodes. The info
  // overlay's clone lives inside the player, ahead of Kick's originals in
  // document order, and keeps their attributes — so a plain querySelector
  // re-finding a source after Kick re-mounts it returns the clone. Sourcing
  // from the clone re-clones it every frame: each reclone detaches the
  // tracked "source", which triggers another refind.
  const queryKickNode = (selector) => {
    for (const el of document.querySelectorAll(selector)) {
      if (!isKfcOwnedNode(el)) return el;
    }
    return null;
  };

  // Widen a found card to the parent it shares with Kick's action column.
  const withActionColumn = (card, player) => {
    const parent = card.parentElement;
    if (!parent || parent === document.body) return card;
    if (player && parent.contains(player)) return card;
    if (!parent.querySelector(INFO_ACTION_SELECTORS)) return card;
    if (parent.getBoundingClientRect().height >= window.innerHeight * 0.7) return card;
    return parent;
  };

  // Twitch-style streamer info overlay. We *clone* Kick's existing channel-info
  // card into fsEl rather than moving it, for the same reason as popovers:
  // Kick's React reconciler may unmount or replace the card in the background,
  // and a moved node would no longer be where React expects it. Cloning keeps
  // the original in its normal DOM location while the user sees a copy
  // overlaid on the fullscreen player. The clone inherits Kick's class names
  // and global Tailwind styling so it renders with Kick's avatar / verified
  // badge / emote / viewer-count formatting. A debounced MutationObserver
  // re-clones when the source's content changes (title edit, viewer count
  // tick, etc.), so the overlay stays in sync.
  const findStreamerInfoSource = () => {
    // 1. Try known direct selectors first.
    for (const s of STREAMER_INFO_SELECTORS) {
      try {
        const el = queryKickNode(s);
        if (el) return el;
      } catch (err) {
        // Selector syntax error in a fallback shouldn't break the rest.
      }
    }
    const player = document.querySelector(
      '#injected-channel-player, [data-testid="player"]'
    );
    const pathSegments = (window.location.pathname || '')
      .split('/')
      .filter(Boolean);
    const usernameSlug =
      pathSegments[0] && !pathSegments[0].includes('.') ? pathSegments[0] : null;
    // Kick renders the card twice — a mobile copy and a desktop copy, one of
    // them `display: none` — and the hidden one comes first. A walk from a
    // hidden anchor finds no box until it reaches the column holding both
    // copies and the channel's About section, so anchors must be rendered.
    const isRendered = (el) => el.getClientRects().length > 0;
    // 2. Avatar-anchored search (primary). The avatar is the most distinct
    //    element of the streamer card: Kick tags it
    //    `img[data-testid="channel-avatar"]` (formerly `img#channel-avatar`)
    //    inside a plain button, and older layouts wrapped it in a link back
    //    to the streamer's own profile — `a[href="/${username}"]`. Walk up
    //    from it until we hit an ancestor that also contains a category
    //    link (the game) and meets reasonable card dimensions. This finds
    //    the FULL card (avatar + name + title + game + tags) instead of a
    //    sub-row the category-link walk below can land on — any `<img>`
    //    beside the name (an emote, the gifted-subs leaderboard icon)
    //    satisfies its image check one level short of the avatar.
    //    The tagged avatar goes first: querySelectorAll returns document
    //    order, and the sidebar's recommended channels wrap their avatars in
    //    the same profile links.
    const avatars = [...document.querySelectorAll(
      'img[data-testid="channel-avatar"], img#channel-avatar'
    )];
    if (usernameSlug) {
      const slug = CSS.escape(usernameSlug);
      avatars.push(...document.querySelectorAll(
        `a[href="/${slug}" i] img, a[href="/${slug}/" i] img, ` +
        `a[href="/${slug}" i] picture, a[href="/${slug}/" i] picture`
      ));
    }
    for (const avatar of avatars) {
      if (isKfcOwnedNode(avatar) || !isRendered(avatar)) continue;
      let node = avatar.parentElement;
      for (let i = 0; i < 12 && node && node !== document.body; i++) {
        if (player && node.contains(player)) break;
        const rect = node.getBoundingClientRect();
        if (
          rect.width > 200 &&
          rect.height > 60 &&
          rect.height < window.innerHeight * 0.7 &&
          node.querySelector('a[href*="/categories/"], a[href*="/category/"]')
        ) {
          return withActionColumn(node, player);
        }
        node = node.parentElement;
      }
    }
    // 3. Category-link walk fallback. Used when no avatar anchor is found
    //    (no tagged avatar, and the URL slug doesn't match a rendered
    //    profile link).
    //    Requires h1/h2/h3 OR profile link + an avatar img + reasonable
    //    dimensions.
    const profileLinkSelector = usernameSlug
      ? `a[href="/${CSS.escape(usernameSlug)}" i], a[href="/${CSS.escape(usernameSlug)}/" i]`
      : null;
    const hasStreamerNameSignal = (el) => {
      if (el.querySelector('h1, h2, h3')) return true;
      if (profileLinkSelector && el.querySelector(profileLinkSelector)) return true;
      return false;
    };
    const categoryLinks = document.querySelectorAll(
      'a[href*="/categories/"], a[href*="/category/"]'
    );
    for (const link of categoryLinks) {
      if (isKfcOwnedNode(link) || !isRendered(link)) continue;
      let node = link.parentElement;
      for (let i = 0; i < 12 && node && node !== document.body; i++) {
        if (player && node.contains(player)) break;
        const rect = node.getBoundingClientRect();
        if (
          rect.width > 200 &&
          rect.height > 80 &&
          rect.height < window.innerHeight * 0.7 &&
          node.querySelector('img, picture, [class*="avatar" i]') &&
          hasStreamerNameSignal(node)
        ) {
          return withActionColumn(node, player);
        }
        node = node.parentElement;
      }
    }
    return null;
  };

  // Viewer-count badge on Kick (e.g., "770 Viewers" with a small people
  // icon). Kick renders this outside the compact streamer card we clone for
  // the avatar / name / title, so it has to be found and cloned separately,
  // then appended to the overlay as a sibling of the streamer-card clone.
  const findViewerCountSource = () => {
    // Direct selectors first.
    for (const s of VIEWER_COUNT_SELECTORS) {
      try {
        const el = queryKickNode(s);
        if (el) return el;
      } catch (err) {}
    }
    // Content-based fallback. Find the smallest element whose textContent
    // matches the viewer-count pattern. Constrain by length so we only
    // capture the badge (number + label) and not a larger ancestor that
    // happens to enclose it.
    const candidates = document.querySelectorAll('div, span, p, a, button');
    let best = null;
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      if (text.length === 0 || text.length > 30) continue;
      if (!VIEWER_COUNT_RE.test(text)) continue;
      if (isKfcOwnedNode(el)) continue;
      if (
        !best ||
        text.length < (best.textContent || '').trim().length
      ) {
        best = el;
      }
    }
    return best;
  };

  // Post-process the cloned streamer card before mounting it in the overlay.
  // Two changes from Kick's source layout:
  //  - Hide the tag pills around the category link (e.g., `Czech`, `irl`,
  //    `czech`, `vanlife`). The category itself (the green link) stays.
  //  - Inline the viewer-count badge right after the category link, with
  //    a CSS-drawn circle separator, so the bottom row reads "IRL • 682"
  //    instead of having a separate viewer-count row below.
  // Heuristic: walk the category link's parent element and hide siblings
  // that look like tag pills (short text, no images or headings). The
  // viewer-count source is cloned in place (preserving Kick's animated
  // digit component) and added as a sibling of the category link.
  const styleViewerCountClone = (viewerClone) => {
    for (const node of [viewerClone, ...viewerClone.querySelectorAll('*')]) {
      node.style.setProperty('background', 'transparent', 'important');
      node.style.setProperty('background-color', 'transparent', 'important');
      node.style.setProperty('border-color', 'transparent', 'important');
      node.style.setProperty('box-shadow', 'none', 'important');
      node.style.setProperty('text-shadow', 'none', 'important');
      if (node instanceof SVGElement) {
        node.style.setProperty('fill', '#fff', 'important');
        node.style.setProperty('stroke', '#fff', 'important');
      }
      if (node.matches?.('[class~="text-primary-base"]')) {
        node.style.setProperty('color', VIEWER_COUNT_COLOR, 'important');
      }
      if (node.matches?.('[class~="text-subtle"]')) {
        node.style.setProperty('color', '#fff', 'important');
      }
    }
  };

  const normalizePath = (href) => {
    try {
      return new URL(href, window.location.origin).pathname.replace(/\/$/, '');
    } catch (err) {
      return '';
    }
  };

  const findNativeCategoryTarget = (href) => {
    const wantedPath = normalizePath(href);
    if (!infoOverlaySource || !wantedPath) return null;
    for (const link of infoOverlaySource.querySelectorAll('a[href]')) {
      if (normalizePath(link.getAttribute('href')) === wantedPath) return link;
    }
    return infoOverlaySource.querySelector(
      'a[href*="/categories/" i], a[href*="/category/" i]'
    );
  };

  const findNativeProfileTarget = () => {
    if (!infoOverlaySource) return null;
    const profilePath = getCurrentChannelPath();
    if (!profilePath) return null;
    for (const link of infoOverlaySource.querySelectorAll('a[href]')) {
      if (normalizePath(link.getAttribute('href')) === profilePath) return link;
    }
    const nameOrAvatar = infoOverlaySource.querySelector(
      'h1, h2, h3, [class*="username" i], [class*="streamer-name" i], [class*="channel-name" i], img, picture, [class*="avatar" i]'
    );
    return nameOrAvatar?.closest('button, a[href]') || null;
  };

  const makeProfileAffordancesClickable = (cardClone) => {
    const profilePath = getCurrentChannelPath();
    if (!profilePath) return;
    const profileUrl = new URL(profilePath, window.location.origin).href;
    const navigate = (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      if (!overlayAcceptsActivation(event)) return;
      clickNativeOrNavigate(findNativeProfileTarget(), profileUrl);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!overlayAcceptsActivation(event)) return;
      clickNativeOrNavigate(findNativeProfileTarget(), profileUrl);
    };

    const candidates = new Set([
      ...cardClone.querySelectorAll(
        'h1, h2, h3, [class*="username" i], [class*="streamer-name" i], [class*="channel-name" i]'
      ),
    ]);
    const avatar = cardClone.querySelector('img, picture, [class*="avatar" i]');
    if (avatar) candidates.add(avatar);
    for (const candidate of candidates) {
      const anchor = candidate.closest('a[href]');
      if (anchor) {
        wireOverlayNavigation(
          anchor,
          findNativeProfileTarget,
          new URL(anchor.getAttribute('href'), window.location.origin).href
        );
        continue;
      }
      const target = candidate.closest('button') || candidate;
      target.dataset.kfcNavWired = 'true';
      target.setAttribute('role', 'link');
      target.setAttribute('tabindex', '0');
      target.style.setProperty('cursor', 'pointer', 'important');
      target.addEventListener('click', navigate);
      target.addEventListener('keydown', onKeyDown);
    }
  };

  // Kick's tag pills ("Czech", "18+"): short text, no icon, image or heading.
  // They do nothing when clicked on Kick's page, so the clones aren't wired.
  const looksLikeTagPill = (el) => {
    if (el.querySelector('img, picture, svg, h1, h2, h3')) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0 && text.length <= 30;
  };

  const transformClonedCard = (cardClone, source) => {
    overlayTwins = new Map();
    // Pair cloned buttons with their originals while the two trees still
    // match node for node — before anything below adds or removes nodes.
    const sourceNodes = [source, ...source.querySelectorAll('*')];
    const buttonTwins = [];
    let viewerTwin = null;
    [cardClone, ...cardClone.querySelectorAll('*')].forEach((node, i) => {
      if (node.tagName === 'BUTTON') buttonTwins.push([node, sourceNodes[i]]);
      if (sourceNodes[i] === infoViewerSource) viewerTwin = node;
    });
    // The action column carries Kick's own viewer count; the overlay shows
    // it inline after the category instead (below).
    viewerTwin?.remove();
    // The clone sits inside the player, ahead of Kick's card in document
    // order, so a copied id (`#channel-avatar`, `#channel-username`) would
    // answer Kick's own getElementById lookups. SVG ids stay: the verified
    // badge fills from a `url(#…)` gradient defined inside it.
    for (const el of [cardClone, ...cardClone.querySelectorAll('[id]')]) {
      if (!(el instanceof SVGElement)) el.removeAttribute('id');
    }
    makeProfileAffordancesClickable(cardClone);
    const actionColumn = Array.from(cardClone.children).find((child) =>
      child.querySelector(INFO_ACTION_SELECTORS)
    );
    if (actionColumn) {
      cardClone.classList.add('kfc-info-stacked');
      actionColumn.classList.add('kfc-info-actions');
    }
    // Hide chevron / dropdown indicator buttons: a button containing only
    // an svg with no visible text or image. Kick puts one of these next
    // to the title to open an "expand title / description" popover; the
    // overlay already shows two lines of title, so it adds nothing.
    // Verified-badge buttons (which have aria-label "verified"),
    // avatar-wrapping buttons (which contain an img) and Kick's icon-only
    // action buttons (share, report) are exempted.
    for (const btn of cardClone.querySelectorAll('button')) {
      if (actionColumn?.contains(btn)) continue;
      if (btn.querySelector('img, picture')) continue;
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('verified')) continue;
      if ((btn.textContent || '').trim().length > 0) continue;
      if (!btn.querySelector('svg')) continue;
      btn.style.display = 'none';
    }
    for (const [btn, native] of buttonTwins) {
      if (!cardClone.contains(btn) || btn.style.display === 'none') continue;
      if (looksLikeTagPill(btn)) continue;
      wireOverlayAction(btn, native);
    }
    const categoryLink = cardClone.querySelector(
      'a[href*="/categories/" i], a[href*="/category/" i]'
    );
    if (!categoryLink) return;
    const categoryHref = categoryLink.getAttribute('href');
    wireOverlayNavigation(
      categoryLink,
      () => findNativeCategoryTarget(categoryHref),
      new URL(categoryHref, window.location.origin).href
    );
    categoryLink.classList.add('kfc-info-category-inline');
    for (const node of [categoryLink, ...categoryLink.querySelectorAll('*')]) {
      node.style.setProperty('background', 'transparent', 'important');
      node.style.setProperty('background-color', 'transparent', 'important');
      node.style.setProperty('box-shadow', 'none', 'important');
      node.style.setProperty('text-shadow', 'none', 'important');
    }
    // Kick's tag pills follow the category; marked so the settings can hide them.
    let lastTag = categoryLink;
    while (lastTag.nextElementSibling && looksLikeTagPill(lastTag.nextElementSibling)) {
      lastTag = lastTag.nextElementSibling;
      lastTag.classList.add('kfc-info-tag');
    }
    if (infoViewerSource && document.body.contains(infoViewerSource)) {
      const viewerClone = infoViewerSource.cloneNode(true);
      viewerClone.classList.add('kfc-info-viewer-inline');
      styleViewerCountClone(viewerClone);
      const separator = document.createElement('span');
      separator.className = 'kfc-info-separator';
      separator.setAttribute('aria-hidden', 'true');
      // After the tags, so the row reads "IRL  Czech  18+ • 682 viewers".
      lastTag.after(separator, viewerClone);
    }
  };

  const recloneInfoOverlay = () => {
    infoOverlayPending = false;
    if (!infoOverlay || !infoOverlaySource) return;
    if (!document.body.contains(infoOverlaySource)) return;
    try {
      const cardClone = infoOverlaySource.cloneNode(true);
      transformClonedCard(cardClone, infoOverlaySource);
      infoOverlay.replaceChildren(cardClone);
      placeAllPopups();
    } catch (err) {
      log('reclone info overlay failed:', err);
    }
  };

  const syncViewerCloneAttributes = () => {
    infoViewerAttrSyncPending = false;
    if (!infoOverlay || !infoViewerSource || !document.body.contains(infoViewerSource)) return;
    const viewerClone = infoOverlay.querySelector('.kfc-info-viewer-inline');
    if (!viewerClone) return;
    const sourceNodes = [infoViewerSource, ...infoViewerSource.querySelectorAll('*')];
    const cloneNodes = [viewerClone, ...viewerClone.querySelectorAll('*')];
    const total = Math.min(sourceNodes.length, cloneNodes.length);
    for (let i = 0; i < total; i++) {
      const source = sourceNodes[i];
      const clone = cloneNodes[i];
      const sourceStyle = source.getAttribute('style');
      if (sourceStyle == null) clone.removeAttribute('style');
      else clone.setAttribute('style', sourceStyle);
      if (i > 0) {
        const sourceClass = source.getAttribute('class');
        if (sourceClass == null) clone.removeAttribute('class');
        else clone.setAttribute('class', sourceClass);
      }
    }
    styleViewerCountClone(viewerClone);
  };

  const scheduleViewerAttrSync = () => {
    if (infoViewerAttrSyncPending) return;
    infoViewerAttrSyncPending = true;
    requestAnimationFrame(syncViewerCloneAttributes);
  };

  const onViewerSourceMutation = (mutations) => {
    if (mutations.some((mutation) => mutation.type === 'attributes')) {
      scheduleViewerAttrSync();
    }
    if (mutations.some((mutation) => mutation.type !== 'attributes')) {
      scheduleInfoReclone();
    }
  };

  const scheduleInfoReclone = () => {
    if (infoOverlayPending) return;
    infoOverlayPending = true;
    requestAnimationFrame(recloneInfoOverlay);
  };

  // Kick may re-mount the channel-info card or the viewer-count badge while
  // we're in fullscreen (SPA channel navigation, React reconciler swaps,
  // etc.). When that happens, our observers are stuck on the orphaned
  // original and the overlay would freeze on stale data. A body-level
  // observer watches for our tracked sources detaching and, when one does,
  // re-runs the relevant finder and re-attaches its sync observer. The
  // viewer source is only refound if we had one originally — if no viewer
  // badge was present at mount time, we don't keep searching (cheap-out).
  const refindInfoSources = () => {
    if (!infoOverlay) return;
    let changed = false;
    if (
      infoOverlaySource &&
      !document.body.contains(infoOverlaySource)
    ) {
      const newSource = findStreamerInfoSource();
      if (newSource && newSource !== infoOverlaySource) {
        if (infoOverlayObserver) infoOverlayObserver.disconnect();
        infoOverlaySource = newSource;
        infoOverlayObserver = new MutationObserver(scheduleInfoReclone);
        infoOverlayObserver.observe(newSource, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        log('refindInfoSources: re-attached to streamer source');
        changed = true;
      } else if (!newSource) {
        if (infoOverlayObserver) infoOverlayObserver.disconnect();
        infoOverlayObserver = null;
        infoOverlaySource = null;
        log('refindInfoSources: streamer source lost, no replacement');
        changed = true;
      }
    }
    if (
      infoViewerSource &&
      !document.body.contains(infoViewerSource)
    ) {
      const newViewer = findViewerCountSource();
      if (newViewer && newViewer !== infoViewerSource) {
        if (infoViewerObserver) infoViewerObserver.disconnect();
        infoViewerSource = newViewer;
        infoViewerObserver = new MutationObserver(onViewerSourceMutation);
        infoViewerObserver.observe(newViewer, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
        log('refindInfoSources: re-attached to viewer source');
        changed = true;
      } else if (!newViewer) {
        if (infoViewerObserver) infoViewerObserver.disconnect();
        infoViewerObserver = null;
        infoViewerSource = null;
        log('refindInfoSources: viewer source lost, no replacement');
        changed = true;
      }
    }
    if (changed) scheduleInfoReclone();
  };

  let infoBodyObserver = null;
  let infoBodyCheckPending = false;
  const startInfoSourceWatcher = () => {
    stopInfoSourceWatcher();
    infoBodyObserver = new MutationObserver(() => {
      if (infoBodyCheckPending) return;
      infoBodyCheckPending = true;
      requestAnimationFrame(() => {
        infoBodyCheckPending = false;
        if (!infoOverlay) return;
        const sourceLost =
          infoOverlaySource && !document.body.contains(infoOverlaySource);
        const viewerLost =
          infoViewerSource && !document.body.contains(infoViewerSource);
        if (sourceLost || viewerLost) refindInfoSources();
      });
    });
    infoBodyObserver.observe(document.body, { childList: true, subtree: true });
  };
  const stopInfoSourceWatcher = () => {
    if (infoBodyObserver) {
      infoBodyObserver.disconnect();
      infoBodyObserver = null;
    }
    infoBodyCheckPending = false;
  };

  // The overlay's show/hide preferences live on its wrapper, not the card
  // clone — every reclone replaces the clone.
  const applyInfoOverlayPrefs = () => {
    if (!infoOverlay) return;
    infoOverlay.classList.toggle('kfc-hidden', infoHidden);
    infoOverlay.classList.toggle('kfc-info-no-actions', !infoShowActions);
    infoOverlay.classList.toggle('kfc-info-no-tags', !infoShowTags);
  };

  const mountInfoOverlay = (fsEl) => {
    unmountInfoOverlay();
    const source = findStreamerInfoSource();
    if (!source) {
      warn(
        'streamer info card not found — overlay disabled. Inspect Kick\'s channel-info element and add its selector to STREAMER_INFO_SELECTORS near the top of the userscript.'
      );
      return;
    }
    log('mountInfoOverlay: cloning source', source);

    const viewerSource = findViewerCountSource();
    if (viewerSource) {
      log('mountInfoOverlay: cloning viewer-count badge', viewerSource);
    } else {
      log('mountInfoOverlay: no viewer-count badge found');
    }

    const wrapper = document.createElement('div');
    wrapper.id = INFO_ID;
    // Set the viewer source BEFORE the initial clone+transform so
    // transformClonedCard can read it during mount, not just reclone.
    infoViewerSource = viewerSource;
    try {
      const cardClone = source.cloneNode(true);
      transformClonedCard(cardClone, source);
      wrapper.appendChild(cardClone);
    } catch (err) {
      log('initial clone failed:', err);
      infoViewerSource = null;
      return;
    }

    fsEl.appendChild(wrapper);
    infoOverlay = wrapper;
    startPopupAnchoring(fsEl);
    infoOverlaySource = source;
    // Honour the user's show/hide preferences.
    applyInfoOverlayPrefs();

    // Re-clone the source on subtree / text mutations. Attribute mutations
    // are deliberately not observed — Kick's UI uses transitions driven by
    // attribute / class changes for hover and focus states, and re-cloning
    // on each tick would restart those animations. rAF debouncing coalesces
    // a burst of mutations into a single replace per frame. Both the
    // streamer card and the viewer-count badge feed into the same reclone
    // path for subtree/text changes. The viewer badge also observes style
    // / class attributes, but those only sync into the existing badge clone
    // so Kick's rolling digits can update without replacing the whole
    // overlay or disturbing tooltip portal clones.
    infoOverlayObserver = new MutationObserver(scheduleInfoReclone);
    infoOverlayObserver.observe(source, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    if (viewerSource) {
      infoViewerObserver = new MutationObserver(onViewerSourceMutation);
      infoViewerObserver.observe(viewerSource, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
    // Catch source replacement (Kick remounting the card mid-fullscreen)
    // by watching body for detachment and refinding on the next frame.
    startInfoSourceWatcher();
  };

  const unmountInfoOverlay = () => {
    // Also closes Kick's tooltip, which would otherwise be left open on the
    // page once fullscreen exits.
    setHoveredNative(null);
    stopPopupAnchoring();
    overlayTwins = new Map();
    stopInfoSourceWatcher();
    if (infoOverlayObserver) {
      infoOverlayObserver.disconnect();
      infoOverlayObserver = null;
    }
    if (infoViewerObserver) {
      infoViewerObserver.disconnect();
      infoViewerObserver = null;
    }
    if (infoOverlay) {
      infoOverlay.remove();
      infoOverlay = null;
    }
    infoOverlaySource = null;
    infoViewerSource = null;
    infoOverlayPending = false;
    infoViewerAttrSyncPending = false;
  };

  // Drop keyboard focus after a *pointer* interaction with a settings control.
  // Same reasoning as the control buttons in ensureButton(): the panel floats
  // over the player, so a control that keeps focus swallows the keys the user
  // means for the video — Space/Enter (play/pause) re-fires the last chip or
  // switch, and the arrow keys (seek) drag a slider instead. The browser also
  // restores that focus when the window is re-activated, which is what made the
  // panel appear to change settings on its own after an app switch. Keyboard
  // activations (detail === 0) keep focus so Tab users can still operate the
  // panel. Bound on the label for switches, so clicking the row's text — which
  // reaches the checkbox as a synthetic detail-0 click — still blurs.
  const blurOnPointerActivate = (el, focusTarget = el) => {
    el.addEventListener('click', (e) => {
      if (e.detail) focusTarget.blur();
    });
  };

  const createSettingsRange = (labelText, valueText, input, valueClass = '') => {
    blurOnPointerActivate(input);
    const row = document.createElement('div');
    row.className = 'kfc-settings-row';
    const label = document.createElement('label');
    label.className = 'kfc-settings-label';
    const text = document.createElement('span');
    text.textContent = labelText;
    const value = document.createElement('span');
    if (valueClass) value.className = valueClass;
    value.textContent = valueText;
    label.appendChild(text);
    label.appendChild(value);
    row.appendChild(label);
    row.appendChild(input);
    return { row, value };
  };

  const createSettingsCheckbox = (labelText, checked, onChange, inputClass = '') => {
    const label = document.createElement('label');
    label.className = 'kfc-settings-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    if (inputClass) input.className = inputClass;
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    blurOnPointerActivate(label, input);
    const text = document.createElement('span');
    text.textContent = labelText;
    label.appendChild(input);
    label.appendChild(text);
    return label;
  };

  // Pack toggle rows into a gap-less column so their own padding is the only
  // vertical spacing (matches the quality-saver panel's .kqs-switches).
  const createSettingsSwitches = (...checks) => {
    const wrap = document.createElement('div');
    wrap.className = 'kfc-settings-switches';
    checks.forEach((check) => wrap.appendChild(check));
    return wrap;
  };

  // One inset group per topic: a small uppercase label followed by its rows.
  const createSettingsGroup = (titleText, ...children) => {
    const group = document.createElement('div');
    group.className = 'kfc-settings-group';
    const title = document.createElement('div');
    title.className = 'kfc-settings-title';
    title.textContent = titleText;
    group.appendChild(title);
    children.forEach((child) => group.appendChild(child));
    return group;
  };

  // Icon mark, name and a close button — the same header the quality-saver
  // panel uses.
  const createSettingsHeader = () => {
    const head = document.createElement('div');
    head.className = 'kfc-settings-head';

    const mark = document.createElement('div');
    mark.className = 'kfc-settings-mark';
    mark.innerHTML = BTN_SVG; // constant markup, same as the control buttons

    const titles = document.createElement('div');
    titles.className = 'kfc-settings-titles';
    const name = document.createElement('div');
    name.className = 'kfc-settings-name';
    name.textContent = 'Fullscreen Chat';
    titles.appendChild(name);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'kfc-settings-close';
    close.textContent = '✕';
    close.title = uiText().close;
    // Same reasoning as the gear's label — see syncControlState.
    close.setAttribute('aria-label', uiText().closeSettings);
    // Hiding the panel already forces focus back to the body, so this is
    // belt-and-braces — but it keeps every panel control on the same rule.
    blurOnPointerActivate(close);
    close.addEventListener('click', (e) => {
      // The other half of the flicker: this button carries a "settings" label
      // too, so a sibling script hunting for the player gear can land on it.
      if (!e.isTrusted) return;
      closeSettingsPanel();
    });

    head.appendChild(mark);
    head.appendChild(titles);
    head.appendChild(close);
    return head;
  };

  const buildSettingsPanel = () => {
    const t = uiText();
    const panel = document.createElement('div');
    panel.id = SETTINGS_PANEL_ID;
    // A non-modal dialog named like its title (0.30.2); the page stays usable
    // around it, so no aria-modal.
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Fullscreen Chat');
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    // The control buttons' refocus guard (see wireControlButton), one level
    // down: with the panel open and the cursor parked over a switch or slider,
    // the click that re-activates the window would flip that setting by itself.
    // Capture phase so the control never sees the event, and pointerdown as
    // well as click because a slider's thumb jumps on the press, not the click.
    for (const type of ['pointerdown', 'click']) {
      panel.addEventListener(type, (e) => {
        const accepted = controlsAcceptActivation({
          // A pointerdown is always the pointer; a click is only keyboard when
          // detail is 0.
          pointer: type === 'pointerdown' || !!e.detail,
          // Let the click be the one that disarms the parked-pointer guard —
          // consuming it on the press would wave the click straight through.
          consume: type === 'click',
        });
        if (accepted) return;
        e.preventDefault();
        e.stopPropagation();
      }, true);
    }

    panel.appendChild(createSettingsHeader());

    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.className = 'kfc-settings-opacity-input';
    opacityInput.min = '25';
    opacityInput.max = '90';
    opacityInput.step = '5';
    opacityInput.value = String(overlayOpacity);
    const opacityRange = createSettingsRange(
      t.overlayOpacity,
      `${overlayOpacity}%`,
      opacityInput,
      'kfc-settings-opacity-value'
    );
    opacityInput.addEventListener('input', () => {
      overlayOpacity = Number(opacityInput.value);
      opacityRange.value.textContent = `${overlayOpacity}%`;
      syncControlState();
      persistSettings();
    });

    const infoOpacityInput = document.createElement('input');
    infoOpacityInput.type = 'range';
    infoOpacityInput.className = 'kfc-settings-info-opacity-input';
    infoOpacityInput.min = '0';
    infoOpacityInput.max = '90';
    infoOpacityInput.step = '5';
    infoOpacityInput.value = String(infoBgOpacity);
    const infoOpacityRange = createSettingsRange(
      t.backdrop,
      `${infoBgOpacity}%`,
      infoOpacityInput,
      'kfc-settings-info-opacity-value'
    );
    infoOpacityInput.addEventListener('input', () => {
      infoBgOpacity = Number(infoOpacityInput.value);
      infoOpacityRange.value.textContent = `${infoBgOpacity}%`;
      syncControlState();
      persistSettings();
    });

    const idleInput = document.createElement('input');
    idleInput.type = 'range';
    idleInput.className = 'kfc-settings-idle-input';
    idleInput.min = '2';
    idleInput.max = '8';
    idleInput.step = '1';
    idleInput.value = String(Math.round(idleDelayMs / 1000));
    const idleRange = createSettingsRange(
      t.hideDelay,
      `${Math.round(idleDelayMs / 1000)}s`,
      idleInput,
      'kfc-settings-idle-value'
    );
    idleInput.addEventListener('input', () => {
      idleDelayMs = Number(idleInput.value) * 1000;
      idleRange.value.textContent = `${Math.round(idleDelayMs / 1000)}s`;
      onFsMouseMove();
      persistSettings();
    });

    const widthRow = document.createElement('div');
    widthRow.className = 'kfc-settings-row';
    const widthLabel = document.createElement('div');
    widthLabel.className = 'kfc-settings-label';
    const widthText = document.createElement('span');
    widthText.textContent = t.chatWidth;
    const widthValue = document.createElement('span');
    widthValue.className = 'kfc-settings-width-value';
    widthValue.textContent = `${chatWidth}px`;
    widthLabel.appendChild(widthText);
    widthLabel.appendChild(widthValue);
    widthRow.appendChild(widthLabel);

    const buttons = document.createElement('div');
    buttons.className = 'kfc-settings-buttons';
    [
      [t.compact, 280],
      [t.default, parseInt(CHAT_WIDTH, 10)],
      [t.wide, 520],
      [t.max, CHAT_WIDTH_MAX],
    ].forEach(([label, width]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kfc-settings-chip';
      button.dataset.kfcWidth = String(width);
      // Reflect the current (persisted) width on the matching preset right away,
      // since the panel isn't in the DOM yet for a document-scoped query.
      if (width === chatWidth) button.classList.add('kfc-selected');
      button.textContent = label;
      blurOnPointerActivate(button);
      button.addEventListener('click', () => {
        setChatWidth(width);
        widthValue.textContent = `${chatWidth}px`;
        nudgePlayerResize();
      });
      buttons.appendChild(button);
    });
    widthRow.appendChild(buttons);

    panel.appendChild(createSettingsGroup(
      t.groupChat,
      widthRow,
      createSettingsSwitches(
        createSettingsCheckbox(t.dockLeft, chatSide === 'left', (checked) => {
          chatSide = checked ? 'left' : 'right';
          syncControlState();
          nudgePlayerResize();
          persistSettings();
        }, 'kfc-settings-dock-left-input'),
        createSettingsCheckbox(t.openAsOverlay, openChatAsOverlay, (checked) => {
          openChatAsOverlay = checked;
          syncControlState();
          persistSettings();
        }, 'kfc-settings-open-overlay-input'),
        createSettingsCheckbox(t.openOnFullscreen, restoreChatOnFullscreen, (checked) => {
          restoreChatOnFullscreen = checked;
          syncControlState();
          persistSettings();
        }, 'kfc-settings-restore-input'),
        createSettingsCheckbox(t.messagesOnly, messagesOnly, (checked) => {
          messagesOnly = checked;
          syncControlState();
          updateBtnLabel();
          persistSettings();
        }, 'kfc-settings-messages-only-input'),
      ),
    ));

    panel.appendChild(createSettingsGroup(
      t.groupOverlay,
      opacityRange.row,
      createSettingsSwitches(
        createSettingsCheckbox(t.autoHideOverlay, autoHideOverlayChat, (checked) => {
          autoHideOverlayChat = checked;
          syncControlState();
          onFsMouseMove();
          persistSettings();
        }, 'kfc-settings-autohide-input'),
      ),
    ));

    panel.appendChild(createSettingsGroup(
      t.groupInfo,
      infoOpacityRange.row,
      createSettingsSwitches(
        createSettingsCheckbox(t.showActions, infoShowActions, (checked) => {
          infoShowActions = checked;
          syncControlState();
          persistSettings();
        }, 'kfc-settings-info-actions-input'),
        createSettingsCheckbox(t.showTags, infoShowTags, (checked) => {
          infoShowTags = checked;
          syncControlState();
          persistSettings();
        }, 'kfc-settings-info-tags-input'),
      ),
    ));

    panel.appendChild(createSettingsGroup(
      t.groupControls,
      idleRange.row,
      createSettingsSwitches(
        createSettingsCheckbox(t.autoHideControls, autoHideControls, (checked) => {
          autoHideControls = checked;
          syncControlState();
          onFsMouseMove();
          persistSettings();
        }, 'kfc-settings-controls-hide-input'),
      ),
    ));

    panel.appendChild(createSettingsGroup(
      t.groupAds,
      createSettingsSwitches(
        createSettingsCheckbox(t.muteAds, muteAds, (checked) => {
          muteAds = checked;
          updateAdMuteWatch();
          syncControlState();
          persistSettings();
        }, 'kfc-settings-mute-ads-input'),
      ),
    ));

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'kfc-settings-chip kfc-settings-reset';
    resetButton.textContent = t.reset;
    blurOnPointerActivate(resetButton);
    resetButton.addEventListener('click', resetSessionSettings);
    panel.appendChild(resetButton);

    return panel;
  };

  // The click that re-activates a backgrounded window or tab is delivered
  // straight into whatever sits under the parked cursor, and when that is one
  // of our controls the settings panel "randomly opens" on return. .kfc-unarmed
  // only covers the half of this where the cluster had faded away and is fading
  // back in; a switch shorter than idleDelayMs — or auto-hide turned off —
  // leaves the cluster fully shown and armed, so the fade guard has nothing to
  // gate. Swallow activations for a beat after focus is regained instead: the
  // refocus click arrives within a frame, while a deliberate click takes far
  // longer to aim. Same guard catches the reflexive Space/Enter (pause the
  // stream) on return, which fires on whichever button the browser restored
  // focus to. Mirrors kick-quality-saver's LAUNCHER_FOCUS_GUARD_MS.
  //
  // The latch is set on the way OUT, and this is the whole point: 0.21.3 armed
  // the guard from the `focus` / `visibilitychange` handlers, i.e. only once the
  // return event had actually been delivered, on the assumption that it always
  // lands just before the reactivating click. It usually does, but the focus
  // change and the mouse event reach the page through different paths, so the
  // order is not guaranteed — and on the frames where the click wins the race
  // the guard is still unarmed and the panel opens exactly as before. Hence
  // `reactivationPending`, set while the window/tab is being left, which is
  // unambiguously before any of it: from then on no activation is honoured
  // until the guard has been seen to expire, whenever the focus event turns up.
  //
  // That latch is still a *clock*, though, and a clock can only cover the case
  // where coming back and clicking are one gesture. Focus often returns on its
  // own first — Cmd-Tab, the dock icon, swiping back to the fullscreen Space,
  // or an activating click that landed on the video — and the user clicks a
  // second or two later with the pointer still parked where they left it. By
  // then the 350ms have passed and the branch below actively *allows* the
  // activation, so the parked gear takes the click. Hence the second, untimed
  // half: `pointerParked`, which asks whether the pointer has moved at all
  // since the page was left. It has no window to lose a race against — it is
  // set on the way out and cleared only by real pointer movement — and it
  // swallows one activation before disarming, so the deliberate retry works.
  const CONTROLS_FOCUS_GUARD_MS = 350;
  let reactivationPending = false;
  let focusRegainedAt = 0;
  let pointerParked = false;
  const onWindowLeft = () => {
    reactivationPending = true;
    focusRegainedAt = 0;
    // Nothing the user does in another app moves the pointer over this page, so
    // a control activation that arrives with the pointer still sitting exactly
    // where it was left was aimed at whatever the user last had here — not at
    // the button the return happened to park it on.
    pointerParked = true;
    // Don't leave one of our controls focused while the window is in the
    // background: the browser restores that focus on return, and a restored
    // button is armed for the reflexive Space/Enter meant to un-pause the
    // stream. Keyboard activations deliberately keep focus (see
    // wireControlButton), so leaving is the only safe point to drop it.
    const wrap = document.getElementById(WRAP_ID);
    const info = document.getElementById(INFO_ID);
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      (wrap?.contains(focused) || info?.contains(focused))
    ) {
      focused.blur();
    }
  };
  const onWindowReturned = () => {
    // First observation wins, so a second focus event can't extend the window.
    if (!focusRegainedAt) focusRegainedAt = Date.now();
  };
  // window blur/focus cover an app or window switch — visibilityState stays
  // 'visible' for those — and visibilitychange covers a tab switch or minimise.
  window.addEventListener('blur', onWindowLeft);
  window.addEventListener('focus', onWindowReturned);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onWindowLeft();
    else onWindowReturned();
  });
  // Any real pointer movement over the page proves the user is aiming again.
  // Capture on window so it is seen before the panel's own capture handlers,
  // and trusted-only so the keep-alive nudges (which are mousemove, not
  // pointermove, but check anyway) can't clear it. Non-mouse input clears it
  // too: a touch tap has no movement to offer, so gating it would swallow every
  // first tap after a return.
  window.addEventListener('pointermove', (e) => {
    if (pointerParked && e.isTrusted) pointerParked = false;
  }, true);
  window.addEventListener('pointerdown', (e) => {
    if (e.isTrusted && e.pointerType && e.pointerType !== 'mouse') pointerParked = false;
  }, true);
  // `pointer` — this activation came from the pointer, so the parked-pointer
  // half applies (keyboard activations are covered by dropping focus in
  // onWindowLeft). `consume` — this is the activation that would actually *do*
  // something, so disarming here is what lets the deliberate retry through; a
  // pointerdown check must not consume, or the click 50ms behind it walks in.
  const controlsAcceptActivation = ({ pointer = true, consume = true } = {}) => {
    if (pointer && pointerParked) {
      if (consume) pointerParked = false;
      log('activation ignored, pointer has not moved since the page was left');
      return false;
    }
    const now = Date.now();
    // Second source for the timed half: focus can leave for an iframe or the
    // browser's own chrome without the top-level window seeing a `blur`, so the
    // latch may never have been set. A focus regain we *did* see is enough on
    // its own to distrust an activation landing right behind it.
    if (focusRegainedAt && now - focusRegainedAt < CONTROLS_FOCUS_GUARD_MS) {
      log('activation ignored, window just regained focus');
      return false;
    }
    if (!reactivationPending) return true;
    // The return event may not have been dispatched yet; the activation itself
    // proves the window is active again, so start the guard here if nothing
    // else has. Either way this activation falls inside it and is dropped.
    if (!focusRegainedAt && document.hasFocus()) focusRegainedAt = now;
    if (focusRegainedAt && now - focusRegainedAt >= CONTROLS_FOCUS_GUARD_MS) {
      reactivationPending = false;
      return true;
    }
    log('activation ignored, window is still inside the refocus guard');
    return false;
  };

  // Wire one button of the fullscreen control cluster: swallow the click from
  // the player underneath, drop keyboard focus after pointer presses, apply the
  // focus guard, then run the action.
  const wireControlButton = (btn, onActivate) => {
    // Unconditional, and deferred a task because the focus is applied by
    // mousedown's default action, which runs after this handler. Blurring only
    // from `click` missed presses whose click never reached the button (hover
    // or pointer retargeting), leaving it focused and armed for the next
    // Space/Enter — the player would keep playing and the control would fire.
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      setTimeout(() => btn.blur(), 0);
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Only real user input may activate a control. A click dispatched by
      // script carries detail === 0, which the branch below reads as a keyboard
      // activation and waves past the parked-pointer guard — so a sibling
      // userscript clicking its way through the player's controls fires ours
      // instead (see SETTINGS_BTN_ID's aria-label for the one that did). A
      // keyboard Enter/Space produces a *trusted* click, so Tab users are
      // unaffected; nothing in this script clicks its own controls.
      if (!e.isTrusted) {
        log('activation ignored, synthetic click on', btn.id);
        return;
      }
      // Keyboard activations (detail === 0) keep focus so Tab users can still
      // operate the controls normally.
      if (e.detail) btn.blur();
      // detail === 0 is a keyboard activation: it has no pointer to have parked.
      if (!controlsAcceptActivation({ pointer: !!e.detail })) {
        log('activation ignored:', btn.id);
        return;
      }
      onActivate(e);
    });
  };

  const ensureButton = (fsEl) => {
    if (!fsEl) return;
    let wrap = document.getElementById(WRAP_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = WRAP_ID;

      // Info-overlay show/hide toggle (always available in fullscreen).
      const infoBtn = document.createElement('button');
      infoBtn.id = INFO_BTN_ID;
      infoBtn.type = 'button';
      infoBtn.className = 'kfc-control-btn';
      infoBtn.innerHTML = INFO_SVG;
      wireControlButton(infoBtn, toggleInfoOverlay);

      // Layout-mode toggle (side vs. overlay; only shown while chat is open).
      const modeBtn = document.createElement('button');
      modeBtn.id = MODE_BTN_ID;
      modeBtn.type = 'button';
      modeBtn.className = 'kfc-control-btn';
      modeBtn.innerHTML = MODE_SVG;
      wireControlButton(modeBtn, toggleOverlayMode);

      const settingsBtn = document.createElement('button');
      settingsBtn.id = SETTINGS_BTN_ID;
      settingsBtn.type = 'button';
      settingsBtn.className = 'kfc-control-btn';
      settingsBtn.innerHTML = SETTINGS_SVG;
      wireControlButton(settingsBtn, toggleSettingsPanel);

      const btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.setAttribute('dir', 'ltr');
      btn.innerHTML = `${BTN_SVG}<span></span>`;
      btn.querySelector('span').textContent = uiText().chat;
      wireControlButton(btn, () => {
        const target = document.fullscreenElement || document.webkitFullscreenElement;
        log('button clicked, fullscreen target:', target, 'active:', active);
        if (!target) return;
        try {
          if (active) disableSideChat(target);
          else enableSideChat(target);
        } catch (err) {
          log('toggle failed:', err);
        }
      });

      wrap.appendChild(infoBtn);
      wrap.appendChild(modeBtn);
      wrap.appendChild(settingsBtn);
      wrap.appendChild(btn);
      wrap.appendChild(buildSettingsPanel());
    }
    fsEl.appendChild(wrap);
    syncControlState();
    updateBtnLabel();
  };

  // Reflect the current per-session preferences onto our own nodes (the wrap,
  // chat slot, buttons, info overlay) and a documentElement CSS variable.
  // Deliberately avoids classes on fsEl: Kick's React rewrites fsEl's className
  // on re-render (e.g. during a resize) and would strip them, reverting the
  // controls. Safe to call repeatedly.
  const syncControlState = () => {
    const t = uiText();
    const overlayActive = overlayMode && active;
    document.documentElement.style.setProperty(
      '--kfc-overlay-opacity',
      (overlayOpacity / 100).toFixed(2)
    );
    document.documentElement.style.setProperty(
      '--kfc-info-bg-opacity',
      (infoBgOpacity / 100).toFixed(2)
    );
    // Video keeps full width in overlay mode; otherwise fall back to the shrink
    // calc by removing the override. --kfc-control-inset keeps Kick's full-width
    // bottom controls (the timeline) out from under the floating chat: it equals
    // the chat width in overlay mode (tracking live resize via --kfc-chat-width)
    // and is 0 otherwise (side mode already shrinks the whole player layer).
    if (overlayActive) {
      document.documentElement.style.setProperty('--kfc-video-width', '100%');
      document.documentElement.style.setProperty('--kfc-control-inset', 'var(--kfc-chat-width, 340px)');
    } else {
      document.documentElement.style.removeProperty('--kfc-video-width');
      document.documentElement.style.removeProperty('--kfc-control-inset');
    }

    // Chat-side docking. The .kfc-chat-left class flips the chat slot / divider
    // to the left edge (CSS); the variables below shift the player layers so
    // they don't overlap the left-docked chat. All offsets reference
    // --kfc-chat-width so they track live resize.
    const dockLeft = chatSide === 'left' && active;
    const chatWidthVar = 'var(--kfc-chat-width, 340px)';
    document.documentElement.classList.toggle('kfc-chat-left', chatSide === 'left');
    // Side mode shrinks the player, so push it right by the chat width.
    if (dockLeft && !overlayActive) {
      document.documentElement.style.setProperty('--kfc-video-shift', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-video-shift');
    }
    // Overlay mode keeps the player full-width, so instead nudge the full-width
    // bottom controls row right so it clears the floating chat.
    if (dockLeft && overlayActive) {
      document.documentElement.style.setProperty('--kfc-control-shift', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-control-shift');
    }
    // Keep the top-left info overlay clear of the chat in either mode.
    if (dockLeft) {
      document.documentElement.style.setProperty('--kfc-info-offset', chatWidthVar);
    } else {
      document.documentElement.style.removeProperty('--kfc-info-offset');
    }

    const wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      wrap.classList.toggle('kfc-chat-open', active);
      wrap.classList.toggle('kfc-messages-only', messagesOnly);
      wrap.classList.toggle('kfc-settings-open', settingsOpen);
    }

    if (chatSlot) {
      const overlayIdle =
        overlayActive && autoHideOverlayChat && chatSlot.classList.contains('kfc-idle');
      chatSlot.classList.toggle('kfc-overlay', overlayActive);
      chatSlot.classList.toggle('kfc-messages-only', messagesOnly);
      chatSlot.classList.toggle('kfc-overlay-idle', overlayIdle);
      if (resizeHandle) resizeHandle.classList.toggle('kfc-overlay-idle', overlayIdle);
    } else if (resizeHandle) {
      resizeHandle.classList.remove('kfc-overlay-idle');
    }

    applyInfoOverlayPrefs();

    const modeBtn = document.getElementById(MODE_BTN_ID);
    if (modeBtn) {
      modeBtn.classList.toggle('kfc-on', overlayMode);
      modeBtn.setAttribute(
        'aria-label',
        overlayMode ? t.toSide : t.toOverlay
      );
    }
    const infoBtn = document.getElementById(INFO_BTN_ID);
    if (infoBtn) {
      infoBtn.classList.toggle('kfc-off', infoHidden);
      infoBtn.setAttribute('aria-label', infoHidden ? t.showInfo : t.hideInfo);
    }
    const settingsBtn = document.getElementById(SETTINGS_BTN_ID);
    if (settingsBtn) {
      settingsBtn.classList.toggle('kfc-on', settingsOpen);
      // The word "chat" in these labels is load-bearing, not decoration.
      // kick-quality-saver finds Kick's player gear with, among others,
      // `button[aria-label*="settings" i]:not([aria-label*="chat" i])`, and the
      // old "Open fullscreen settings" matched it: on fullscreen entry Kick's
      // real gear isn't mounted yet, so that lookup fell through to ours and
      // clicked it up to three times a pass, which is what made the settings
      // panel flicker open and shut. Naming the script the settings belong to
      // is more accurate anyway. Keep "chat" away from the leading verb —
      // CHAT_TOGGLE_RE / SHOW_CHAT_RE match a label that starts with
      // `open|close|…` followed by "chat", and "Open chat settings" would make
      // this script mistake its own gear for Kick's chat toggle.
      settingsBtn.setAttribute(
        'aria-label',
        settingsOpen ? t.closeSettings : t.openSettings
      );
    }
    const widthValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-width-value`);
    if (widthValue) widthValue.textContent = `${chatWidth}px`;
    const infoOpacityInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-input`);
    if (infoOpacityInput) infoOpacityInput.value = String(infoBgOpacity);
    const infoOpacityValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-opacity-value`);
    if (infoOpacityValue) infoOpacityValue.textContent = `${infoBgOpacity}%`;
    const opacityInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-opacity-input`);
    if (opacityInput) opacityInput.value = String(overlayOpacity);
    const opacityValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-opacity-value`);
    if (opacityValue) opacityValue.textContent = `${overlayOpacity}%`;
    const idleInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-idle-input`);
    if (idleInput) idleInput.value = String(Math.round(idleDelayMs / 1000));
    const idleValue = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-idle-value`);
    if (idleValue) idleValue.textContent = `${Math.round(idleDelayMs / 1000)}s`;
    const autoHideInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-autohide-input`);
    if (autoHideInput) autoHideInput.checked = autoHideOverlayChat;
    const controlsHideInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-controls-hide-input`);
    if (controlsHideInput) controlsHideInput.checked = autoHideControls;
    const openOverlayInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-open-overlay-input`);
    if (openOverlayInput) openOverlayInput.checked = openChatAsOverlay;
    const restoreInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-restore-input`);
    if (restoreInput) restoreInput.checked = restoreChatOnFullscreen;
    const messagesOnlyInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-messages-only-input`);
    if (messagesOnlyInput) messagesOnlyInput.checked = messagesOnly;
    const dockLeftInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-dock-left-input`);
    if (dockLeftInput) dockLeftInput.checked = chatSide === 'left';
    const infoActionsInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-actions-input`);
    if (infoActionsInput) infoActionsInput.checked = infoShowActions;
    const infoTagsInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-info-tags-input`);
    if (infoTagsInput) infoTagsInput.checked = infoShowTags;
    const muteAdsInput = document.querySelector(`#${SETTINGS_PANEL_ID} .kfc-settings-mute-ads-input`);
    if (muteAdsInput) muteAdsInput.checked = muteAds;
  };

  // Keeps Tab inside an open card (DESIGN.md, 0.30.2): Tab from the last control
  // wraps to the first, Shift+Tab from the first wraps to the last, and a Tab
  // pressed while focus is outside the card brings it to the card's first (or,
  // with Shift, last) control. Hidden and disabled controls are skipped.
  const familyTrapTab = (e, card) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !card || !card.isConnected) return;
    const items = Array.from(card.querySelectorAll('button, [href], input, select, textarea, [tabindex]'))
      .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    let target = null;
    if (!card.contains(active)) target = e.shiftKey ? last : first;
    else if (!e.shiftKey && active === last) target = first;
    else if (e.shiftKey && active === first) target = last;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  };

  // Escape closes the panel and Tab stays inside it (0.30.2), as in the
  // sibling scripts' cards. Listening only while the panel is open. In browser
  // fullscreen the browser usually takes Escape itself to leave fullscreen,
  // which tears the panel down anyway; this covers the presses that reach the
  // page. A keyboard user who closes it this way lands back on the gear.
  const onSettingsKeydown = (e) => {
    const panel = document.getElementById(SETTINGS_PANEL_ID);
    if (e.key === 'Tab') { familyTrapTab(e, panel); return; }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const hadFocus = !!panel && panel.contains(document.activeElement);
    closeSettingsPanel();
    if (hadFocus) document.getElementById(SETTINGS_BTN_ID)?.focus();
  };

  const listenSettingsKeys = (on) => {
    if (on) document.addEventListener('keydown', onSettingsKeydown, true);
    else document.removeEventListener('keydown', onSettingsKeydown, true);
  };

  const toggleSettingsPanel = () => {
    settingsOpen = !settingsOpen;
    listenSettingsKeys(settingsOpen);
    syncControlState();
    onFsMouseMove();
  };

  const closeSettingsPanel = () => {
    if (!settingsOpen) return;
    settingsOpen = false;
    listenSettingsKeys(false);
    syncControlState();
  };

  document.addEventListener('click', (e) => {
    if (!settingsOpen) return;
    const wrap = document.getElementById(WRAP_ID);
    if (wrap?.contains(e.target)) return;
    closeSettingsPanel();
  });

  const toggleOverlayMode = () => {
    overlayMode = !overlayMode;
    log('overlay mode:', overlayMode);
    syncControlState();
    nudgePlayerResize();
  };

  const toggleInfoOverlay = () => {
    infoHidden = !infoHidden;
    log('info overlay hidden:', infoHidden);
    syncControlState();
    persistSettings();
  };

  const removeButton = () => {
    closeSettingsPanel();
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) wrap.remove();
    // The toast is parented to the fullscreen element too (showToast appends it
    // to whatever is fullscreen at the time), and it was the one node the
    // teardown left behind. Invisible — it settles at opacity 0 — but a foreign
    // node stranded inside Kick's React-managed player subtree, which is
    // precisely what the rest of this script goes out of its way not to do:
    // the chat slot, the divider, the info overlay and this wrap are all
    // removed on the way out so the DOM is handed back exactly as found.
    // Its fade timer goes with it, so a pending one can't touch a detached node.
    const toast = document.getElementById(TOAST_ID);
    if (toast) {
      clearTimeout(toast._kfcTimer);
      toast.remove();
    }
  };

  // Idle auto-hide: fade the toggle button out when the user stops moving the
  // mouse, mirroring how Kick's own controls overlay disappears. Any
  // mousemove on the fullscreen element brings it back instantly. Defaults to
  // 4000ms because Kick's controls fade noticeably later than the standard
  // 3000ms HTML5-video-player default.
  let idleTimer = 0;
  let idleFsEl = null;
  // Estimate of how long Kick keeps its own controls/timeline visible after the
  // last pointer activity. We can't read Kick's internal timer, so when the
  // user's configured delay exceeds this we synthesize pointer activity on the
  // player to keep Kick's timeline alive in step with our overlay (see
  // startKeepAlive). Slightly off from Kick's real value only shifts the joint
  // fade by the difference — both still disappear together within ~1s.
  const KICK_NATIVE_IDLE_MS = 4000;
  // Re-nudge well inside the native window so Kick never times out mid-keepalive.
  const KICK_KEEPALIVE_INTERVAL_MS = 2000;
  let keepAliveInterval = 0;
  let keepAliveFinalTimer = 0;
  // Reset Kick's idle timer by dispatching an untrusted mousemove on the player.
  // onFsMouseMove ignores untrusted events, so this keeps Kick's controls up
  // without resetting our own idle timer.
  const nudgeKickControls = () => {
    if (!idleFsEl) return;
    const target = queryPlayerVideo(idleFsEl) || idleFsEl;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  };
  const stopKeepAlive = () => {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = 0; }
    if (keepAliveFinalTimer) { clearTimeout(keepAliveFinalTimer); keepAliveFinalTimer = 0; }
  };
  // Keep Kick's native timeline visible until our overlay is about to fade, so
  // both disappear together at idleDelayMs instead of Kick fading at its shorter
  // fixed delay. Only needed when the configured delay outlasts Kick's own.
  const startKeepAlive = () => {
    stopKeepAlive();
    if (!idleFsEl || idleDelayMs <= KICK_NATIVE_IDLE_MS) return;
    // The final nudge fires this long before idle so Kick's controls fade
    // KICK_NATIVE_IDLE_MS later — i.e. exactly when our overlay fades.
    const fireFinalAt = idleDelayMs - KICK_NATIVE_IDLE_MS;
    if (fireFinalAt > KICK_KEEPALIVE_INTERVAL_MS) {
      keepAliveInterval = setInterval(nudgeKickControls, KICK_KEEPALIVE_INTERVAL_MS);
    }
    keepAliveFinalTimer = setTimeout(() => {
      stopKeepAlive();
      nudgeKickControls();
    }, fireFinalAt);
  };
  // Kick's own controls fade on a fixed internal timer (~KICK_NATIVE_IDLE_MS),
  // so for delays shorter than that its timeline lingers after our overlay is
  // gone. We can't shorten Kick's timer, so we hide its controls ourselves the
  // moment we go idle. Pure opacity + pointer-events only — no height/layout
  // changes — so the timeline never shifts off the bottom of the player.
  let fadedKickControls = null;
  let kickControlsObserver = null;
  let kickControlsReapplyTimer = 0;
  // Locate Kick's controls cluster: start at the seekbar/timeline and climb to
  // the top of the subtree that does NOT contain the <video>, so we fade the
  // controls overlay without ever touching the video layer.
  //
  // **Search Kick's player layers, never the whole fullscreen element.** The
  // docked chat is a child of fsEl too, so an `fsEl.querySelector` for the
  // seekbar can match something inside the chat — and since the climb below
  // stops at the top-level child of fsEl, what it then returns is the chat slot
  // itself, which we promptly fade to `opacity: 0`. That is the "chat goes
  // black about a second after the timeline hides" bug: it needs Kick's own
  // seekbar to be absent from the DOM at the moment of the lookup (Kick
  // unmounts its controls while they are hidden), which is exactly when the
  // reapply pass runs — and the pass is driven by DOM churn that the chat's own
  // message stream provides, hence the one-second delay rather than an
  // immediate blackout. Both halves are fixed: the search is scoped to the
  // marked video layers (falling back to fsEl only when side chat is not up and
  // there are no markers), and whatever the climb produces is refused if it is
  // one of ours.
  const findKickControlsLayer = (fsEl) => {
    // Marked player layers first; fsEl only as a last resort, for the case
    // where Kick's controls sit outside every marked layer. That fallback is
    // safe now only because both filters below apply to it.
    const scopes = videoRoots.length ? [...videoRoots, fsEl] : [fsEl];
    let seek = null;
    for (const scope of scopes) {
      for (const candidate of scope.querySelectorAll('[class*="seekbar" i], [role="slider"]')) {
        if (isKfcOwnedNode(candidate)) continue;
        seek = candidate;
        break;
      }
      if (seek) break;
    }
    if (!seek) return null;
    let node = seek;
    while (
      node.parentElement &&
      node.parentElement !== fsEl &&
      !queryPlayerVideo(node.parentElement)
    ) {
      node = node.parentElement;
    }
    if (isKfcOwnedNode(node) || (chatSlot && node.contains(chatSlot))) {
      log('controls-layer lookup landed on our own UI, refusing to fade it');
      return null;
    }
    return node;
  };
  const applyKickControlsFade = (layer) => {
    layer.style.setProperty('opacity', '0', 'important');
    layer.style.setProperty('pointer-events', 'none', 'important');
  };
  const clearKickControlsFade = (layer) => {
    layer.style.removeProperty('opacity');
    layer.style.removeProperty('pointer-events');
  };
  // Kick's React reconciler can re-mount the controls layer mid-idle, which
  // would drop our inline fade. Re-find and re-apply when that happens. We watch
  // childList only (not attributes) so the seekbar's per-frame style ticks don't
  // trigger it — only genuine node add/remove (re-mounts) do.
  const reapplyKickControlsHidden = () => {
    if (!fadedKickControls || !idleFsEl) return;
    const layer = findKickControlsLayer(idleFsEl);
    if (!layer) return;
    if (layer !== fadedKickControls) {
      clearKickControlsFade(fadedKickControls);
      fadedKickControls = layer;
    }
    applyKickControlsFade(layer);
  };
  const stopKickControlsWatch = () => {
    if (kickControlsObserver) {
      kickControlsObserver.disconnect();
      kickControlsObserver = null;
    }
    if (kickControlsReapplyTimer) {
      clearTimeout(kickControlsReapplyTimer);
      kickControlsReapplyTimer = 0;
    }
  };
  const setKickControlsHidden = (hidden) => {
    if (hidden) {
      if (fadedKickControls || !idleFsEl) return;
      const layer = findKickControlsLayer(idleFsEl);
      if (!layer) return;
      fadedKickControls = layer;
      applyKickControlsFade(layer);
      kickControlsObserver = new MutationObserver(() => {
        if (kickControlsReapplyTimer) return;
        kickControlsReapplyTimer = setTimeout(() => {
          kickControlsReapplyTimer = 0;
          reapplyKickControlsHidden();
        }, 100);
      });
      // Watch Kick's player layers, not the whole fullscreen element: with the
      // chat docked inside fsEl, every arriving message would otherwise wake
      // this observer (and, before the scoping above, drive the mis-targeted
      // reapply that blacked the chat out).
      const watchScopes = videoRoots.length ? videoRoots : [idleFsEl];
      watchScopes.forEach((scope) =>
        kickControlsObserver.observe(scope, { childList: true, subtree: true })
      );
    } else {
      stopKickControlsWatch();
      if (fadedKickControls) {
        clearKickControlsFade(fadedKickControls);
        fadedKickControls = null;
      }
    }
  };
  // How long the control cluster stays click-through after it starts fading
  // back in. Must match the opacity transition on #kfc-toggle-wrap: while the
  // cluster is invisible or half-faded, a click aimed at the player would
  // otherwise be swallowed by whichever button sits under the cursor (see the
  // .kfc-unarmed comment in injectStyles).
  const CONTROLS_FADE_MS = 200;
  let controlsArmTimer = 0;
  const cancelControlsArm = () => {
    if (controlsArmTimer) {
      clearTimeout(controlsArmTimer);
      controlsArmTimer = 0;
    }
  };
  const setIdle = (idle) => {
    const effectiveIdle = idle && !settingsOpen;
    const controlsIdle = effectiveIdle && autoHideControls;
    const wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      // Only the idle -> visible transition arms; a plain mousemove while the
      // cluster is already up must not re-disarm it, or continuous pointer
      // movement would keep the buttons permanently unclickable.
      const wasIdle = wrap.classList.contains('kfc-idle');
      wrap.classList.toggle('kfc-idle', controlsIdle);
      if (controlsIdle) {
        cancelControlsArm();
        wrap.classList.remove('kfc-unarmed');
      } else if (wasIdle) {
        cancelControlsArm();
        wrap.classList.add('kfc-unarmed');
        controlsArmTimer = setTimeout(() => {
          controlsArmTimer = 0;
          document.getElementById(WRAP_ID)?.classList.remove('kfc-unarmed');
          document.getElementById(INFO_ID)?.classList.remove('kfc-unarmed');
        }, CONTROLS_FADE_MS);
      }
    }
    const info = document.getElementById(INFO_ID);
    if (controlsIdle) setHoveredNative(null);
    if (info) {
      info.classList.toggle('kfc-idle', controlsIdle);
      // The overlay fades on the cluster's clock, so it arms with it too.
      info.classList.toggle('kfc-unarmed', !!wrap?.classList.contains('kfc-unarmed'));
    }
    if (chatSlot) chatSlot.classList.toggle('kfc-idle', effectiveIdle);
    setKickControlsHidden(controlsIdle);
    syncControlState();
  };
  const onFsMouseMove = (e) => {
    // Ignore the synthetic events we dispatch to keep Kick's controls alive —
    // only real pointer movement should reset our idle timer.
    if (e && !e.isTrusted) return;
    // Paint the resume cursor on whatever the pointer is over, while the
    // side layout is up (that is the only time the video is click-through).
    // Only a real move re-evaluates it: this handler is also called with no
    // event from a dozen places (fullscreen entry, settings changes, chat
    // open/close), and those must not strip the cursor from an element the
    // pointer is still sitting on.
    if (!active) resetSurfaceCursor();
    else if (e) applySurfaceCursor(e.target);
    setIdle(false);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setIdle(true), idleDelayMs);
    startKeepAlive();
  };
  const startIdleTracking = (fsEl) => {
    stopIdleTracking();
    idleFsEl = fsEl;
    fsEl.addEventListener('mousemove', onFsMouseMove);
    onFsMouseMove();
  };
  const stopIdleTracking = () => {
    resetSurfaceCursor();
    if (idleFsEl) idleFsEl.removeEventListener('mousemove', onFsMouseMove);
    idleFsEl = null;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    stopKeepAlive();
    setIdle(false);
    // Leaving fullscreen tears the wrap down; don't leave an arm timer behind.
    cancelControlsArm();
  };

  // When Kick's own hide-chat button toggles data-chat="false", tear down our layout
  // so the empty chat slot collapses and our "Chat" button reappears.
  // Within the reconcile-guard window opened by enableSideChat, a `false`
  // value is treated as Kick's React committing the previous "hidden" state
  // before our sync click took effect — we re-assert "true" instead of
  // tearing down.
  const dataChatObserver = new MutationObserver((muts) => {
    if (!active || suppressObserver) return;
    for (const m of muts) {
      if (m.attributeName !== 'data-chat') continue;
      const val = m.target.getAttribute?.('data-chat');
      if (val === 'false') {
        if (Date.now() < enableSyncUntil) {
          log('data-chat=false within reconcile guard, re-asserting true');
          // Single-shot: clear the guard so a subsequent React commit (or a
          // real user "hide chat" click later in the same window) can tear
          // the layout down normally.
          enableSyncUntil = 0;
          suppressObserver = true;
          setKickDataChat('true');
          queueMicrotask(() => {
            suppressObserver = false;
          });
          break;
        }
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs) {
          log('detected data-chat=false, tearing down side-chat layout');
          disableSideChat(fs);
        }
        break;
      }
    }
  });
  dataChatObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-chat'],
  });

  const onFullscreenChange = () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      injectStyles();
      // Only react when fullscreening something that looks like the player.
      const looksLikePlayer =
        VIDEO_WRAPPER_SELECTORS.some((s) => fsEl.matches?.(s) || fsEl.querySelector?.(s)) ||
        !!queryPlayerVideo(fsEl);
      if (!looksLikePlayer) return;
      ensureButton(fsEl);
      mountInfoOverlay(fsEl);
      startVideoLoadingMonitor(fsEl);
      startIdleTracking(fsEl);
      // Auto-open the side chat on fullscreen entry when the setting is on.
      // Deferred a tick so Kick's player tree finishes mounting; enableSideChat
      // itself waits for the video to be ready before touching the DOM.
      if (restoreChatOnFullscreen) {
        setTimeout(() => {
          const currentFs = document.fullscreenElement || document.webkitFullscreenElement;
          if (currentFs === fsEl && !active) enableSideChat(fsEl);
        }, 0);
      }
    } else {
      // Exiting fullscreen — clean up.
      clearPendingEnable();
      stopVideoLoadingMonitor();
      stopIdleTracking();
      if (active) {
        // We need to operate against the previous fullscreen element; rebuild from current DOM.
        const parent = chatSlot?.parentElement;
        if (parent) disableSideChat(parent);
      }
      unmountInfoOverlay();
      removeButton();
    }
  };

  // ── Mute ads ───────────────────────────────────────────────────────────
  // Kick's mid-roll ads are stitched into the stream and play in the normal
  // player, so there is nothing to block or skip, but they can be muted.
  // While an ad runs Kick's player renders a few pieces of ad UI that carry
  // stable, unlocalised markers (read from Kick's player bundle): the progress
  // bar (aria-label "Ad progress", shown whenever the break has a countdown),
  // the transparent "Visit advertiser" button (data-testid ad-click-overlay)
  // and, on skippable ads, the ad control bar's test ids. The "Ad 1 of 1 · 25s
  // left" label has no marker and its text is localised, so it isn't used.
  //
  // Polled, not observed: an observer on the page would wake for every chat
  // message, and the poll only runs while the setting is on. The player's
  // videos are muted through `video.muted`; the volume is never touched. Only
  // videos that were audible get muted, and only those are unmuted when the
  // break ends — a stream muted beforehand stays muted. If a
  // muted video is unmuted during the break (the user pressed Kick's mute
  // button), it is left alone for the rest of that break. The end of a break
  // waits AD_END_GRACE_MS, so back-to-back ads ("Ad 1 of 2" → "Ad 2 of 2")
  // don't let a moment of ad audio through between them.
  const AD_MARKER_SEL = [
    '[aria-label="Ad progress"]',
    '[data-testid="ad-click-overlay"]',
    '[data-testid="ad-skip"]',
    '[data-testid="ad-skip-countdown"]',
    '[data-testid="ad-learn-more"]',
  ].join(', ');
  const AD_POLL_MS = 400;
  const AD_END_GRACE_MS = 1200;
  let adPollTimer = 0;
  let adBreakActive = false;
  let adLastSeenAt = 0;
  // Videos looked at during this break (muted by us or not), and the ones we
  // muted and will unmute when it ends.
  let adSeenVideos = new Set();
  let adMutedVideos = new Set();

  const onAdMutedVolumeChange = (e) => {
    const video = e.currentTarget;
    if (video.muted || !adMutedVideos.has(video)) return;
    // Unmuted mid-break: the user wants the sound. Stop tracking it.
    video.removeEventListener('volumechange', onAdMutedVolumeChange);
    adMutedVideos.delete(video);
    log('ad mute: video unmuted during the ad, leaving it audible');
  };

  // Every player video on the page, not just the one beside the marker: Kick
  // keeps separate, hidden ad-player videos (one plays
  // static.kick.com/ads/black_2s.mp4) outside the main player's container.
  // Sub-badge animations and chat video emotes are left out (isPlayerVideo).
  const muteAdVideos = () => {
    Array.from(document.querySelectorAll('video')).filter(isPlayerVideo).forEach((video) => {
      if (adSeenVideos.has(video)) return;
      adSeenVideos.add(video);
      if (video.muted) return;
      video.muted = true;
      adMutedVideos.add(video);
      video.addEventListener('volumechange', onAdMutedVolumeChange);
      log('ad mute: muted the player for the ad');
    });
  };

  const endAdBreak = () => {
    adMutedVideos.forEach((video) => {
      video.removeEventListener('volumechange', onAdMutedVolumeChange);
      if (video.muted) video.muted = false;
    });
    if (adMutedVideos.size) log('ad mute: ad over, sound restored');
    adMutedVideos = new Set();
    adSeenVideos = new Set();
    adBreakActive = false;
  };

  const adMuteTick = () => {
    const marker = queryKickNode(AD_MARKER_SEL);
    if (marker) {
      if (!adBreakActive) log('ad mute: ad started');
      adBreakActive = true;
      adLastSeenAt = Date.now();
      muteAdVideos();
    } else if (adBreakActive && Date.now() - adLastSeenAt >= AD_END_GRACE_MS) {
      endAdBreak();
    }
  };

  // Start or stop the poll to match the setting. Turning it off mid-ad gives
  // the sound back at once.
  const updateAdMuteWatch = () => {
    if (muteAds && !adPollTimer) {
      adPollTimer = setInterval(adMuteTick, AD_POLL_MS);
      adMuteTick();
    } else if (!muteAds && adPollTimer) {
      clearInterval(adPollTimer);
      adPollTimer = 0;
      if (adBreakActive) endAdBreak();
    }
  };

  // Restore persisted preferences before any fullscreen interaction, then push
  // the saved chat width onto the CSS variable so the first open uses it.
  loadSettings();
  applyChatWidth();
  updateAdMuteWatch();

  // Keep every open Kick tab on the same settings. Each tab holds them in
  // memory and saves the whole blob, so without this a tab that never heard
  // about a change wrote its stale copy back over it on its next save: set the
  // chat width to 520 in one tab, flip any switch in another, and the width was
  // 340 again. Only the fields that actually changed between the old and new
  // value are applied, so a change this tab made in the last 300ms — still
  // waiting on its debounced save — isn't overwritten by the other tab's copy
  // of that field.
  const onSettingsStorage = (e) => {
    if (e.key !== SETTINGS_KEY || !e.newValue) return;
    let prev;
    let next;
    try {
      prev = JSON.parse(e.oldValue || '{}') || {};
      next = JSON.parse(e.newValue);
    } catch (_) {
      return;
    }
    if (!next || typeof next !== 'object') return;
    const changed = {};
    for (const key of Object.keys(next)) {
      if (next[key] !== prev[key]) changed[key] = next[key];
    }
    if (!Object.keys(changed).length) return;
    log('settings changed in another tab:', changed);
    applySettings(changed);
    updateAdMuteWatch();
    applyChatWidth();
    updateWidthChips();
    syncControlState();
    if (active) nudgePlayerResize();
  };
  window.addEventListener('storage', onSettingsStorage);
  window.addEventListener('pagehide', flushSettings);

  // Console API. Mirrors the debug toggle the other kick-* scripts expose, so
  // verbose logging can be flipped without editing and re-installing the file.
  window.KickFullscreenChat = {
    version: VERSION,
    debug: (on) => {
      debugOn = on === undefined ? !debugOn : !!on;
      saveSettings();
      console.log('[KickFullscreenChat] ' + (debugOn ? uiText().debugOn : uiText().debugOff));
      return debugOn;
    },
    // The recorded page errors, oldest first — for a crash seen outside
    // fullscreen side chat, where the crash watcher doesn't run. Outside side
    // chat only uncaught errors and rejections are recorded.
    lastErrors: () => formatRecentErrors(),
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
})();
