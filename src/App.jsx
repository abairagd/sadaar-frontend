import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { ShoppingBag, Search, Plus, Minus, ChevronLeft, Check, Loader2, Heart, Sparkles, Globe, User } from "lucide-react";
import { FaInstagram, FaTiktok, FaSnapchat, FaXTwitter, FaWhatsapp } from "react-icons/fa6";

const API_BASE = "https://sadaar-backend-production.up.railway.app/api";

const C = {
  ink: "#14282E",
  deep: "#1A3B40",
  sand: "#F3ECDD",
  warm: "#FBF8F1",
  bronze: "#B08D57",
  char: "#22201B",
  line: "#DCD2BB",
  muted: "#7A7566",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=Tajawal:wght@400;500;700&display=swap');

* { box-sizing: border-box; }
body { overflow-x: hidden; }

.sadaar-rtl, .sadaar-rtl * { font-family: 'Tajawal', sans-serif !important; }

button { transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease; }
button:hover:not(:disabled) { opacity: 0.85; }
a:hover { opacity: 0.85; }
.sadaar-card-hover { transition: transform 0.2s ease; }
.sadaar-card-hover:hover { transform: translateY(-3px); }

@media (max-width: 680px) {
  .sadaar-header-row { flex-wrap: wrap !important; }
  .sadaar-header-left { width: 100% !important; justify-content: space-between !important; }
  .sadaar-top-nav { gap: 14px !important; overflow-x: auto !important; flex-wrap: nowrap !important; width: 100%; padding-top: 4px; }
  .sadaar-hero { height: clamp(320px, 55vh, 460px) !important; }
  .sadaar-hero > div { padding-left: 16px !important; padding-right: 16px !important; }
  .sadaar-browse-layout { flex-direction: column !important; padding-left: 16px !important; padding-right: 16px !important; }
  .sadaar-browse-sidebar { width: 100% !important; }
  .sadaar-browse-filters { display: flex !important; flex-wrap: wrap !important; gap: 16px 24px !important; margin-bottom: 20px !important; }
  .sadaar-browse-filters > div { margin-bottom: 0 !important; }
  .sadaar-product-layout { flex-direction: column !important; gap: 24px !important; padding-left: 16px !important; padding-right: 16px !important; }
  .sadaar-product-image { flex: 1 1 100% !important; }
  .sadaar-cart-row { flex-wrap: wrap !important; }
  .sadaar-section { padding-left: 16px !important; padding-right: 16px !important; }
}
`;

const CATEGORIES = ["Men", "Women"];

// Subcategories are intentionally just a plain object here (not stored/enforced
// on the backend) — adding a new one later is just adding a string to this list.
// Shoes and Accessories are reused as subcategory names under both Men and
// Women — the (category, subcategory) pair together disambiguates them, so
// "Women > Shoes" and "Men > Shoes" filter correctly as separate groups.
const SUBCATEGORIES_BY_CATEGORY = {
  Men: ["Clothing", "Shoes", "Accessories", "Jewelry"],
  Women: ["Clothing", "Shoes", "Accessories", "Jewelry"],
};

// Product types are the finest taxonomy level, keyed by subcategory. Same
// philosophy as subcategories — free text on the backend, curated options
// here for a consistent dropdown. Add more anytime by editing this list.
// Product types are nested by category first, then subcategory — this is
// what keeps women's-only items (Bikini, Abayas, Dresses) from ever showing
// up as options under Men, and vice versa, even though "Clothing" is a
// shared subcategory name for both.
const PRODUCT_TYPES_BY_CATEGORY = {
  Men: {
    Clothing: ["T-Shirts", "Button-Up Shirts", "Polo Shirts", "Sweatshirts", "Hoodies", "Jeans", "Cargo Pants", "Chinos", "Joggers", "Shorts", "Bomber Jackets", "Swim Trunks", "Classic Thobe", "Modern Thobe"],
    Shoes: ["Sneakers", "Sandals", "Boots", "Loafers"],
    Accessories: ["Bags", "Belts", "Watches", "Sunglasses"],
    Jewelry: ["Necklaces", "Rings", "Bracelets"],
  },
  Women: {
    Clothing: ["T-Shirts", "Sweatshirts", "Hoodies", "Jeans", "Cargo Pants", "Chinos", "Joggers", "Shorts", "Swim Shorts", "One-Piece", "Bikini", "Classic Abaya", "Embroidered Abaya", "Kimono Abaya", "Maxi Dress", "Midi Dress", "Evening Dress"],
    Shoes: ["Sneakers", "Sandals", "Boots", "Heels", "Loafers"],
    Accessories: ["Bags", "Belts", "Watches", "Sunglasses"],
    Jewelry: ["Necklaces", "Rings", "Bracelets", "Earrings"],
  },
};

const catTone = {
  Men: { bg: C.sand, fg: C.ink },
  Women: { bg: "#EDE3D0", fg: C.deep },
};

function money(n) {
  return `SAR ${Number(n).toLocaleString()}`;
}

// Mirrors the backend's per-brand shipping calculation (src/controllers/ordersController.js)
// so the customer sees an accurate estimate before checkout. The backend always
// recomputes this authoritatively at order time — this is display-only.
const SHIPPING_FEE_PER_BRAND = 25;
const FREE_SHIPPING_THRESHOLD = 300;

function estimateShipping(items) {
  const brandSubtotals = {};
  for (const item of items) {
    const brandId = item.product.brand_id;
    brandSubtotals[brandId] = (brandSubtotals[brandId] || 0) + item.product.price * item.qty;
  }
  return Object.values(brandSubtotals).reduce(
    (s, brandSubtotal) => s + (brandSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE_PER_BRAND),
    0
  );
}

// Updates the browser tab title and meta description as the user navigates.
// Note: since this is a client-rendered app, search engine crawlers that don't
// execute JavaScript won't see these per-page values — this mainly helps
// browser tabs/history/bookmarks and crawlers that do render JS (like Google).
function setPageMeta(title, description) {
  document.title = title;
  if (description) {
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description);
  }
}

// Guest wishlist — stored per device via localStorage. Once a customer logs
// in, the wishlist switches to being stored server-side (synced across
// devices) instead — see toggleWishlist in the main component.
const WISHLIST_KEY = "sadaar_wishlist";

function getWishlistIds() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setWishlistIds(ids) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
}

// --- Customer account auth ---
const CUSTOMER_AUTH_KEY = "sadaar_customer_auth";

function getSavedCustomerAuth() {
  try {
    const raw = localStorage.getItem(CUSTOMER_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCustomerAuth(token, customer) {
  try {
    if (token && customer) localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify({ token, customer }));
    else localStorage.removeItem(CUSTOMER_AUTH_KEY);
  } catch {}
}

// --- Language / translations ---
// Product and brand content (names, descriptions) stays exactly as entered by
// brands — this only translates SADAAR's own UI chrome. Persisted per device.
const LANG_KEY = "sadaar_lang";

const CATEGORY_LABELS = {
  en: { Men: "Men", Women: "Women" },
  ar: { Men: "رجال", Women: "نساء" },
};

const SUBCATEGORY_LABELS = {
  en: { Clothing: "Clothing", Shoes: "Shoes", Accessories: "Accessories", Jewelry: "Jewelry" },
  ar: { Clothing: "ملابس", Shoes: "أحذية", Accessories: "إكسسوارات", Jewelry: "مجوهرات" },
};

const PRODUCT_TYPE_LABELS = {
  en: { "T-Shirts": "T-Shirts", "Button-Up Shirts": "Button-Up Shirts", "Polo Shirts": "Polo Shirts", Sweatshirts: "Sweatshirts", Hoodies: "Hoodies", Jeans: "Jeans", "Cargo Pants": "Cargo Pants", Chinos: "Chinos", Joggers: "Joggers", Shorts: "Shorts", "Bomber Jackets": "Bomber Jackets", "Swim Trunks": "Swim Trunks", "Swim Shorts": "Swim Shorts", "One-Piece": "One-Piece", Bikini: "Bikini", "Classic Thobe": "Classic Thobe", "Modern Thobe": "Modern Thobe", "Classic Abaya": "Classic Abaya", "Embroidered Abaya": "Embroidered Abaya", "Kimono Abaya": "Kimono Abaya", "Maxi Dress": "Maxi Dress", "Midi Dress": "Midi Dress", "Evening Dress": "Evening Dress", Sneakers: "Sneakers", Sandals: "Sandals", Boots: "Boots", Heels: "Heels", Loafers: "Loafers", Bags: "Bags", Belts: "Belts", Watches: "Watches", Sunglasses: "Sunglasses", Necklaces: "Necklaces", Rings: "Rings", Bracelets: "Bracelets", Earrings: "Earrings" },
  ar: { "T-Shirts": "تيشيرتات", "Button-Up Shirts": "قمصان بأزرار", "Polo Shirts": "قمصان بولو", Sweatshirts: "سويت شيرت", Hoodies: "هوديات", Jeans: "جينز", "Cargo Pants": "بنطال كارجو", Chinos: "بنطال تشينو", Joggers: "بنطال رياضي", Shorts: "شورت", "Bomber Jackets": "جاكيت بومبر", "Swim Trunks": "شورت سباحة", "Swim Shorts": "شورت سباحة", "One-Piece": "قطعة واحدة", Bikini: "بيكيني", "Classic Thobe": "ثوب كلاسيكي", "Modern Thobe": "ثوب عصري", "Classic Abaya": "عباية كلاسيكية", "Embroidered Abaya": "عباية مطرزة", "Kimono Abaya": "عباية كيمونو", "Maxi Dress": "فستان طويل", "Midi Dress": "فستان متوسط", "Evening Dress": "فستان سهرة", Sneakers: "سنيكرز", Sandals: "صنادل", Boots: "بوت", Heels: "كعب عالي", Loafers: "لوفرز", Bags: "حقائب", Belts: "أحزمة", Watches: "ساعات", Sunglasses: "نظارات شمسية", Necklaces: "قلادات", Rings: "خواتم", Bracelets: "أساور", Earrings: "أقراط" },
};

const T = {
  en: {
    home: "Home", shopAll: "Shop all", brandsNav: "Brands", wishlistNav: "Wishlist", trackOrderNav: "Track order",
    tagline: "Home of Saudi Fashion", eyebrow: "Curated · Direct from the brand",
    heroTitle1: "The home of", heroTitle2: "Saudi fashion.",
    heroSubtitle: "Independent Saudi labels, one checkout. Every piece is shipped and stood behind by the brand that made it.",
    shopTheEdit: "Shop the edit",
    curatedBrands: "Curated brands", viewAll: "View all →", spotlight: "Spotlight",
    shopByCategory: "Shop by category", thisWeeksEdit: "This week's edit",
    ourStory: "Our story",
    ourStoryText: "Saudi fashion has never lacked talent — it's lacked a single front door. SADAAR brings independent Saudi labels together under one roof, without asking any of them to change what makes them theirs.",
    joinQuestion: "Are you a Saudi fashion brand?", joinSubtext: "Join SADAAR and reach shoppers looking for exactly what you make.", applyToSell: "Apply to sell",
    searchPlaceholder: "Search pieces...", category: "Category", all: "All", brand: "Brand", price: "Price (SAR)", min: "Min", max: "Max",
    clearFilters: "Clear filters", pieces: "pieces",
    sortNewest: "Newest", sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low", sortNameAsc: "Name: A to Z",
    noMatches: "No pieces match those filters.",
    allBrands: "All brands", shopBrand: (name) => `Shop ${name}`,
    back: "Back", size: "Size", qty: "Qty", addToCart: "Add to cart", soldOut: "Sold out", addedToCart: "Added to cart",
    shippedBy: (brand) => `Shipped directly by ${brand}, curated and guaranteed by SADAAR.`,
    youMightAlsoLike: "You might also like",
    yourBag: "Your bag", bagEmpty: "Your bag is empty", remove: "Remove",
    subtotal: "Subtotal", shipping: "Shipping", free: "Free", estimatedTotal: "Estimated total",
    shippingNote: (fee, threshold) => `Shipping is calculated per brand (SAR ${fee}, free over SAR ${threshold} per brand) since each brand ships separately. Estimated delivery: 3–5 business days.`,
    checkout: "Checkout", checkoutSubtitle: "Enter your shipping details, then you'll pay by card on the next step.",
    fullName: "Full name", emailOptional: "Email (optional)", phoneNumber: "Phone number", city: "City", address: "Address",
    promoCode: "Promo code", apply: "Apply", checking: "Checking...", codeApplied: (code) => `Code "${code}" applied`,
    discount: "Discount", totalDue: "Total due", continueToPayment: "Continue to payment", placingOrder: "Placing order...",
    payment: "Payment", paymentGatewayMissing: "payment gateway isn't configured yet on the backend (MOYASAR_PUBLISHABLE_KEY missing)",
    paymentReceived: "Payment received", paymentReceivedNote: "Each brand in your bag has been notified to fulfill their item.",
    backToSadaar: "Back to SADAAR",
    confirmingPayment: "Confirming your payment...",
    confirmationEmailNote: (orderId, total) => `Order #${orderId} — ${total}. A confirmation email is on its way.`,
    couldNotConfirmPayment: "We couldn't confirm that payment",
    trackYourOrder: "Track your order", trackSubtitle: "Enter your order number and the email or phone you used at checkout.",
    orderNumberPlaceholder: "Order number (e.g. 17)", contactPlaceholder: "Email or phone used at checkout", trackOrderBtn: "Track order", lookingUp: "Looking up...",
    tracking: "Tracking", total: "Total",
    requestCancellation: "Request cancellation", cancellationRequested: "Cancellation requested — waiting on the brand to review.",
    cancellationDenied: "Cancellation request was declined.", cancellationRefunded: "Cancelled and refunded.",
    yourWishlist: "Your wishlist", nothingSaved: "Nothing saved yet", nothingSavedSubtext: "Tap the heart on any piece to save it here for later.",
    footerTagline: "One marketplace for Saudi fashion — every brand kept true to its own hand, delivered through one trusted checkout.",
    footerShop: "Shop", footerSadaar: "SADAAR", footerJoin: "Join as a brand", footerCopyright: "© 2026 SADAAR. Every product ships direct from its brand.",
    fillAllFields: "Please fill in all fields.",
    enterOrderAndContact: "Enter both your order number and the email or phone you used.",
    contactUs: "Contact us", contactSubtitle: "Have a question about an order, a brand, or anything else? Send us a message.",
    shopTab: "Shop", aboutTab: "About", founderStory: "Founder story", brandPhilosophy: "Philosophy",
    accountNav: "Account", myAccount: "My account", logIn: "Log in", signUp: "Sign up", logOut: "Log out",
    fullNameField: "Full name", emailField: "Email", passwordField: "Password", confirmPasswordField: "Confirm password",
    noAccountYet: "Don't have an account?", haveAccount: "Already have an account?", forgotPassword: "Forgot password?",
    orderHistory: "Order history", myWishlist: "My wishlist", savedAddresses: "Saved addresses",
    noOrdersYet: "No orders yet.", addAddress: "Add address", addressLabel: "Label (e.g. Home, Work)",
    setAsDefault: "Set as default", defaultBadge: "Default", noAddressesYet: "No saved addresses yet.",
    passwordsDontMatch: "Passwords don't match.", accountCreated: "Account created.",
    useSavedAddress: "Use a saved address", orNewAddress: "Or enter a new address",
    saveThisAddress: "Save this address to my account",
    signatureProducts: "Signature products", followUs: "Follow", visitWebsite: "Website",
    basedIn: (city) => `Based in ${city}`,
    yourName: "Your name", subjectOptional: "Subject (optional)", yourMessage: "Your message",
    sendMessage: "Send message", sending: "Sending...", messageSent: "Message sent",
    messageSentNote: "Thanks for reaching out — we'll get back to you by email.",
    contactNav: "Contact",
    brandSignIn: "Brand sign in",
  },
  ar: {
    home: "الرئيسية", shopAll: "تسوق الكل", brandsNav: "الماركات", wishlistNav: "المفضلة", trackOrderNav: "تتبع الطلب",
    tagline: "بيت الأزياء السعودية", eyebrow: "منتقاة · مباشرة من الماركة",
    heroTitle1: "بيت", heroTitle2: "الأزياء السعودية.",
    heroSubtitle: "ماركات سعودية مستقلة، سلة شراء واحدة. كل قطعة تُشحن ويقف خلفها صانعها.",
    shopTheEdit: "تسوق التشكيلة",
    curatedBrands: "ماركات منتقاة", viewAll: "عرض الكل ←", spotlight: "مميزة",
    shopByCategory: "تسوق حسب الفئة", thisWeeksEdit: "تشكيلة هذا الأسبوع",
    ourStory: "قصتنا",
    ourStoryText: "الأزياء السعودية لم تفتقر يومًا للموهبة، بل افتقرت لباب واحد يجمعها. سدّار يجمع الماركات السعودية المستقلة تحت سقف واحد، دون أن يطلب من أي منها أن تتغير عمّا يميزها.",
    joinQuestion: "هل تملك ماركة أزياء سعودية؟", joinSubtext: "انضم إلى سدّار وصل إلى المتسوقين الباحثين عمّا تصنعه بالضبط.", applyToSell: "قدّم طلب الانضمام",
    searchPlaceholder: "ابحث عن قطعة...", category: "الفئة", all: "الكل", brand: "الماركة", price: "السعر (ر.س)", min: "الأدنى", max: "الأعلى",
    clearFilters: "مسح الفلاتر", pieces: "قطعة",
    sortNewest: "الأحدث", sortPriceAsc: "السعر: من الأقل للأعلى", sortPriceDesc: "السعر: من الأعلى للأقل", sortNameAsc: "الاسم: أ-ي",
    noMatches: "لا توجد قطع مطابقة لهذه الفلاتر.",
    allBrands: "جميع الماركات", shopBrand: (name) => `تسوق ${name}`,
    back: "رجوع", size: "المقاس", qty: "الكمية", addToCart: "أضف إلى السلة", soldOut: "نفدت الكمية", addedToCart: "تمت الإضافة",
    shippedBy: (brand) => `تُشحن مباشرة من ${brand}، منتقاة ومضمونة من سدّار.`,
    youMightAlsoLike: "قد يعجبك أيضًا",
    yourBag: "سلتك", bagEmpty: "سلتك فارغة", remove: "إزالة",
    subtotal: "المجموع الفرعي", shipping: "الشحن", free: "مجاني", estimatedTotal: "الإجمالي التقديري",
    shippingNote: (fee, threshold) => `يُحتسب الشحن لكل ماركة (${fee} ر.س، مجاني فوق ${threshold} ر.س لكل ماركة) لأن كل ماركة تشحن بشكل منفصل. التوصيل المتوقع: 3–5 أيام عمل.`,
    checkout: "إتمام الشراء", checkoutSubtitle: "أدخل بيانات الشحن، ثم ادفع بالبطاقة في الخطوة التالية.",
    fullName: "الاسم الكامل", emailOptional: "البريد الإلكتروني (اختياري)", phoneNumber: "رقم الجوال", city: "المدينة", address: "العنوان",
    promoCode: "كود الخصم", apply: "تطبيق", checking: "جارٍ التحقق...", codeApplied: (code) => `تم تطبيق الكود "${code}"`,
    discount: "الخصم", totalDue: "المبلغ المستحق", continueToPayment: "متابعة الدفع", placingOrder: "جارٍ تنفيذ الطلب...",
    payment: "الدفع", paymentGatewayMissing: "بوابة الدفع غير مُهيأة بعد",
    paymentReceived: "تم استلام الدفع", paymentReceivedNote: "تم إشعار كل ماركة في سلتك لتجهيز طلبها.",
    backToSadaar: "العودة إلى سدّار",
    confirmingPayment: "جارٍ تأكيد الدفع...",
    confirmationEmailNote: (orderId, total) => `الطلب رقم ${orderId} — ${total}. بريد التأكيد في طريقه إليك.`,
    couldNotConfirmPayment: "تعذّر تأكيد هذا الدفع",
    trackYourOrder: "تتبع طلبك", trackSubtitle: "أدخل رقم الطلب والبريد الإلكتروني أو رقم الجوال المستخدم عند الدفع.",
    orderNumberPlaceholder: "رقم الطلب (مثال: 17)", contactPlaceholder: "البريد الإلكتروني أو الجوال المستخدم عند الدفع", trackOrderBtn: "تتبع الطلب", lookingUp: "جارٍ البحث...",
    tracking: "رقم التتبع", total: "الإجمالي",
    requestCancellation: "طلب إلغاء", cancellationRequested: "تم إرسال طلب الإلغاء — بانتظار مراجعة الماركة.",
    cancellationDenied: "تم رفض طلب الإلغاء.", cancellationRefunded: "تم الإلغاء واسترداد المبلغ.",
    yourWishlist: "قائمة المفضلة", nothingSaved: "لا يوجد شيء محفوظ بعد", nothingSavedSubtext: "اضغطي على القلب في أي قطعة لحفظها هنا لاحقًا.",
    footerTagline: "سوق واحد للأزياء السعودية — كل ماركة تحافظ على هويتها، ويصلك عبر عملية شراء واحدة موثوقة.",
    footerShop: "تسوق", footerSadaar: "سدّار", footerJoin: "انضم كماركة", footerCopyright: "© 2026 سدّار. كل منتج يُشحن مباشرة من ماركته.",
    fillAllFields: "الرجاء تعبئة جميع الحقول.",
    enterOrderAndContact: "أدخل رقم الطلب والبريد الإلكتروني أو الجوال المستخدم.",
    contactUs: "تواصل معنا", contactSubtitle: "لديك سؤال عن طلب أو ماركة أو أي شيء آخر؟ أرسل لنا رسالة.",
    shopTab: "تسوق", aboutTab: "عن الماركة", founderStory: "قصة المؤسس", brandPhilosophy: "الفلسفة",
    accountNav: "الحساب", myAccount: "حسابي", logIn: "تسجيل الدخول", signUp: "إنشاء حساب", logOut: "تسجيل الخروج",
    fullNameField: "الاسم الكامل", emailField: "البريد الإلكتروني", passwordField: "كلمة المرور", confirmPasswordField: "تأكيد كلمة المرور",
    noAccountYet: "ليس لديك حساب؟", haveAccount: "لديك حساب بالفعل؟", forgotPassword: "نسيت كلمة المرور؟",
    orderHistory: "سجل الطلبات", myWishlist: "قائمة المفضلة", savedAddresses: "العناوين المحفوظة",
    noOrdersYet: "لا توجد طلبات بعد.", addAddress: "إضافة عنوان", addressLabel: "التسمية (مثل: المنزل، العمل)",
    setAsDefault: "تعيين كافتراضي", defaultBadge: "افتراضي", noAddressesYet: "لا توجد عناوين محفوظة بعد.",
    passwordsDontMatch: "كلمتا المرور غير متطابقتين.", accountCreated: "تم إنشاء الحساب.",
    useSavedAddress: "استخدام عنوان محفوظ", orNewAddress: "أو أدخل عنوانًا جديدًا",
    saveThisAddress: "حفظ هذا العنوان في حسابي",
    signatureProducts: "منتجات مميزة", followUs: "تابعي", visitWebsite: "الموقع الإلكتروني",
    basedIn: (city) => `مقرها في ${city}`,
    yourName: "اسمك", subjectOptional: "الموضوع (اختياري)", yourMessage: "رسالتك",
    sendMessage: "إرسال الرسالة", sending: "جارٍ الإرسال...", messageSent: "تم إرسال الرسالة",
    messageSentNote: "شكرًا لتواصلك — سنرد عليك عبر البريد الإلكتروني.",
    contactNav: "تواصل معنا",
    brandSignIn: "تسجيل دخول الماركات",
  },
};

