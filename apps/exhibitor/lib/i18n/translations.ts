const en = {
  // ── Home ─────────────────────────────────────────────
  "home.welcomeUser": "Welcome, {name}",
  "home.scanToStart": "Scan a badge to get started",
  "home.pointCamera": "Point your camera at a visitor\u2019s QR badge.",
  "home.scannedVisitors": "Scanned visitors",

  // ── Login ────────────────────────────────────────────
  "login.title": "Sign in",
  "login.subtitle": "Scanning works without signing in \u2014 sign in to save your scans to the event.",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in\u2026",
  "login.noAccount": "New exhibitor?",
  "login.createAccount": "Create an account",

  // ── Signup ───────────────────────────────────────────
  "signup.title": "Create your account",
  "signup.subtitle": "Any scans you\u2019ve already made on this device will save automatically once you sign up.",
  "signup.name": "Full name",
  "signup.username": "Username",
  "signup.phone": "Phone number",
  "signup.password": "Password",
  "signup.submit": "Create account",
  "signup.submitting": "Creating account\u2026",
  "signup.hasAccount": "Already have an account?",
  "signup.signIn": "Sign in",

  // ── Scan ─────────────────────────────────────────────
  "scan.starting": "Starting camera\u2026",
  "scan.denied": "Camera access was denied. Allow camera access, or enter a badge code manually below.",
  "scan.unavailable": "No camera available. Enter a badge code manually below.",
  "scan.cancel": "Cancel",
  "scan.torch": "Torch",
  "scan.manualPlaceholder": "Damaged badge? Enter the printed code",
  "scan.go": "Go",

  // ── Visitor description ──────────────────────────────
  "visitor.back": "\u2190 Back",
  "visitor.notFound": "This badge code wasn\u2019t recognized.",
  "visitor.notFoundHint": "Double-check the code, or try scanning again.",
  "visitor.pendingOffline": "Scanned \u2014 details will load once you\u2019re back online.",
  "visitor.savedOnDevice": "This scan has already been saved on your device.",
  "visitor.guestVisitor": "Guest visitor",
  "visitor.noContact": "No contact info on file yet.",
  "visitor.scannedAt": "Scanned {date}",

  // ── Scanned list ─────────────────────────────────────
  "scanned.title": "Scanned visitors",
  "scanned.search": "Search by name or company",
  "scanned.empty": "No visitors scanned yet. Tap Scan to get started.",
  "scanned.removed": "Removed {name} from your list",
  "scanned.pending": "Pending details\u2026",
  "scanned.willSync": "Saved \u2014 will sync",
  "scanned.syncError": "Sync error",

  // ── Profile ──────────────────────────────────────────
  "profile.phone": "Phone",
  "profile.syncStatus": "Sync status",
  "profile.pendingScans": "Pending scans",
  "profile.pending": "{count} pending",
  "profile.logout": "Log out",

  // ── Bottom nav ───────────────────────────────────────
  "nav.home": "Home",
  "nav.scan": "Scan",
  "nav.scanned": "Scanned",
  "nav.profile": "Profile",

  // ── Account badge ────────────────────────────────────
  "account.signIn": "Sign in",

  // ── Sync status ──────────────────────────────────────
  "sync.synced": "synced",
  "sync.syncing": "saved \u2014 syncing\u2026",
  "sync.offline": "saved offline",
  "sync.signedOut": "saved offline",
  "sync.error": "sync issue",

  // ── Visitor type badge ───────────────────────────────
  "badge.invited": "Invited",
  "badge.guest": "Guest",

  // ── Common ───────────────────────────────────────────
  "common.undo": "Undo",
  "common.loading": "Loading\u2026",
  "common.view": "View",
  "common.remove": "Remove",
} as const;

