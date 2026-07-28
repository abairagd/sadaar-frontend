import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { ShoppingBag, Search, Plus, Minus, ChevronLeft, Check, Loader2, Heart, Sparkles } from "lucide-react";

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

// Device-based wishlist (no customer accounts exist yet, so this can't sync
// across devices — it's stored per browser via localStorage).
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
    yourWishlist: "Your wishlist", nothingSaved: "Nothing saved yet", nothingSavedSubtext: "Tap the heart on any piece to save it here for later.",
    footerTagline: "One marketplace for Saudi fashion — every brand kept true to its own hand, delivered through one trusted checkout.",
    footerShop: "Shop", footerSadaar: "SADAAR", footerJoin: "Join as a brand", footerCopyright: "© 2026 SADAAR. Every product ships direct from its brand.",
    fillAllFields: "Please fill in all fields.",
    enterOrderAndContact: "Enter both your order number and the email or phone you used.",
    contactUs: "Contact us", contactSubtitle: "Have a question about an order, a brand, or anything else? Send us a message.",
    yourName: "Your name", subjectOptional: "Subject (optional)", yourMessage: "Your message",
    sendMessage: "Send message", sending: "Sending...", messageSent: "Message sent",
    messageSentNote: "Thanks for reaching out — we'll get back to you by email.",
    contactNav: "Contact",
    brandSignIn: "Brand sign in",
  },
  ar: {
    home: "الرئيسية", shopAll: "تسوقي الكل", brandsNav: "الماركات", wishlistNav: "المفضلة", trackOrderNav: "تتبع الطلب",
    tagline: "بيت الأزياء السعودية", eyebrow: "منتقاة · مباشرة من الماركة",
    heroTitle1: "بيت", heroTitle2: "الأزياء السعودية.",
    heroSubtitle: "ماركات سعودية مستقلة، سلة شراء واحدة. كل قطعة تُشحن ويقف خلفها صانعها.",
    shopTheEdit: "تسوقي التشكيلة",
    curatedBrands: "ماركات منتقاة", viewAll: "عرض الكل ←", spotlight: "مميزة",
    shopByCategory: "تسوقي حسب الفئة", thisWeeksEdit: "تشكيلة هذا الأسبوع",
    ourStory: "قصتنا",
    ourStoryText: "الأزياء السعودية لم تفتقر يومًا للموهبة، بل افتقرت لباب واحد يجمعها. سدّار يجمع الماركات السعودية المستقلة تحت سقف واحد، دون أن يطلب من أي منها أن تتغير عمّا يميزها.",
    joinQuestion: "هل أنتِ صاحبة ماركة أزياء سعودية؟", joinSubtext: "انضمي إلى سدّار وصلي إلى المتسوقين الباحثين عمّا تصنعينه بالضبط.", applyToSell: "قدّمي طلب الانضمام",
    searchPlaceholder: "ابحثي عن قطعة...", category: "الفئة", all: "الكل", brand: "الماركة", price: "السعر (ر.س)", min: "الأدنى", max: "الأعلى",
    clearFilters: "مسح الفلاتر", pieces: "قطعة",
    sortNewest: "الأحدث", sortPriceAsc: "السعر: من الأقل للأعلى", sortPriceDesc: "السعر: من الأعلى للأقل", sortNameAsc: "الاسم: أ-ي",
    noMatches: "لا توجد قطع مطابقة لهذه الفلاتر.",
    allBrands: "جميع الماركات", shopBrand: (name) => `تسوقي ${name}`,
    back: "رجوع", size: "المقاس", qty: "الكمية", addToCart: "أضيفي إلى السلة", soldOut: "نفدت الكمية", addedToCart: "تمت الإضافة",
    shippedBy: (brand) => `تُشحن مباشرة من ${brand}، منتقاة ومضمونة من سدّار.`,
    youMightAlsoLike: "قد يعجبك أيضًا",
    yourBag: "سلتك", bagEmpty: "سلتك فارغة", remove: "إزالة",
    subtotal: "المجموع الفرعي", shipping: "الشحن", free: "مجاني", estimatedTotal: "الإجمالي التقديري",
    shippingNote: (fee, threshold) => `يُحتسب الشحن لكل ماركة (${fee} ر.س، مجاني فوق ${threshold} ر.س لكل ماركة) لأن كل ماركة تشحن بشكل منفصل. التوصيل المتوقع: 3–5 أيام عمل.`,
    checkout: "إتمام الشراء", checkoutSubtitle: "أدخلي بيانات الشحن، ثم ادفعي بالبطاقة في الخطوة التالية.",
    fullName: "الاسم الكامل", emailOptional: "البريد الإلكتروني (اختياري)", phoneNumber: "رقم الجوال", city: "المدينة", address: "العنوان",
    promoCode: "كود الخصم", apply: "تطبيق", checking: "جارٍ التحقق...", codeApplied: (code) => `تم تطبيق الكود "${code}"`,
    discount: "الخصم", totalDue: "المبلغ المستحق", continueToPayment: "متابعة الدفع", placingOrder: "جارٍ تنفيذ الطلب...",
    payment: "الدفع", paymentGatewayMissing: "بوابة الدفع غير مُهيأة بعد",
    paymentReceived: "تم استلام الدفع", paymentReceivedNote: "تم إشعار كل ماركة في سلتك لتجهيز طلبها.",
    backToSadaar: "العودة إلى سدّار",
    confirmingPayment: "جارٍ تأكيد الدفع...",
    confirmationEmailNote: (orderId, total) => `الطلب رقم ${orderId} — ${total}. بريد التأكيد في طريقه إليك.`,
    couldNotConfirmPayment: "تعذّر تأكيد هذا الدفع",
    trackYourOrder: "تتبعي طلبك", trackSubtitle: "أدخلي رقم الطلب والبريد الإلكتروني أو رقم الجوال المستخدم عند الدفع.",
    orderNumberPlaceholder: "رقم الطلب (مثال: 17)", contactPlaceholder: "البريد الإلكتروني أو الجوال المستخدم عند الدفع", trackOrderBtn: "تتبع الطلب", lookingUp: "جارٍ البحث...",
    tracking: "رقم التتبع", total: "الإجمالي",
    yourWishlist: "قائمة المفضلة", nothingSaved: "لا يوجد شيء محفوظ بعد", nothingSavedSubtext: "اضغطي على القلب في أي قطعة لحفظها هنا لاحقًا.",
    footerTagline: "سوق واحد للأزياء السعودية — كل ماركة تحافظ على هويتها، ويصلك عبر عملية شراء واحدة موثوقة.",
    footerShop: "تسوقي", footerSadaar: "سدّار", footerJoin: "انضمي كماركة", footerCopyright: "© 2026 سدّار. كل منتج يُشحن مباشرة من ماركته.",
    fillAllFields: "الرجاء تعبئة جميع الحقول.",
    enterOrderAndContact: "أدخلي رقم الطلب والبريد الإلكتروني أو الجوال المستخدم.",
    contactUs: "تواصلي معنا", contactSubtitle: "لديك سؤال عن طلب أو ماركة أو أي شيء آخر؟ أرسلي لنا رسالة.",
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

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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

function Header({ setView, cartCount, wishlistCount, onSearchClick, currentView }) {
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
const boldNavBtn = { background: "none", border: "none", cursor: "pointer", color: C.char, padding: "4px 0", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.01em", outline: "none" };
const activeNavBtn = { ...boldNavBtn, color: C.ink };
const inactiveNavBtn = boldNavBtn;

function Footer({ setView }) {
  const { t, categoryLabel } = useLang();
  return (
    <footer style={{ background: C.ink, color: C.sand, marginTop: 64 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, marginBottom: 8 }}>SADAAR</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, color: "#C5CDCE" }}>{t.footerTagline}</p>
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
          <a href="https://sadaar-brand-dashboard.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "none" }}>{t.brandSignIn}</a>
          <a href="https://sadaar-apply-brand.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "#C5CDCE", fontFamily: "Inter, sans-serif", fontSize: 13, textDecoration: "none" }}>{t.footerJoin}</a>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #253B3E", padding: "16px 24px", fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8A9598", textAlign: "center" }}>{t.footerCopyright}</div>
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

function ProductDetail({ productId, onBack, onAddToCart, wishlisted, onToggleWishlist, openProduct, wishlistIds }) {
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
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze }}>{product.brand_name}</p>
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

function Checkout({ items, setView, clearCart }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = estimateShipping(items);
  const { t } = useLang();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", city: "", address: "" });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null); // set once the (unpaid) order is created
  const [paid, setPaid] = useState(false);
  const [publishableKey, setPublishableKey] = useState(null);
  const formRef = React.useRef(null);

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
      });
      setOrder(result);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <input placeholder={t.fullName} value={form.fullName} onChange={set("fullName")} style={inputStyle} />
        <input placeholder={t.emailOptional} value={form.email} onChange={set("email")} style={inputStyle} />
        <input placeholder={t.phoneNumber} value={form.phone} onChange={set("phone")} style={inputStyle} />
        <input placeholder={t.city} value={form.city} onChange={set("city")} style={inputStyle} />
        <input placeholder={t.address} value={form.address} onChange={set("address")} style={inputStyle} />
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
          {order.items.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
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

  const toggleWishlist = useCallback((productId) => {
    setWishlistIdsState((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId];
      setWishlistIds(next);
      return next;
    });
  }, []);
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
          <Header setView={setView} cartCount={cartCount} wishlistCount={wishlistIds.length} onSearchClick={() => setView({ type: "browse" })} currentView={view} />

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
                    <button onClick={() => setView({ type: "browse", cat: b.category })} style={{ marginTop: 14, background: "none", border: `1px solid ${C.ink}`, padding: "8px 14px", fontFamily: "Inter, sans-serif", fontSize: 12, cursor: "pointer" }}>{langCtx.t.shopBrand(b.name)}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view.type === "product" && <ProductDetail productId={view.id} onBack={() => setView({ type: "browse" })} onAddToCart={addToCart} wishlisted={wishlistIds.includes(view.id)} onToggleWishlist={toggleWishlist} openProduct={openProduct} wishlistIds={wishlistIds} />}
          {view.type === "cart" && <Cart items={cart} updateQty={updateQty} removeItem={removeItem} setView={setView} />}
          {view.type === "checkout" && <Checkout items={cart} setView={setView} clearCart={() => setCart([])} />}
          {view.type === "track" && <TrackOrder />}
          {view.type === "contact" && <Contact />}
          {view.type === "wishlist" && <Wishlist wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} openProduct={openProduct} setView={setView} />}

          <Footer setView={setView} />
        </>
      )}
    </div>
    </LangContext.Provider>
  );
}