function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

const LangContext = createContext({ lang: "en", t: T.en, dir: "ltr", categoryLabel: (c) => c, subcategoryLabel: (c) => c, productTypeLabel: (c) => c, toggleLang: () => {} });
function useLang() {
  return useContext(LangContext);
}

async function api(path, options = {}, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Tag({ text }) {
  return (
    <div style={{ position: "absolute", top: 14, left: -6, transform: "rotate(-6deg)", background: C.warm, border: `1px solid ${C.line}`, padding: "4px 10px 4px 16px", fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ink, boxShadow: "1px 2px 4px rgba(20,40,46,0.12)", zIndex: 2 }}>
      <span style={{ position: "absolute", left: 5, top: "50%", width: 5, height: 5, borderRadius: "50%", background: C.warm, border: `1px solid ${C.muted}`, transform: "translateY(-50%)" }} />
      {text}
    </div>
  );
}

function Swatch({ product, height = 260, imageUrl }) {
  const tone = catTone[product.category] || catTone.Men;
  const brandName = product.brand_name || product.brandName || "SADAAR";
  const src = imageUrl || product.image_url || product.images?.[0]?.url;

  if (src) {
    return (
      <div style={{ position: "relative", height, background: tone.bg, overflow: "hidden" }}>
        <img src={src} alt={product.name || brandName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <Tag text={brandName} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height, background: tone.bg, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 500, fontSize: height * 0.62, color: tone.fg, opacity: 0.16, lineHeight: 1 }}>
        {brandName.charAt(0)}
      </span>
      <Tag text={brandName} />
    </div>
  );
}

function ProductCard({ product, onOpen, wishlisted, onToggleWishlist }) {
  return (
    <div style={{ position: "relative" }}>
      <button className="sadaar-card-hover" onClick={() => onOpen(product.id)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", width: "100%" }}>
        <Swatch product={product} />
        <div style={{ paddingTop: 10 }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{product.brand_name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 15, color: C.char, fontFamily: "Fraunces, serif" }}>{product.name}</p>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: C.ink, fontWeight: 500 }}>{money(product.price)}</p>
        </div>
      </button>
      {onToggleWishlist && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
          aria-label="Toggle wishlist"
          style={{ position: "absolute", top: 10, right: 10, background: "rgba(251,248,241,0.9)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <Heart size={15} color={C.ink} fill={wishlisted ? C.ink : "none"} />
        </button>
      )}
    </div>
  );
}

function Loading({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>
      <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
      {label || "Loading..."}
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{ padding: 40, fontFamily: "Inter, sans-serif", fontSize: 13, color: "#A3402F" }}>
      Couldn't reach SADAAR right now — {message}. The API may be waking up; try refreshing in a moment.
    </div>
  );
}