const fa: Record<keyof typeof en, string> = {
  // ── خانه ─────────────────────────────────────────────
  "home.welcomeUser": "{name} خوش آمدید",
  "home.scanToStart": "برای شروع یک نشان را اسکن کنید",
  "home.pointCamera": "دوربین خود را به سمت بج QR بازدیدکننده بگیرید.",
  "home.scannedVisitors": "بازدیدکنندگان اسکن‌شده",

  // ── ورود ────────────────────────────────────────────
  "login.title": "ورود",
  "login.subtitle": "اسکن بدون ورود کار می‌کند — برای ذخیره اسکن‌ها وارد شوید.",
  "login.username": "نام کاربری",
  "login.password": "رمز عبور",
  "login.submit": "ورود",
  "login.submitting": "در حال ورود…",
  "login.noAccount": "غرفه‌دار جدید؟",
  "login.createAccount": "ایجاد حساب",

  // ── ثبت‌نام ───────────────────────────────────────────
  "signup.title": "ایجاد حساب کاربری",
  "signup.subtitle": "اسکن‌های قبلی شما پس از ثبت‌نام به‌صورت خودکار ذخیره می‌شوند.",
  "signup.name": "نام کامل",
  "signup.username": "نام کاربری",
  "signup.phone": "شماره تلفن",
  "signup.password": "رمز عبور",
  "signup.submit": "ایجاد حساب",
  "signup.submitting": "در حال ایجاد حساب…",
  "signup.hasAccount": "حساب کاربری دارید؟",
  "signup.signIn": "ورود",

  // ── اسکن ─────────────────────────────────────────────
  "scan.starting": "در حال راه‌اندازی دوربین…",
  "scan.denied": "دسترسی دوربین رد شد. دسترسی دوربین را مجاز کنید یا کد نشان را به صورت دستی وارد کنید.",
  "scan.unavailable": "دوربینی در دسترس نیست. کد نشان را به صورت دستی وارد کنید.",
  "scan.cancel": "انصراف",
  "scan.torch": "فلش",
  "scan.manualPlaceholder": "نشان آسیب‌دیده؟ کد چاپ‌شده را وارد کنید",
  "scan.go": "برو",

  // ── توضیحات بازدیدکننده ──────────────────────────────
  "visitor.back": "بازگشت →",
  "visitor.notFound": "این کد نشان شناسایی نشد.",
  "visitor.notFoundHint": "کد را دوباره بررسی کنید یا مجدداً اسکن کنید.",
  "visitor.pendingOffline": "اسکن شد — جزئیات پس از اتصال مجدد بارگذاری می‌شود.",
  "visitor.savedOnDevice": "این اسکن روی دستگاه شما ذخیره شده است.",
  "visitor.guestVisitor": "بازدیدکننده مهمان",
  "visitor.noContact": "اطلاعات تماسی هنوز ثبت نشده است.",
  "visitor.scannedAt": "اسکن شده در {date}",

  // ── لیست اسکن‌شده ─────────────────────────────────────
  "scanned.title": "بازدیدکنندگان اسکن‌شده",
  "scanned.search": "جستجو بر اساس نام یا شرکت",
  "scanned.empty": "هنوز بازدیدکننده‌ای اسکن نشده. برای شروع اسکن کنید.",
  "scanned.removed": "{name} از لیست شما حذف شد",
  "scanned.pending": "در انتظار جزئیات…",
  "scanned.willSync": "ذخیره شد — همگام‌سازی خواهد شد",
  "scanned.syncError": "خطای همگام‌سازی",

  // ── پروفایل ──────────────────────────────────────────
  "profile.phone": "تلفن",
  "profile.syncStatus": "وضعیت همگام‌سازی",
  "profile.pendingScans": "اسکن‌های در انتظار",
  "profile.pending": "{count} در انتظار",
  "profile.logout": "خروج",

  // ── منوی پایین ───────────────────────────────────────
  "nav.home": "خانه",
  "nav.scan": "اسکن",
  "nav.scanned": "اسکن‌شده",
  "nav.profile": "پروفایل",

  // ── نشان حساب ────────────────────────────────────────
  "account.signIn": "ورود",

  // ── وضعیت همگام‌سازی ──────────────────────────────────
  "sync.synced": "همگام‌شده",
  "sync.syncing": "ذخیره شد — در حال همگام‌سازی…",
  "sync.offline": "ذخیره آفلاین",
  "sync.signedOut": "ذخیره آفلاین",
  "sync.error": "مشکل همگام‌سازی",

  // ── نوع بازدیدکننده ───────────────────────────────────
  "badge.invited": "دعوت‌شده",
  "badge.guest": "مهمان",

  // ── عمومی ───────────────────────────────────────────
  "common.undo": "بازگردانی",
  "common.loading": "در حال بارگذاری…",
  "common.view": "مشاهده",
  "common.remove": "حذف",
};

export type TranslationKey = keyof typeof en;
export { en, fa };