function Header({ setView, cartCount, wishlistCount, onSearchClick, currentView, isLoggedIn }) {
  const { t, lang, toggleLang, categoryLabel, subcategoryLabel, productTypeLabel } = useLang();
  const [hoveredSubcat, setHoveredSubcat] = useState(null);
  const isHomeActive = currentView.type === "home";
  const isBrandsActive = currentView.type === "brands";
  const activeCat = currentView.type === "browse" ? currentView.cat : null;
  const activeSubcat = currentView.type === "browse" ? currentView.subcat : null;
  const subcatsForActiveCat = activeCat && SUBCATEGORIES_BY_CATEGORY[activeCat] ? SUBCATEGORIES_BY_CATEGORY[activeCat] : null;

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: C.warm, borderBottom: `1px solid ${C.line}` }}>
      <div className="sadaar-header-row" style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div className="sadaar-header-left" style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <button onClick={() => setView({ type: "home" })} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "start" }}>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 26, letterSpacing: "0.04em", color: C.ink }}>SADAAR</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.bronze, marginTop: -2 }}>{t.tagline}</div>
          </button>
          <nav style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }} className="sadaar-top-nav">
            <button onClick={() => setView({ type: "home" })} style={isHomeActive ? activeNavBtn : inactiveNavBtn}>{t.home}</button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setView({ type: "browse", cat: c })} style={activeCat === c ? activeNavBtn : inactiveNavBtn}>{categoryLabel(c)}</button>
            ))}
            <button onClick={() => setView({ type: "brands" })} style={isBrandsActive ? activeNavBtn : inactiveNavBtn}>{t.brandsNav}</button>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={toggleLang} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 3, padding: "4px 9px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.char }}>
            {lang === "en" ? "ع" : "EN"}
          </button>
          <button onClick={onSearchClick} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Search"><Search size={19} color={C.ink} /></button>
          <button onClick={() => setView({ type: "account" })} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }} aria-label="Account">
            <User size={19} color={C.ink} />
            {isLoggedIn && (
              <span style={{ position: "absolute", top: -2, insetInlineEnd: -2, background: "#2F5B3C", width: 8, height: 8, borderRadius: "50%" }} />
            )}
          </button>
          <button onClick={() => setView({ type: "wishlist" })} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }} aria-label="Wishlist">
            <Heart size={19} color={C.ink} />
            {wishlistCount > 0 && (
              <span style={{ position: "absolute", top: -6, insetInlineEnd: -8, background: C.ink, color: C.warm, fontSize: 10, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{wishlistCount}</span>
            )}
          </button>
          <button onClick={() => setView({ type: "cart" })} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }} aria-label="Cart">
            <ShoppingBag size={19} color={C.ink} />
            {cartCount > 0 && (
              <span style={{ position: "absolute", top: -6, insetInlineEnd: -8, background: C.ink, color: C.warm, fontSize: 10, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      {subcatsForActiveCat && (
        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            {subcatsForActiveCat.map((s) => (
              <div key={s} onMouseEnter={() => setHoveredSubcat(s)} onMouseLeave={() => setHoveredSubcat(null)} style={{ position: "relative" }}>
                <button
                  onClick={() => setView({ type: "browse", cat: activeCat, subcat: s })}
                  style={{ background: "none", border: "none", cursor: "pointer", outline: "none", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: activeSubcat === s ? 700 : 400, color: activeSubcat === s ? C.ink : C.muted, padding: "2px 0" }}
                >
                  {subcategoryLabel(s)}
                </button>
                {hoveredSubcat === s && ((PRODUCT_TYPES_BY_CATEGORY[activeCat] && PRODUCT_TYPES_BY_CATEGORY[activeCat][s]) || []).length > 0 && (
                  <div style={{ position: "absolute", top: "100%", insetInlineStart: 0, paddingTop: 10, zIndex: 30 }}>
                    <div style={{ background: C.warm, border: `1px solid ${C.line}`, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", minWidth: 200, maxHeight: 320, overflowY: "auto", padding: "10px 0" }}>
                      {PRODUCT_TYPES_BY_CATEGORY[activeCat][s].map((pt) => (
                        <button
                          key={pt}
                          onClick={() => { setView({ type: "browse", cat: activeCat, subcat: s, ptype: pt }); setHoveredSubcat(null); }}
                          style={{ display: "block", width: "100%", textAlign: "start", background: "none", border: "none", cursor: "pointer", padding: "8px 18px", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char, outline: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = C.sand)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          {productTypeLabel(pt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

const navBtn = { background: "none", border: "none", cursor: "pointer", color: C.char, padding: "4px 0" };
const boldNavBtn = { background: "none", border: "none", cursor: "pointer", color: C.char, padding: "6px 14px", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em", outline: "none", borderRadius: 3 };
const activeNavBtn = { ...boldNavBtn, background: C.ink, color: C.warm };
const inactiveNavBtn = boldNavBtn;

function Footer({ setView }) {
  const { t, categoryLabel } = useLang();
  return (
    <footer style={{ background: C.ink, color: C.sand, marginTop: 64 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, marginBottom: 8 }}>SADAAR</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, color: "#C5CDCE" }}>{t.footerTagline}</p>
          <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
            {/* Placeholder hrefs — replace with real profile URLs when ready */}
            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ color: "#C5CDCE", display: "flex" }}><FaInstagram size={19} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="TikTok" style={{ color: "#C5CDCE", display: "flex" }}><FaTiktok size={19} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Snapchat" style={{ color: "#C5CDCE", display: "flex" }}><FaSnapchat size={19} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="X" style={{ color: "#C5CDCE", display: "flex" }}><FaXTwitter size={19} /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ color: "#C5CDCE", display: "flex" }}><FaWhatsapp size={19} /></a>
          </div>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 2, color: "#C5CDCE" }}>
          <div style={{ color: C.sand, marginBottom: 6, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.footerShop}</div>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setView({ type: "browse", cat: c })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{categoryLabel(c)}</button>
          ))}
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 2, color: "#C5CDCE" }}>
          <div style={{ color: C.sand, marginBottom: 6, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.footerSadaar}</div>
          <button onClick={() => setView({ type: "browse" })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{t.shopAll}</button>
          <button onClick={() => setView({ type: "wishlist" })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{t.wishlistNav}</button>
          <button onClick={() => setView({ type: "track" })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{t.trackOrderNav}</button>
          <button onClick={() => setView({ type: "contact" })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{t.contactNav}</button>
          <button onClick={() => setView({ type: "account" })} style={{ display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "left" }}>{t.myAccount}</button>
          <a href="https://sadaar-brand-dashboard.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "none" }}>{t.brandSignIn}</a>
          <a href="https://sadaar-apply-brand.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "none" }}>{t.footerJoin}</a>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #253B3E", padding: "16px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => setView({ type: "faq" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#8A9598", fontFamily: "Inter, sans-serif", fontSize: 12 }}>FAQ</button>
          <button onClick={() => setView({ type: "terms" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#8A9598", fontFamily: "Inter, sans-serif", fontSize: 12 }}>Terms of Service</button>
          <button onClick={() => setView({ type: "privacy" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#8A9598", fontFamily: "Inter, sans-serif", fontSize: 12 }}>Privacy Policy</button>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8A9598", textAlign: "center" }}>{t.footerCopyright}</div>
      </div>
    </footer>
  );
}

function Home({ setView, openProduct, products, brands, loading, error, wishlistIds, onToggleWishlist }) {
  const featured = products.slice(0, 8);
  const { t, categoryLabel } = useLang();
  const [spotlights, setSpotlights] = useState([]);

  useEffect(() => {
    api("/spotlight/active").then(setSpotlights).catch(() => {});
  }, []);
  return (
    <div>
      <section className="sadaar-hero" style={{ position: "relative", height: "clamp(420px, 70vh, 640px)", overflow: "hidden", marginBottom: 8 }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        >
          <source src="https://zqkxqzzakahnewjjlufa.supabase.co/storage/v1/object/public/site-assets/fashion%20add.mp4" type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,40,46,0.25) 0%, rgba(20,40,46,0.6) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, height: "100%", maxWidth: 1180, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.bronze, marginBottom: 14 }}>{t.eyebrow}</p>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: "clamp(34px, 6vw, 64px)", lineHeight: 1.05, color: C.warm, margin: 0 }}>{t.heroTitle1}<br />{t.heroTitle2}</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, color: "#E7E2D3", marginTop: 20, maxWidth: 420, lineHeight: 1.6 }}>{t.heroSubtitle}</p>
          <button onClick={() => setView({ type: "browse" })} style={{ marginTop: 28, background: C.warm, color: C.ink, border: "none", padding: "13px 28px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", width: "fit-content" }}>{t.shopTheEdit}</button>
        </div>
      </section>

      {spotlights.length > 0 && (
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Sparkles size={16} color={C.bronze} />
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: C.ink, margin: 0 }}>{t.spotlight}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {spotlights.map((s) => (
              <button
                key={s.id}
                onClick={() => setView({ type: "browse", cat: s.category })}
                style={{ textAlign: "left", background: C.deep, color: C.sand, border: "none", padding: 20, cursor: "pointer" }}
              >
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.bronze, margin: 0 }}>{t.spotlight}</p>
                <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "6px 0" }}>{s.brand_name}</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#C5CDCE", margin: 0 }}>{s.brand_description}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <Loading label="Loading brands and products from SADAAR..." />}
      {error && <ErrorBox message={error} />}

      {!loading && !error && (
        <>
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink, margin: 0 }}>{t.curatedBrands}</h2>
              <button onClick={() => setView({ type: "brands" })} style={{ background: "none", border: "none", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.bronze, cursor: "pointer" }}>{t.viewAll}</button>
            </div>
            <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
              {brands.map((b) => (
                <div key={b.id} style={{ minWidth: 220, border: `1px solid ${C.line}`, padding: 18, background: C.warm }}>
                  <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 17, color: C.ink }}>{b.name}</p>
                  <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted }}>{b.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 8px", textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.bronze, marginBottom: 14 }}>{t.ourStory}</p>
            <h2 style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 500, fontSize: "clamp(22px, 3vw, 30px)", color: C.ink, lineHeight: 1.4, margin: "0 auto", maxWidth: 720 }}>
              {t.ourStoryText}
            </h2>
          </section>

          <section style={{ maxWidth: 1180, margin: "48px auto 0", padding: "36px 24px", background: C.deep, color: C.sand, display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, margin: 0 }}>{t.joinQuestion}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#C5CDCE", marginTop: 6 }}>{t.joinSubtext}</p>
            </div>
            <a href="https://sadaar-apply-brand.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ background: C.sand, color: C.ink, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              {t.applyToSell}
            </a>
          </section>

          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 8px" }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink, marginBottom: 18 }}>{t.thisWeeksEdit}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
              {featured.map((p) => <ProductCard key={p.id} product={p} onOpen={openProduct} wishlisted={wishlistIds.includes(p.id)} onToggleWishlist={onToggleWishlist} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Browse({ initialCat, initialSubcat, initialPtype, openProduct, brands, wishlistIds, onToggleWishlist }) {
  const [cat, setCat] = useState(initialCat || "all");
  const [subcat, setSubcat] = useState(initialSubcat || "all");
  const [ptype, setPtype] = useState(initialPtype || "all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState("featured");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t, categoryLabel, subcategoryLabel, productTypeLabel } = useLang();
  const isFirstCatRender = React.useRef(true);
  const isFirstSubcatRender = React.useRef(true);

  // Reset subcategory whenever the top-level category changes, and reset
  // product type whenever the subcategory changes — each level depends on
  // the one above it. Skip the very first run so an initialSubcat/initialPtype
  // passed in (e.g. from the header's dropdown) doesn't get immediately wiped.
  useEffect(() => {
    if (isFirstCatRender.current) { isFirstCatRender.current = false; return; }
    setSubcat("all");
  }, [cat]);
  useEffect(() => {
    if (isFirstSubcatRender.current) { isFirstSubcatRender.current = false; return; }
    setPtype("all");
  }, [subcat]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (cat !== "all") params.set("category", cat);
      if (subcat !== "all") params.set("subcategory", subcat);
      if (ptype !== "all") params.set("productType", ptype);
      if (brand !== "all") params.set("brandId", brand);
      if (sort !== "featured") params.set("sort", sort);
      if (search.trim()) params.set("search", search.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      api(`/products?${params.toString()}`)
        .then(setProducts)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 350); // debounce so typing in search/price doesn't fire a request per keystroke
    return () => clearTimeout(handle);
  }, [cat, subcat, ptype, brand, sort, search, minPrice, maxPrice]);

  const activeFilterCount = [
    cat !== "all", subcat !== "all", ptype !== "all", brand !== "all", search.trim(), minPrice, maxPrice,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCat("all"); setSubcat("all"); setPtype("all"); setBrand("all"); setSort("featured"); setSearch(""); setMinPrice(""); setMaxPrice("");
  };

  return (
    <div className="sadaar-browse-layout" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 64px", display: "flex", gap: 32 }}>
      <aside className="sadaar-browse-sidebar" style={{ width: 200, flexShrink: 0 }}>
        <div className="sadaar-browse-filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          style={{ width: "100%", border: `1px solid ${C.line}`, padding: "8px 10px", fontFamily: "Inter, sans-serif", fontSize: 13, background: C.warm, color: C.char, marginBottom: 20, boxSizing: "border-box" }}
        />

        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>{t.category}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {["all", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: cat === c ? C.ink : C.muted, fontWeight: cat === c ? 600 : 400 }}>{c === "all" ? t.all : categoryLabel(c)}</button>
          ))}
        </div>
        {cat !== "all" && (SUBCATEGORIES_BY_CATEGORY[cat] || []).length > 0 && (
          <>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>{categoryLabel(cat)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              {["all", ...SUBCATEGORIES_BY_CATEGORY[cat]].map((s) => (
                <button key={s} onClick={() => setSubcat(s)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: subcat === s ? C.ink : C.muted, fontWeight: subcat === s ? 600 : 400 }}>{s === "all" ? t.all : subcategoryLabel(s)}</button>
              ))}
            </div>
          </>
        )}
        {subcat !== "all" && ((PRODUCT_TYPES_BY_CATEGORY[cat] && PRODUCT_TYPES_BY_CATEGORY[cat][subcat]) || []).length > 0 && (
          <>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>{subcategoryLabel(subcat)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              {["all", ...PRODUCT_TYPES_BY_CATEGORY[cat][subcat]].map((pt) => (
                <button key={pt} onClick={() => setPtype(pt)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: ptype === pt ? C.ink : C.muted, fontWeight: ptype === pt ? 600 : 400 }}>{pt === "all" ? t.all : productTypeLabel(pt)}</button>
              ))}
            </div>
          </>
        )}
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>{t.brand}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {[{ id: "all", name: t.all }, ...brands].map((b) => (
            <button key={b.id} onClick={() => setBrand(String(b.id))} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: brand === String(b.id) ? C.ink : C.muted, fontWeight: brand === String(b.id) ? 600 : 400 }}>{b.name}</button>
          ))}
        </div>

        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>{t.price}</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" placeholder={t.min} style={{ width: "50%", border: `1px solid ${C.line}`, padding: "7px 8px", fontFamily: "Inter, sans-serif", fontSize: 13, background: C.warm, color: C.char, boxSizing: "border-box" }} />
          <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" placeholder={t.max} style={{ width: "50%", border: `1px solid ${C.line}`, padding: "7px 8px", fontFamily: "Inter, sans-serif", fontSize: 13, background: C.warm, color: C.char, boxSizing: "border-box" }} />
        </div>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.bronze, textDecoration: "underline" }}>
            {t.clearFilters} ({activeFilterCount})
          </button>
        )}
        </div>
      </aside>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{loading ? "..." : `${products.length} ${t.pieces}`}</p>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ fontFamily: "Inter, sans-serif", fontSize: 13, border: `1px solid ${C.line}`, padding: "6px 10px", background: C.warm, color: C.char }}>
            <option value="featured">{t.sortNewest}</option>
            <option value="price-asc">{t.sortPriceAsc}</option>
            <option value="price-desc">{t.sortPriceDesc}</option>
            <option value="name-asc">{t.sortNameAsc}</option>
          </select>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
            {products.map((p) => <ProductCard key={p.id} product={p} onOpen={openProduct} wishlisted={wishlistIds.includes(p.id)} onToggleWishlist={onToggleWishlist} />)}
          </div>
        )}
        {!loading && !error && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontFamily: "Inter, sans-serif", color: C.muted, marginBottom: 12 }}>{t.noMatches}</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} style={{ background: "none", border: `1px solid ${C.line}`, padding: "8px 16px", fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer", color: C.char }}>{t.clearFilters}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Gallery({ product }) {
  const images = product.images || [];
  const [activeIdx, setActiveIdx] = useState(0);

  if (images.length === 0) {
    return <Swatch product={product} height={460} />;
  }

  return (
    <div>
      <Swatch product={product} height={460} imageUrl={images[activeIdx].url} />
      {images.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto" }}>
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIdx(idx)}
              style={{ padding: 0, border: `2px solid ${idx === activeIdx ? C.ink : "transparent"}`, background: "none", cursor: "pointer", flexShrink: 0 }}
            >
              <img src={img.url} alt="" style={{ width: 60, height: 60, objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetail({ productId, onBack, onAddToCart, wishlisted, onToggleWishlist, openProduct, wishlistIds, openBrand }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [related, setRelated] = useState([]);
  const { t, categoryLabel, subcategoryLabel, productTypeLabel } = useLang();

  useEffect(() => {
    setLoading(true);
    setRelated([]);
    api(`/products/${productId}`)
      .then((p) => {
        setProduct(p);
        setVariantId(p.variants?.[0]?.id ?? null);
        setPageMeta(`${p.name} by ${p.brand_name} — SADAAR`, p.description ? p.description.slice(0, 160) : `${p.name} from ${p.brand_name}, available on SADAAR.`);
        api(`/products?category=${encodeURIComponent(p.category)}`)
          .then((list) => setRelated(list.filter((item) => item.id !== p.id).slice(0, 4)))
          .catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}><Loading /></div>;
  if (error) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}><ErrorBox message={error} /></div>;
  if (!product) return null;

  const variant = product.variants.find((v) => v.id === variantId);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 64px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}><ChevronLeft size={16} /> {t.back}</button>
        <button onClick={() => onToggleWishlist(product.id)} aria-label="Toggle wishlist" style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Heart size={16} color={C.ink} fill={wishlisted ? C.ink : "none"} />
        </button>
      </div>
      <div className="sadaar-product-layout" style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
        <div className="sadaar-product-image" style={{ flex: "1 1 380px" }}><Gallery product={product} /></div>
        <div style={{ flex: "1 1 320px" }}>
          <button onClick={() => openBrand && openBrand(product.brand_slug)} style={{ background: "none", border: "none", cursor: openBrand ? "pointer" : "default", padding: 0, fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze, textDecoration: openBrand ? "underline" : "none" }}>{product.brand_name}</button>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 30, color: C.ink, margin: "6px 0" }}>{product.name}</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginBottom: 12 }}>{categoryLabel(product.category)}{product.subcategory ? ` · ${subcategoryLabel(product.subcategory)}` : ""}{product.product_type ? ` · ${productTypeLabel(product.product_type)}` : ""}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 18, color: C.char, marginBottom: 20 }}>{money(product.price)}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>{product.description}</p>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>{t.size}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
            {product.variants.map((v) => (
              <button key={v.id} disabled={v.stock_qty === 0} onClick={() => setVariantId(v.id)} style={{ padding: "8px 14px", border: `1px solid ${variantId === v.id ? C.ink : C.line}`, background: variantId === v.id ? C.ink : "none", color: v.stock_qty === 0 ? C.line : variantId === v.id ? C.warm : C.char, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: v.stock_qty === 0 ? "not-allowed" : "pointer" }}>
                {v.size}{v.stock_qty === 0 ? ` (${t.soldOut})` : ""}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, margin: 0 }}>{t.qty}</p>
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}` }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}><Minus size={14} /></button>
              <span style={{ padding: "0 10px", fontFamily: "Inter, sans-serif", fontSize: 14 }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}><Plus size={14} /></button>
            </div>
          </div>

          <button
            disabled={!variant || variant.stock_qty === 0}
            onClick={() => { onAddToCart(product, variant, qty); setAdded(true); setTimeout(() => setAdded(false), 1600); }}
            style={{ width: "100%", background: !variant || variant.stock_qty === 0 ? C.line : C.ink, color: C.warm, border: "none", padding: "14px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: !variant || variant.stock_qty === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {added ? <><Check size={16} /> {t.addedToCart}</> : variant?.stock_qty === 0 ? t.soldOut : t.addToCart}
          </button>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>{t.shippedBy(product.brand_name)}</p>
        </div>
      </div>

      {related.length > 0 && openProduct && (
        <div style={{ marginTop: 56 }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: C.ink, marginBottom: 18 }}>{t.youMightAlsoLike}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "24px 20px" }}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={openProduct} wishlisted={(wishlistIds || []).includes(p.id)} onToggleWishlist={onToggleWishlist} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cart({ items, updateQty, removeItem, setView }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = estimateShipping(items);
  const { t } = useLang();
  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <ShoppingBag size={32} color={C.line} style={{ marginBottom: 16 }} />
        <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink }}>{t.bagEmpty}</p>
        <button onClick={() => setView({ type: "browse" })} style={{ marginTop: 16, background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{t.shopTheEdit}</button>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 24 }}>{t.yourBag}</h1>
      {items.map((item, idx) => (
        <div key={idx} className="sadaar-cart-row" style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ width: 100, flexShrink: 0 }}><Swatch product={item.product} height={120} /></div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{item.product.brand_name}</p>
            <p style={{ margin: "4px 0", fontFamily: "Fraunces, serif", fontSize: 16, color: C.ink }}>{item.product.name}</p>
            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{t.size} {item.variant.size}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}` }}>
                <button onClick={() => updateQty(idx, -1)} style={{ background: "none", border: "none", padding: "4px 8px", cursor: "pointer" }}><Minus size={12} /></button>
                <span style={{ padding: "0 8px", fontSize: 13, fontFamily: "Inter, sans-serif" }}>{item.qty}</span>
                <button onClick={() => updateQty(idx, 1)} style={{ background: "none", border: "none", padding: "4px 8px", cursor: "pointer" }}><Plus size={12} /></button>
              </div>
              <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "underline" }}>{t.remove}</button>
            </div>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.ink, fontWeight: 500 }}>{money(item.product.price * item.qty)}</p>
        </div>
      ))}
      <div style={{ padding: "20px 0", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 15, color: C.char, margin: 0 }}>{t.subtotal}</p>
          <p style={{ fontSize: 15, color: C.ink, margin: 0 }}>{money(subtotal)}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 15, color: C.char, margin: 0 }}>{t.shipping}</p>
          <p style={{ fontSize: 15, color: shipping === 0 ? "#2F5B3C" : C.ink, margin: 0 }}>{shipping === 0 ? t.free : money(shipping)}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
          <p style={{ fontSize: 15, color: C.char, fontWeight: 600, margin: 0 }}>{t.estimatedTotal}</p>
          <p style={{ fontSize: 15, color: C.ink, fontWeight: 600, margin: 0 }}>{money(subtotal + shipping)}</p>
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginTop: 10 }}>{t.shippingNote(SHIPPING_FEE_PER_BRAND, FREE_SHIPPING_THRESHOLD)}</p>
      </div>
      <button onClick={() => setView({ type: "checkout" })} style={{ width: "100%", background: C.ink, color: C.warm, border: "none", padding: "15px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{t.checkout}</button>
    </div>
  );
}

function Checkout({ items, setView, clearCart, customerToken, customerInfo }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = estimateShipping(items);
  const { t } = useLang();
  const [form, setForm] = useState({ fullName: customerInfo?.fullName || "", email: customerInfo?.email || "", phone: "", city: "", address: "" });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null); // set once the (unpaid) order is created
  const [paid, setPaid] = useState(false);
  const [publishableKey, setPublishableKey] = useState(null);
  const formRef = React.useRef(null);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

  useEffect(() => {
    if (customerToken) {
      api("/customers/me/addresses", {}, customerToken)
        .then((addrs) => {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.is_default) || addrs[0];
          if (def) applySavedAddress(def);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerToken]);

  const applySavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setForm((f) => ({ ...f, fullName: addr.full_name, phone: addr.phone || "", city: addr.city, address: addr.address }));
  };

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null); // { code, discountAmount }
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setCheckingPromo(true);
    setPromoError("");
    try {
      const result = await api("/discounts/validate", { method: "POST", body: JSON.stringify({ code: promoInput.trim(), subtotal }) });
      setPromo(result);
    } catch (e) {
      setPromo(null);
      setPromoError(e.message);
    } finally {
      setCheckingPromo(false);
    }
  };

  const removePromo = () => { setPromo(null); setPromoInput(""); setPromoError(""); };

  const discountAmount = promo?.discountAmount || 0;
  const total = subtotal + shipping - discountAmount;

  useEffect(() => {
    api("/config/moyasar").then((c) => setPublishableKey(c.publishableKey)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    if (!form.fullName || !form.phone || !form.city || !form.address) {
      setError(t.fillAllFields);
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const result = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({ variantId: i.variant.id, quantity: i.qty })),
          discountCode: promo?.code || undefined,
        }),
      }, customerToken);
      setOrder(result);
      if (customerToken && saveNewAddress && !selectedAddressId) {
        api("/customers/me/addresses", {
          method: "POST",
          body: JSON.stringify({ fullName: form.fullName, phone: form.phone, city: form.city, address: form.address, isDefault: savedAddresses.length === 0 }),
        }, customerToken).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPlacing(false);
    }
  };

  const [debugMsg, setDebugMsg] = useState("");

  // Once we have an unpaid order and Moyasar's key, mount their hosted card form.
  useEffect(() => {
    if (!order || !publishableKey || paid) return;
    setDebugMsg("Loading payment form script...");

    // 3D Secure does a full page redirect + reload, wiping React state. Save what
    // we need to localStorage so the app can pick up where it left off after
    // the redirect back (see the top-level check in SadaarMarketplace below).
    localStorage.setItem("sadaar_pending_order", JSON.stringify({ orderId: order.orderId, total: order.total }));

    const existing = document.querySelector('script[src*="moyasar.js"]');
    const mount = () => {
      try {
        if (!document.querySelector(".mysr-form")) {
          setDebugMsg("Error: .mysr-form element not found in page yet.");
          return;
        }
        if (!window.Moyasar) {
          setDebugMsg("Error: Moyasar script loaded but window.Moyasar is undefined.");
          return;
        }
        window.Moyasar.init({
          element: ".mysr-form",
          amount: Math.round(order.total * 100),
          currency: "SAR",
          description: `SADAAR order #${order.orderId}`,
          publishable_api_key: publishableKey,
          callback_url: window.location.origin + window.location.pathname,
          methods: ["creditcard"],
          metadata: { orderId: String(order.orderId) },
          on_completed: async (payment) => {
            try {
              await api(`/orders/${order.orderId}/confirm-payment`, {
                method: "POST",
                body: JSON.stringify({ paymentId: payment.id }),
              });
              setPaid(true);
              clearCart();
            } catch (e) {
              setError(e.message);
            }
          },
        });
        setDebugMsg("");
      } catch (err) {
        setDebugMsg(`Error initializing payment form: ${err.name}: ${err.message}`);
      }
    };

    if (existing && window.Moyasar) {
      mount();
      return;
    }

    const linkEl = document.createElement("link");
    linkEl.rel = "stylesheet";
    linkEl.href = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.css";
    document.head.appendChild(linkEl);

    const script = document.createElement("script");
    script.src = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.js";
    script.onload = () => { setDebugMsg("Script loaded, initializing form..."); mount(); };
    script.onerror = () => setDebugMsg("Error: failed to load moyasar.js from CDN (network/blocked?).");
    document.body.appendChild(script);
  }, [order, publishableKey, paid]);

  if (paid) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <Check size={30} color={C.ink} style={{ marginBottom: 16 }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 8 }}>{t.paymentReceived}</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, marginBottom: 4 }}>Order #{order.orderId} — {money(order.total)}</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>{t.paymentReceivedNote}</p>
        <button onClick={() => setView({ type: "home" })} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{t.backToSadaar}</button>
      </div>
    );
  }

  // Order exists (unpaid) — show the real card form.
  if (order) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 6 }}>{t.payment}</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 20 }}>Order #{order.orderId} — {money(order.total)}</p>
        {!publishableKey && <ErrorBox message={t.paymentGatewayMissing} />}
        {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {debugMsg && <p style={{ color: C.muted, fontFamily: "monospace", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{debugMsg}</p>}
        <div className="mysr-form" ref={formRef} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 6 }}>{t.checkout}</h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>{t.checkoutSubtitle}</p>

      {customerToken && savedAddresses.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>{t.useSavedAddress}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {savedAddresses.map((a) => (
              <button key={a.id} onClick={() => applySavedAddress(a)} style={{ textAlign: "left", background: selectedAddressId === a.id ? C.sand : "none", border: `1px solid ${selectedAddressId === a.id ? C.ink : C.line}`, padding: "10px 12px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char }}>
                {a.label ? `${a.label} — ` : ""}{a.full_name}, {a.address}, {a.city}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginTop: 10 }}>{t.orNewAddress}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <input placeholder={t.fullName} value={form.fullName} onChange={set("fullName")} style={inputStyle} />
        <input placeholder={t.emailOptional} value={form.email} onChange={set("email")} style={inputStyle} />
        <input placeholder={t.phoneNumber} value={form.phone} onChange={set("phone")} style={inputStyle} />
        <input placeholder={t.city} value={form.city} onChange={set("city")} style={inputStyle} />
        <input placeholder={t.address} value={form.address} onChange={set("address")} style={inputStyle} />
        {customerToken && !selectedAddressId && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char }}>
            <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} />
            {t.saveThisAddress}
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {promo ? (
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid #2F5B3C`, padding: "10px 12px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#2F5B3C" }}>
            <span>{t.codeApplied(promo.code)}</span>
            <button onClick={removePromo} style={{ background: "none", border: "none", cursor: "pointer", color: "#2F5B3C", textDecoration: "underline", fontSize: 12 }}>{t.remove}</button>
          </div>
        ) : (
          <>
            <input placeholder={t.promoCode} value={promoInput} onChange={(e) => setPromoInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={applyPromo} disabled={checkingPromo} style={{ background: "none", border: `1px solid ${C.ink}`, padding: "0 18px", fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer", color: C.char }}>
              {checkingPromo ? t.checking : t.apply}
            </button>
          </>
        )}
      </div>
      {promoError && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, marginBottom: 12 }}>{promoError}</p>}

      {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>{t.subtotal}</p>
          <p style={{ fontSize: 14, color: C.char, margin: 0 }}>{money(subtotal)}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>{t.shipping}</p>
          <p style={{ fontSize: 14, color: shipping === 0 ? "#2F5B3C" : C.char, margin: 0 }}>{shipping === 0 ? t.free : money(shipping)}</p>
        </div>
        {discountAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 14, color: "#2F5B3C", margin: 0 }}>{t.discount}</p>
            <p style={{ fontSize: 14, color: "#2F5B3C", margin: 0 }}>-{money(discountAmount)}</p>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: 15 }}>{t.totalDue}</p>
          <p style={{ fontSize: 15, fontWeight: 600 }}>{money(total)}</p>
        </div>
      </div>
      <button onClick={placeOrder} disabled={placing} style={{ width: "100%", background: C.ink, color: C.warm, border: "none", padding: "15px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: placing ? "default" : "pointer", opacity: placing ? 0.7 : 1, marginTop: 16 }}>
        {placing ? t.placingOrder : t.continueToPayment}
      </button>
    </div>
  );
}

const inputStyle = { border: `1px solid ${C.line}`, padding: "12px 14px", fontFamily: "Inter, sans-serif", fontSize: 14, background: C.warm, color: C.char };

function Wishlist({ wishlistIds, onToggleWishlist, openProduct, setView }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  useEffect(() => {
    if (wishlistIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(wishlistIds.map((id) => api(`/products/${id}`).catch(() => null)))
      .then((results) => setProducts(results.filter(Boolean)))
      .finally(() => setLoading(false));
  }, [wishlistIds]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 24 }}>{t.yourWishlist}</h1>
      {loading && <Loading />}
      {!loading && products.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <Heart size={28} color={C.line} style={{ marginBottom: 14 }} />
          <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: C.ink }}>{t.nothingSaved}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 16 }}>{t.nothingSavedSubtext}</p>
          <button onClick={() => setView({ type: "browse" })} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{t.shopTheEdit}</button>
        </div>
      )}
      {!loading && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={openProduct} wishlisted={true} onToggleWishlist={onToggleWishlist} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrandProfilePage({ slug, openProduct, wishlistIds, onToggleWishlist }) {
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("shop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useLang();

  useEffect(() => {
    setLoading(true);
    setError(null);
    api(`/brands/${slug}`)
      .then((b) => {
        setBrand(b);
        setPageMeta(`${b.name} — SADAAR`, b.description ? b.description.slice(0, 160) : `Shop ${b.name} on SADAAR.`);
        return api(`/products?brandId=${b.id}`);
      })
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px" }}><Loading /></div>;
  if (error || !brand) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px" }}><ErrorBox message={error || "Brand not found."} /></div>;

  const socialLinks = [
    { url: brand.instagram_url, Icon: FaInstagram, label: "Instagram" },
    { url: brand.tiktok_url, Icon: FaTiktok, label: "TikTok" },
    { url: brand.snapchat_url, Icon: FaSnapchat, label: "Snapchat" },
    { url: brand.x_url, Icon: FaXTwitter, label: "X" },
    { url: brand.whatsapp_url, Icon: FaWhatsapp, label: "WhatsApp" },
  ].filter((s) => s.url);

  return (
    <div>
      <div style={{ background: C.deep, color: C.sand, padding: "48px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: "clamp(28px, 4vw, 40px)", margin: 0 }}>{brand.name}</h1>
          {brand.origin_city && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#C5CDCE", marginTop: 8 }}>{t.basedIn(brand.origin_city)}</p>}
          {brand.description && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#C5CDCE", marginTop: 12, maxWidth: 560, lineHeight: 1.6 }}>{brand.description}</p>}
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.warm }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", display: "flex", gap: 24 }}>
          <button onClick={() => setTab("shop")} style={{ background: "none", border: "none", borderBottom: tab === "shop" ? `2px solid ${C.ink}` : "2px solid transparent", padding: "14px 0", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: tab === "shop" ? C.ink : C.muted }}>{t.shopTab}</button>
          <button onClick={() => setTab("about")} style={{ background: "none", border: "none", borderBottom: tab === "about" ? `2px solid ${C.ink}` : "2px solid transparent", padding: "14px 0", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: tab === "about" ? C.ink : C.muted }}>{t.aboutTab}</button>
        </div>
      </div>

      {tab === "shop" && (
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 64px" }}>
          {products.length === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", color: C.muted }}>No products yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
              {products.map((p) => <ProductCard key={p.id} product={p} onOpen={openProduct} wishlisted={wishlistIds.includes(p.id)} onToggleWishlist={onToggleWishlist} />)}
            </div>
          )}
        </div>
      )}

      {tab === "about" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 64px" }}>
          {brand.founder_story && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze, marginBottom: 10 }}>{t.founderStory}</p>
              <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{brand.founder_story}</p>
            </div>
          )}
          {brand.brand_philosophy && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze, marginBottom: 10 }}>{t.brandPhilosophy}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, color: C.char, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{brand.brand_philosophy}</p>
            </div>
          )}

          {brand.signatureProducts && brand.signatureProducts.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze, marginBottom: 14 }}>{t.signatureProducts}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                {brand.signatureProducts.map((p) => (
                  <button key={p.id} onClick={() => openProduct(p.id)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <Swatch product={p} height={140} />
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.ink, marginTop: 8 }}>{p.name}</p>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, margin: "2px 0 0" }}>{money(p.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(socialLinks.length > 0 || brand.website_url) && (
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze, marginBottom: 12 }}>{t.followUs}</p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {socialLinks.map(({ url, Icon, label }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ color: C.ink, display: "flex" }}><Icon size={20} /></a>
                ))}
                {brand.website_url && (
                  <a href={brand.website_url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "none" }}>
                    <Globe size={18} /> {t.visitWebsite}
                  </a>
                )}
              </div>
            </div>
          )}

          {!brand.founder_story && !brand.brand_philosophy && (!brand.signatureProducts || brand.signatureProducts.length === 0) && socialLinks.length === 0 && !brand.website_url && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted }}>This brand hasn't added their story yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AccountAuth({ onLogin, initialResetToken, setView }) {
  const { t } = useLang();
  const [mode, setMode] = useState(initialResetToken ? "reset" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api("/customers/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onLogin(result.token, result.customer);
      setView({ type: "account" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError(t.passwordsDontMatch);
    setLoading(true);
    try {
      const result = await api("/customers/signup", { method: "POST", body: JSON.stringify({ fullName, email, password }) });
      onLogin(result.token, result.customer);
      setView({ type: "account" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitResetRequest = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/customers/request-password-reset", { method: "POST", body: JSON.stringify({ email: resetEmail }) });
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/customers/reset-password", { method: "POST", body: JSON.stringify({ token: initialResetToken, password: newPassword }) });
      setResetDone(true);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 20 }}>{mode === "signup" ? t.signUp : t.myAccount}</h1>

      {mode === "login" && (
        <>
          <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailField} style={inputStyle} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t.passwordField} style={inputStyle} />
            {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ background: C.ink, color: C.warm, border: "none", padding: "13px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "..." : t.logIn}
            </button>
          </form>
          <button onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "underline", marginTop: 14, padding: 0, display: "block" }}>
            {t.forgotPassword}
          </button>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginTop: 20 }}>
            {t.noAccountYet} <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, fontWeight: 600, padding: 0, fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "underline" }}>{t.signUp}</button>
          </p>
        </>
      )}

      {mode === "signup" && (
        <>
          <form onSubmit={submitSignup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.fullNameField} style={inputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailField} style={inputStyle} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t.passwordField} style={inputStyle} />
            <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder={t.confirmPasswordField} style={inputStyle} />
            {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ background: C.ink, color: C.warm, border: "none", padding: "13px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "..." : t.signUp}
            </button>
          </form>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginTop: 20 }}>
            {t.haveAccount} <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, fontWeight: 600, padding: 0, fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "underline" }}>{t.logIn}</button>
          </p>
        </>
      )}

      {mode === "forgot" && !resetSent && (
        <form onSubmit={submitResetRequest} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder={t.emailField} style={inputStyle} />
          {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: C.ink, color: C.warm, border: "none", padding: "13px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "..." : t.forgotPassword}
          </button>
          <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "underline", padding: 0 }}>{t.logIn}</button>
        </form>
      )}
      {mode === "forgot" && resetSent && (
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char }}>If that email has a SADAAR account, a reset link is on its way.</p>
        </div>
      )}

      {mode === "reset" && !resetDone && (
        <form onSubmit={submitNewPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder={t.passwordField} style={inputStyle} />
          {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: C.ink, color: C.warm, border: "none", padding: "13px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "..." : "Save"}
          </button>
        </form>
      )}
      {mode === "reset" && resetDone && (
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char, marginBottom: 12 }}>Password updated.</p>
          <button onClick={() => setMode("login")} style={{ background: C.ink, color: C.warm, border: "none", padding: "10px 20px", fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" }}>{t.logIn}</button>
        </div>
      )}
    </div>
  );
}

function Account({ customerInfo, customerToken, onLogout }) {
  const { t } = useLang();
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addrForm, setAddrForm] = useState({ label: "", fullName: "", phone: "", city: "", address: "", isDefault: false });
  const [savingAddr, setSavingAddr] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api("/customers/me/orders", {}, customerToken),
      api("/customers/me/addresses", {}, customerToken),
    ]).then(([o, a]) => { setOrders(o); setAddresses(a); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, [customerToken]);

  const addAddress = async (e) => {
    e.preventDefault();
    setSavingAddr(true);
    setError("");
    try {
      await api("/customers/me/addresses", { method: "POST", body: JSON.stringify(addrForm) }, customerToken);
      setAddrForm({ label: "", fullName: "", phone: "", city: "", address: "", isDefault: false });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAddr(false);
    }
  };

  const deleteAddress = async (id) => {
    try {
      await api(`/customers/me/addresses/${id}`, { method: "DELETE" }, customerToken);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px 64px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, margin: 0 }}>{t.myAccount}</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginTop: 4 }}>{customerInfo?.fullName} — {customerInfo?.email}</p>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.line}`, padding: "8px 16px", fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer", color: C.char }}>{t.logOut}</button>
      </div>

      <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${C.line}`, marginBottom: 24 }}>
        {[["orders", t.orderHistory], ["addresses", t.savedAddresses]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? `2px solid ${C.ink}` : "2px solid transparent", padding: "10px 0", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: tab === id ? C.ink : C.muted }}>{label}</button>
        ))}
      </div>

      {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {loading && <Loading />}

      {!loading && tab === "orders" && (
        orders.length === 0 ? <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{t.noOrdersYet}</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ border: `1px solid ${C.line}`, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: C.ink, margin: 0 }}>Order #{o.id}</p>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, textTransform: "uppercase", color: o.payment_status === "paid" ? "#2F5B3C" : C.muted }}>{o.payment_status}</span>
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, margin: "4px 0 10px" }}>{new Date(o.created_at).toLocaleDateString()} — {money(o.total)}</p>
                {o.items.map((i) => (
                  <p key={i.id} style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char, margin: "2px 0" }}>{i.product_name} × {i.quantity} — {i.brand_name}</p>
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === "addresses" && (
        <div>
          {addresses.length === 0 ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 20 }}>{t.noAddressesYet}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {addresses.map((a) => (
                <div key={a.id} style={{ border: `1px solid ${C.line}`, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    {a.label && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.bronze, margin: 0 }}>{a.label}{a.is_default ? ` · ${t.defaultBadge}` : ""}</p>}
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.ink, margin: "4px 0 0" }}>{a.full_name}</p>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, margin: "2px 0 0" }}>{a.address}, {a.city}</p>
                  </div>
                  <button onClick={() => deleteAddress(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={16} /></button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addAddress} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
            <input value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} placeholder={t.addressLabel} style={inputStyle} />
            <input value={addrForm.fullName} onChange={(e) => setAddrForm((f) => ({ ...f, fullName: e.target.value }))} placeholder={t.fullNameField} style={inputStyle} />
            <input value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t.phoneNumber} style={inputStyle} />
            <input value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} placeholder={t.city} style={inputStyle} />
            <input value={addrForm.address} onChange={(e) => setAddrForm((f) => ({ ...f, address: e.target.value }))} placeholder={t.address} style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.char }}>
              <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} />
              {t.setAsDefault}
            </label>
            <button type="submit" disabled={savingAddr} style={{ background: C.ink, color: C.warm, border: "none", padding: "11px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: savingAddr ? 0.7 : 1 }}>
              {savingAddr ? "..." : t.addAddress}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const legalH1 = { fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 8 };
const legalH2 = { fontFamily: "Fraunces, serif", fontSize: 17, color: C.ink, marginTop: 28, marginBottom: 8 };
const legalP = { fontFamily: "Inter, sans-serif", fontSize: 14, color: C.char, lineHeight: 1.7, marginBottom: 10 };
const legalMeta = { fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginBottom: 24 };

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, padding: "16px 0" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Fraunces, serif", fontSize: 16, color: C.ink, padding: 0 }}>
        {q}
        <Plus size={16} style={{ transform: open ? "rotate(45deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0, marginLeft: 12 }} />
      </button>
      {open && <p style={{ ...legalP, marginTop: 10, marginBottom: 0 }}>{a}</p>}
    </div>
  );
}

function FAQ({ setView }) {
  const faqs = [
    { q: "How does SADAAR work?", a: "SADAAR is a marketplace for independent Saudi fashion brands. Each brand keeps full ownership of their inventory and ships orders themselves — SADAAR provides the storefront, checkout, and customer support so you can shop many brands in one place." },
    { q: "How is shipping calculated?", a: "Shipping is charged per brand — SAR 25 per brand shipment, free once that brand's items in your order total SAR 300 or more. If your order includes items from two brands, you'll see two shipping charges (unless one or both qualify for free shipping)." },
    { q: "How long does delivery take?", a: "Estimated delivery is 3–5 business days from when a brand ships your order. Each brand fulfills independently, so items from different brands in the same order may arrive separately." },
    { q: "Can I cancel or return an order?", a: "You can request a cancellation for any item that hasn't shipped yet, from the Track Order page. Once the brand approves it, you'll be refunded to your original payment method. Items that have already shipped can't be cancelled through the site — contact us and we'll help." },
    { q: "What payment methods are accepted?", a: "Payments are processed securely through Moyasar, supporting major credit and debit cards. SADAAR never sees or stores your full card details." },
    { q: "Do I need an account to order?", a: "No — guest checkout is always available. Creating a free account lets you save addresses, sync your wishlist across devices, and see your full order history in one place." },
    { q: "How do I track my order?", a: "Use the Track Order page with your order number and the email or phone number you used at checkout — or, if you have an account, your full order history is available under My Account." },
    { q: "How do discount codes work?", a: "Enter a valid code at checkout to see the discount applied to your order total before payment. Codes may have a minimum order amount, an expiry date, or a limited number of uses." },
    { q: "I'm a designer — how do I sell on SADAAR?", a: "Use the \"Apply to sell\" link in the footer to submit your brand for review. Our team reviews every application personally, usually within a few business days." },
    { q: "Does SADAAR ship outside Saudi Arabia?", a: "Not at this time — SADAAR currently serves customers within Saudi Arabia only." },
  ];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={legalH1}>Frequently Asked Questions</h1>
      <p style={legalMeta}>Can't find what you're looking for? <button onClick={() => setView({ type: "contact" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.bronze, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "underline" }}>Contact us</button> and we'll help directly.</p>
      <div>
        {faqs.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
      </div>
    </div>
  );
}

function Terms() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={legalH1}>Terms of Service</h1>
      <p style={legalMeta}>Last updated: July 2026. This is a starting draft prepared for SADAAR and has not yet been reviewed by a licensed attorney — it should be reviewed before being relied on as SADAAR's final, binding terms.</p>

      <h2 style={legalH2}>1. About SADAAR</h2>
      <p style={legalP}>SADAAR ("we," "us," "the platform") operates an online marketplace connecting customers with independent Saudi fashion brands ("brands," "sellers"). Each brand listed on SADAAR is an independent business that owns, lists, and fulfills its own products. SADAAR facilitates the storefront, checkout, and payment processing, and provides customer support, but is not the manufacturer or seller of record for products sold by brands on the platform.</p>

      <h2 style={legalH2}>2. Accounts</h2>
      <p style={legalP}>You may browse and purchase as a guest, or create a free account. If you create an account, you're responsible for keeping your login credentials secure and for all activity under your account. You must provide accurate information when creating an account or placing an order.</p>

      <h2 style={legalH2}>3. Orders and Payment</h2>
      <p style={legalP}>All prices are listed in Saudi Riyals (SAR) and are set independently by each brand. Placing an order is an offer to purchase, which SADAAR (on behalf of the relevant brand) may accept or decline — for example if an item is out of stock or pricing was listed in error. Payment is processed securely through Moyasar at the time of order. SADAAR does not store your full card details.</p>

      <h2 style={legalH2}>4. Shipping and Delivery</h2>
      <p style={legalP}>Each brand is responsible for fulfilling and shipping its own items. Shipping fees are calculated per brand and shown at checkout. Estimated delivery times are provided for guidance and are not guaranteed. If your order includes items from multiple brands, they may be shipped and delivered separately.</p>

      <h2 style={legalH2}>5. Cancellations and Refunds</h2>
      <p style={legalP}>You may request cancellation of any order item that has not yet shipped, through the Track Order page or your account's order history. The relevant brand reviews each request. If approved, the item's value is refunded to your original payment method; shipping charges are non-refundable for partial cancellations. Once an item has shipped, it can no longer be cancelled through the site — contact SADAAR support for help with returns or issues after delivery.</p>

      <h2 style={legalH2}>6. Discount Codes</h2>
      <p style={legalP}>Discount codes have no cash value, cannot be combined unless stated otherwise, and may be limited by minimum order value, expiry date, or number of uses. SADAAR reserves the right to deactivate a code or refuse its use in cases of suspected misuse.</p>

      <h2 style={legalH2}>7. Brands Selling on SADAAR</h2>
      <p style={legalP}>Brands approved to sell on SADAAR are independent businesses responsible for the accuracy of their product listings, the quality and legality of their products, and timely fulfillment of orders. SADAAR charges brands a commission on completed sales, as agreed at the time of onboarding. SADAAR reserves the right to suspend or remove a brand that violates these terms, misrepresents products, or fails to fulfill orders.</p>

      <h2 style={legalH2}>8. Acceptable Use</h2>
      <p style={legalP}>You agree not to use SADAAR for any unlawful purpose, to provide false information, to attempt to circumvent security measures, or to interfere with the platform's normal operation.</p>

      <h2 style={legalH2}>9. Limitation of Liability</h2>
      <p style={legalP}>SADAAR provides the marketplace platform "as is." To the fullest extent permitted by law, SADAAR is not liable for indirect, incidental, or consequential damages arising from your use of the platform, or from the acts or omissions of independent brands selling through it. Nothing in these terms limits liability that cannot be limited under applicable Saudi law.</p>

      <h2 style={legalH2}>10. Changes to These Terms</h2>
      <p style={legalP}>SADAAR may update these terms from time to time. Continued use of the platform after changes take effect constitutes acceptance of the updated terms.</p>

      <h2 style={legalH2}>11. Governing Law</h2>
      <p style={legalP}>These terms are governed by the laws of the Kingdom of Saudi Arabia.</p>

      <h2 style={legalH2}>12. Contact</h2>
      <p style={legalP}>Questions about these terms can be sent through the Contact page.</p>
    </div>
  );
}

function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={legalH1}>Privacy Policy</h1>
      <p style={legalMeta}>Last updated: July 2026. This is a starting draft prepared for SADAAR and has not yet been reviewed by a licensed attorney specializing in Saudi data protection law — see the flagged note below before relying on this as SADAAR's final policy.</p>

      <div style={{ background: "#F3E6D8", border: "1px solid #E5CBA3", padding: 16, marginBottom: 24 }}>
        <p style={{ ...legalP, marginBottom: 0, color: "#8A5A1E" }}>
          <strong>Open legal question — data residency:</strong> Saudi Arabia's Personal Data Protection Law (PDPL) generally requires personal data of Saudi residents to be stored within the Kingdom unless a specific exemption is obtained. SADAAR's current database provider does not offer an in-Kingdom hosting region. This needs review by a qualified Saudi data protection lawyer before this policy — or the underlying infrastructure — can be considered compliant.
        </p>
      </div>

      <h2 style={legalH2}>1. What We Collect</h2>
      <p style={legalP}>When you place an order or create an account, we collect information you provide directly: your name, email address, phone number, and shipping address. If you create an account, we also store your order history, saved addresses, and wishlist. We do not collect or store your full payment card details — payments are processed directly by Moyasar, our payment provider.</p>

      <h2 style={legalH2}>2. How We Use It</h2>
      <p style={legalP}>We use your information to process and fulfill orders, communicate with you about your orders (confirmations, shipping updates, support requests), operate your account if you create one, and improve the platform. We do not sell your personal information to third parties.</p>

      <h2 style={legalH2}>3. Who We Share It With</h2>
      <p style={legalP}>We share the minimum information needed with: the brand fulfilling your order (name, shipping address, and order details for items they're shipping); Moyasar, to process payment; and Resend, to deliver transactional emails (order confirmations, password resets). We do not share your information with advertisers or data brokers.</p>

      <h2 style={legalH2}>4. Data Storage and Security</h2>
      <p style={legalP}>Your information is stored on infrastructure provided by our technology partners and protected with industry-standard security practices, including encrypted connections and access controls. See the flagged note above regarding the location of that storage relative to PDPL requirements.</p>

      <h2 style={legalH2}>5. Your Rights</h2>
      <p style={legalP}>You may request access to, correction of, or deletion of your personal information by contacting us through the Contact page. We will respond in accordance with applicable Saudi law.</p>

      <h2 style={legalH2}>6. Cookies and Local Storage</h2>
      <p style={legalP}>SADAAR uses your browser's local storage to remember your cart, wishlist (if not logged in), and language preference. We do not use third-party advertising trackers.</p>

      <h2 style={legalH2}>7. Children's Privacy</h2>
      <p style={legalP}>SADAAR is not directed at children and is not knowingly used to collect information from children.</p>

      <h2 style={legalH2}>8. Changes to This Policy</h2>
      <p style={legalP}>We may update this policy from time to time. Material changes will be reflected by an updated "last updated" date above.</p>

      <h2 style={legalH2}>9. Contact</h2>
      <p style={legalP}>Questions about this policy, or requests regarding your personal information, can be sent through the Contact page.</p>
    </div>
  );
}

function Contact() {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t.fillAllFields);
      return;
    }
    setSending(true);
    try {
      await api("/support", { method: "POST", body: JSON.stringify({ name, email, subject, message }) });
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <Check size={30} color={C.ink} style={{ marginBottom: 16 }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 8 }}>{t.messageSent}</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted }}>{t.messageSentNote}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 6 }}>{t.contactUs}</h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>{t.contactSubtitle}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder={t.yourName} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder={t.emailOptional.replace(/\s*\(.*\)/, "")} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input placeholder={t.subjectOptional} value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        <textarea placeholder={t.yourMessage} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "Inter, sans-serif" }} />
      </div>
      {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 12 }}>{error}</p>}
      <button onClick={submit} disabled={sending} style={{ marginTop: 16, width: "100%", background: C.ink, color: C.warm, border: "none", padding: "14px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1 }}>
        {sending ? t.sending : t.sendMessage}
      </button>
    </div>
  );
}

function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [contact, setContact] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const { t } = useLang();

  const lookup = async () => {
    setError(null);
    setOrder(null);
    if (!orderId.trim() || !contact.trim()) {
      setError(t.enterOrderAndContact);
      return;
    }
    setLoading(true);
    try {
      const result = await api(`/orders/${orderId.trim()}?contact=${encodeURIComponent(contact.trim())}`);
      setOrder(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const requestCancellation = async (itemId) => {
    setCancelingId(itemId);
    setCancelError("");
    try {
      await api(`/orders/${orderId.trim()}/items/${itemId}/request-cancellation`, { method: "POST", body: JSON.stringify({ contact: contact.trim() }) });
      await lookup();
    } catch (e) {
      setCancelError(e.message);
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 6 }}>{t.trackYourOrder}</h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>{t.trackSubtitle}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
        <input placeholder={t.orderNumberPlaceholder} value={orderId} onChange={(e) => setOrderId(e.target.value)} style={inputStyle} />
        <input placeholder={t.contactPlaceholder} value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
      </div>
      {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, margin: "8px 0" }}>{error}</p>}
      <button onClick={lookup} disabled={loading} style={{ marginTop: 8, background: C.ink, color: C.warm, border: "none", padding: "13px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
        {loading ? t.lookingUp : t.trackOrderBtn}
      </button>

      {order && (
        <div style={{ marginTop: 32, borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: C.ink, margin: 0 }}>Order #{order.id}</p>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: order.payment_status === "paid" ? "#2F5B3C" : C.muted }}>{order.payment_status}</span>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 20 }}>{order.shipping_city} · placed {new Date(order.created_at).toLocaleDateString()}</p>
          {cancelError && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 12, margin: "8px 0" }}>{cancelError}</p>}
          {order.items.map((i) => (
            <div key={i.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{i.brand_name}</p>
                  <p style={{ margin: "2px 0 0", fontFamily: "Fraunces, serif", fontSize: 15, color: C.ink }}>{i.product_name} × {i.quantity}</p>
                  {i.tracking_number && <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted }}>{t.tracking}: {i.tracking_number}</p>}
                </div>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase",
                  padding: "3px 9px", borderRadius: 3,
                  background: i.fulfillment_status === "pending" ? "#F3E6D8" : "#DDE7DB",
                  color: i.fulfillment_status === "pending" ? "#8A5A1E" : "#2F5B3C",
                }}>{i.fulfillment_status}</span>
              </div>
              {i.cancellation_status === "none" && i.fulfillment_status === "pending" && order.payment_status === "paid" && (
                <button onClick={() => requestCancellation(i.id)} disabled={cancelingId === i.id} style={{ marginTop: 8, background: "none", border: `1px solid ${C.line}`, padding: "6px 12px", fontFamily: "Inter, sans-serif", fontSize: 12, cursor: "pointer", color: C.char }}>
                  {cancelingId === i.id ? t.sending : t.requestCancellation}
                </button>
              )}
              {i.cancellation_status === "requested" && (
                <p style={{ marginTop: 8, fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8A5A1E" }}>{t.cancellationRequested}</p>
              )}
              {i.cancellation_status === "denied" && (
                <p style={{ marginTop: 8, fontFamily: "Inter, sans-serif", fontSize: 12, color: C.danger }}>{t.cancellationDenied}</p>
              )}
              {i.cancellation_status === "refunded" && (
                <p style={{ marginTop: 8, fontFamily: "Inter, sans-serif", fontSize: 12, color: "#2F5B3C" }}>{t.cancellationRefunded}</p>
              )}
            </div>
          ))}
          <div style={{ paddingTop: 16, fontFamily: "Inter, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{t.subtotal}</p>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{money(order.subtotal)}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{t.shipping}</p>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{Number(order.shipping_fee) === 0 ? t.free : money(order.shipping_fee)}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: 14, color: C.char, margin: 0 }}>{t.total}</p>
              <p style={{ fontSize: 14, color: C.ink, fontWeight: 600, margin: 0 }}>{money(order.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SadaarMarketplace() {
  const [view, setView] = useState({ type: "home" });
  const [wishlistIds, setWishlistIdsState] = useState(() => getWishlistIds());
  const [lang, setLang] = useState(() => getLang());

  const savedCustomerAuth = getSavedCustomerAuth();
  const [customerToken, setCustomerToken] = useState(savedCustomerAuth?.token || null);
  const [customerInfo, setCustomerInfo] = useState(savedCustomerAuth?.customer || null);

  const loginCustomer = useCallback((token, customer) => {
    setCustomerToken(token);
    setCustomerInfo(customer);
    saveCustomerAuth(token, customer);
    // Server wishlist becomes the source of truth once logged in — replaces
    // whatever was in the guest (localStorage) wishlist on this device.
    api("/customers/me/wishlist", {}, token)
      .then((rows) => setWishlistIdsState(rows.map((p) => p.id)))
      .catch(() => {});
  }, []);

  const logoutCustomer = useCallback(() => {
    setCustomerToken(null);
    setCustomerInfo(null);
    saveCustomerAuth(null, null);
    setWishlistIdsState(getWishlistIds()); // fall back to this device's guest wishlist
  }, []);

  // If a customer password-reset link brought them here, route straight to
  // the reset-password screen regardless of what page they'd otherwise land on.
  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("resetToken");
    if (resetToken) {
      setView({ type: "account", resetToken });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If already logged in from a previous session, load their server wishlist on mount.
  useEffect(() => {
    if (customerToken) {
      api("/customers/me/wishlist", {}, customerToken)
        .then((rows) => setWishlistIdsState(rows.map((p) => p.id)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "en" ? "ar" : "en";
      try { localStorage.setItem(LANG_KEY, next); } catch {}
      return next;
    });
  }, []);

  const langCtx = useMemo(() => ({
    lang,
    t: T[lang],
    dir: lang === "ar" ? "rtl" : "ltr",
    categoryLabel: (c) => CATEGORY_LABELS[lang][c] || c,
    subcategoryLabel: (s) => SUBCATEGORY_LABELS[lang][s] || s,
    productTypeLabel: (p) => PRODUCT_TYPE_LABELS[lang][p] || p,
    toggleLang,
  }), [lang, toggleLang]);

  // Dual-mode: logged-in customers get a real server-synced wishlist (works
  // across devices); guests keep the existing localStorage-only behavior.
  const toggleWishlist = useCallback((productId) => {
    setWishlistIdsState((prev) => {
      const wasWishlisted = prev.includes(productId);
      const next = wasWishlisted ? prev.filter((id) => id !== productId) : [...prev, productId];
      if (customerToken) {
        const request = wasWishlisted
          ? api(`/customers/me/wishlist/${productId}`, { method: "DELETE" }, customerToken)
          : api("/customers/me/wishlist", { method: "POST", body: JSON.stringify({ productId }) }, customerToken);
        request.catch(() => {}); // optimistic — a rare failure here isn't worth blocking the UI over
      } else {
        setWishlistIds(next);
      }
      return next;
    });
  }, [customerToken]);
  const [cart, setCart] = useState([]);
  const [brands, setBrands] = useState([]);
  const [homeProducts, setHomeProducts] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(null);
  const [returningPayment, setReturningPayment] = useState(null); // { status: 'checking'|'paid'|'error', orderId, total, message }

  // Handle the return trip from Moyasar's 3D Secure redirect. Moyasar appends
  // ?id=<payment_id> to our callback_url after the bank's verification step,
  // and the page fully reloads at that point (wiping normal React state), so
  // we recover the pending order from localStorage and finish the job here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("id");
    const pendingRaw = localStorage.getItem("sadaar_pending_order");

    if (!paymentId) return;

    window.history.replaceState({}, "", window.location.pathname); // clean the URL

    if (!pendingRaw) {
      setReturningPayment({ status: "error", message: "Payment returned, but we lost track of which order it belongs to. Please check your order status or contact support." });
      return;
    }
    const pending = JSON.parse(pendingRaw);
    setReturningPayment({ status: "checking", orderId: pending.orderId, total: pending.total });

    api(`/orders/${pending.orderId}/confirm-payment`, {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    })
      .then(() => {
        localStorage.removeItem("sadaar_pending_order");
        setCart([]);
        setReturningPayment({ status: "paid", orderId: pending.orderId, total: pending.total });
      })
      .catch((e) => {
        setReturningPayment({ status: "error", orderId: pending.orderId, message: e.message });
      });
  }, []);

  useEffect(() => {
    setHomeLoading(true);
    Promise.all([api("/brands"), api("/products")])
      .then(([b, p]) => { setBrands(b); setHomeProducts(p); })
      .catch((e) => setHomeError(e.message))
      .finally(() => setHomeLoading(false));
  }, []);

  const openProduct = useCallback((id) => { setView({ type: "product", id }); window.scrollTo?.(0, 0); }, []);
  const openBrand = useCallback((slug) => { setView({ type: "brand", slug }); window.scrollTo?.(0, 0); }, []);

  useEffect(() => {
    const titles = {
      home: ["SADAAR — Home of Saudi Fashion", "Independent Saudi fashion brands, one curated marketplace."],
      browse: [view.cat ? `${view.cat} — SADAAR` : "Shop all — SADAAR", `Shop ${view.cat || "all categories"} from independent Saudi fashion brands on SADAAR.`],
      brands: ["Our brands — SADAAR", "Meet the independent Saudi fashion labels curated on SADAAR."],
      cart: ["Your bag — SADAAR", null],
      checkout: ["Checkout — SADAAR", null],
      track: ["Track your order — SADAAR", "Check the status of your SADAAR order."],
      wishlist: ["Your wishlist — SADAAR", null],
      contact: ["Contact us — SADAAR", null],
    };
    const entry = titles[view.type];
    if (entry) setPageMeta(...entry);
    // "product" view sets its own title once the product loads (see ProductDetail).
  }, [view]);

  const addToCart = (product, variant, qty) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variant.id === variant.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { product, variant, qty }];
    });
  };

  const updateQty = (idx, delta) => setCart((prev) => { const c = [...prev]; c[idx] = { ...c[idx], qty: Math.max(1, c[idx].qty + delta) }; return c; });
  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <LangContext.Provider value={langCtx}>
    <div dir={langCtx.dir} className={lang === "ar" ? "sadaar-rtl" : ""} style={{ background: C.sand, minHeight: "100vh" }}>
      <style>{FONTS}</style>

      {returningPayment && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          {returningPayment.status === "checking" && (
            <>
              <Loader2 size={28} color={C.ink} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: C.ink }}>{langCtx.t.confirmingPayment}</p>
            </>
          )}
          {returningPayment.status === "paid" && (
            <>
              <Check size={30} color={C.ink} style={{ marginBottom: 16 }} />
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 8 }}>{langCtx.t.paymentReceived}</h1>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, marginBottom: 24 }}>{langCtx.t.confirmationEmailNote(returningPayment.orderId, money(returningPayment.total))}</p>
              <button onClick={() => { setReturningPayment(null); setView({ type: "home" }); }} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{langCtx.t.backToSadaar}</button>
            </>
          )}
          {returningPayment.status === "error" && (
            <>
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 8 }}>{langCtx.t.couldNotConfirmPayment}</h1>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#A3402F", marginBottom: 24 }}>{returningPayment.message}</p>
              <button onClick={() => { setReturningPayment(null); setView({ type: "home" }); }} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>{langCtx.t.backToSadaar}</button>
            </>
          )}
        </div>
      )}

      {!returningPayment && (
        <>
          <Header setView={setView} cartCount={cartCount} wishlistCount={wishlistIds.length} onSearchClick={() => setView({ type: "browse" })} currentView={view} isLoggedIn={!!customerToken} />

          {view.type === "home" && <Home setView={setView} openProduct={openProduct} products={homeProducts} brands={brands} loading={homeLoading} error={homeError} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />}
          {view.type === "browse" && <Browse key={`${view.cat || "all"}-${view.subcat || "all"}-${view.ptype || "all"}`} initialCat={view.cat} initialSubcat={view.subcat} initialPtype={view.ptype} openProduct={openProduct} brands={brands} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />}
          {view.type === "brands" && (
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 64px" }}>
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 24 }}>{langCtx.t.allBrands}</h1>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {brands.map((b) => (
                  <div key={b.id} style={{ border: `1px solid ${C.line}`, padding: 20, background: C.warm }}>
                    <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 18, color: C.ink }}>{b.name}</p>
                    <p style={{ margin: "6px 0 0", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{b.description}</p>
                    <button onClick={() => openBrand(b.slug)} style={{ marginTop: 14, background: "none", border: `1px solid ${C.ink}`, padding: "8px 14px", fontFamily: "Inter, sans-serif", fontSize: 12, cursor: "pointer" }}>{langCtx.t.shopBrand(b.name)}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view.type === "product" && <ProductDetail productId={view.id} onBack={() => setView({ type: "browse" })} onAddToCart={addToCart} wishlisted={wishlistIds.includes(view.id)} onToggleWishlist={toggleWishlist} openProduct={openProduct} wishlistIds={wishlistIds} openBrand={openBrand} />}
          {view.type === "brand" && <BrandProfilePage slug={view.slug} openProduct={openProduct} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />}
          {view.type === "cart" && <Cart items={cart} updateQty={updateQty} removeItem={removeItem} setView={setView} />}
          {view.type === "checkout" && <Checkout items={cart} setView={setView} clearCart={() => setCart([])} customerToken={customerToken} customerInfo={customerInfo} />}
          {view.type === "track" && <TrackOrder />}
          {view.type === "contact" && <Contact />}
          {view.type === "faq" && <FAQ setView={setView} />}
          {view.type === "terms" && <Terms />}
          {view.type === "privacy" && <Privacy />}
          {view.type === "account" && (
            customerToken
              ? <Account customerInfo={customerInfo} customerToken={customerToken} onLogout={logoutCustomer} />
              : <AccountAuth onLogin={loginCustomer} initialResetToken={view.resetToken} setView={setView} />
          )}
          {view.type === "wishlist" && <Wishlist wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} openProduct={openProduct} setView={setView} />}

          <Footer setView={setView} />
        </>
      )}
    </div>
    </LangContext.Provider>
  );
}
