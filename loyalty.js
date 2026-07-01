// =====================================================================
// نظام نقاط الفولت العالي — مرتبط بـ Firebase (Firestore + Auth)
// تسجيل العملاء حصراً عبر الموظف بعد التأكد من الهوية شخصياً.
// تحقق صارم من صيغة الجوال السعودي + منع الرصيد السالب + منع الإرسال المكرر.
// =====================================================================
// ⚠️ خطوة إلزامية قبل النشر: استبدل القيم أدناه ببيانات مشروعك في Firebase
// (Project settings → عام → تطبيقات الويب → SDK setup and configuration)
// هذه البيانات "عامة" وليست سرّية، لكن الحماية الحقيقية تكون عبر
// Firestore Security Rules (راجع ملف firestore.rules.txt المرفق).
// =====================================================================
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// معدل تحويل النقاط: 1 نقطة لكل 50 ريال
const POINTS_RATE = 50;

let fbApp = null, auth = null, db = null, currentStaff = null, pendingAction = null;

function loyaltyReady() {
  return firebaseConfig.apiKey !== "REPLACE_ME";
}

function initFirebase() {
  if (!loyaltyReady()) {
    console.warn("⚠️ نظام النقاط: لم يتم ربط Firebase بعد. عدّل القيم في loyalty.js");
    return false;
  }
  if (!fbApp) {
    fbApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(user => {
      currentStaff = user;
      updateStaffUI();
    });
  }
  return true;
}

// ---------------------------------------------------------------------
// تحقق صارم من صيغة الجوال السعودي: يجب أن يكون 05XXXXXXXX (10 أرقام)
// يقبل أيضاً صيغة 9665XXXXXXXX أو 5XXXXXXXX ويحوّلها تلقائياً
// ---------------------------------------------------------------------
function normalizePhone(raw) {
  let p = (raw || "").replace(/[^0-9]/g, "");
  if (p.startsWith("00966")) p = p.slice(5);
  else if (p.startsWith("966")) p = p.slice(3);
  if (p.length === 9 && p.startsWith("5")) p = "0" + p;
  if (/^05[0-9]{8}$/.test(p)) return p;
  return null; // صيغة غير صحيحة
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
  const menu = document.getElementById("loyaltyMenu");
  if (menu) menu.classList.remove("show");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}
function showBox(el, html, isError) {
  if (!el) return;
  el.style.display = "block";
  el.innerHTML = html;
  el.style.color = isError ? "#f87171" : "";
  el.style.background = isError ? "rgba(248,113,113,0.08)" : "";
  el.style.borderColor = isError ? "rgba(248,113,113,0.25)" : "";
}
function hideBox(el) {
  if (el) el.style.display = "none";
}
function lockBtn(btn, lockedText) {
  if (!btn) return () => {};
  const original = btn.textContent;
  btn.disabled = true;
  btn.style.opacity = "0.6";
  btn.style.cursor = "not-allowed";
  btn.textContent = lockedText || "جارٍ التنفيذ...";
  return () => {
    btn.disabled = false;
    btn.style.opacity = "";
    btn.style.cursor = "";
    btn.textContent = original;
  };
}

function updateStaffUI() {
  document.querySelectorAll(".staff-badge").forEach(b => {
    b.style.display = currentStaff ? "block" : "none";
  });
  const who = document.getElementById("adminWho");
  if (who) who.textContent = currentStaff ? `مسجّل الدخول: ${currentStaff.email}` : "";
}

function requireStaff(actionLabel, cb) {
  if (!initFirebase()) {
    alert("نظام النقاط غير مفعّل بعد على هذا الموقع.");
    return;
  }
  if (currentStaff) { cb(); return; }
  pendingAction = cb;
  const t = document.getElementById("loginModalTitle");
  if (t) t.textContent = `دخول الموظفين — ${actionLabel}`;
  openModal("loginModal");
}

document.addEventListener("DOMContentLoaded", () => {
  // فتح/إغلاق القائمة
  const btn = document.getElementById("loyaltyBtn");
  const menu = document.getElementById("loyaltyMenu");
  if (btn && menu) {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      initFirebase();
      menu.classList.toggle("show");
    });
    document.addEventListener("click", e => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) menu.classList.remove("show");
    });
  }

  // إغلاق النوافذ المنبثقة
  document.querySelectorAll(".loyalty-modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay || e.target.closest(".loyalty-modal-close")) {
        overlay.classList.remove("show");
      }
    });
  });

  // فتح كل نافذة من القائمة
  document.getElementById("openCheckBtn")?.addEventListener("click", () => { initFirebase(); openModal("checkModal"); });
  document.getElementById("openRegisterBtn")?.addEventListener("click", () => requireStaff("تسجيل عميل جديد", () => openModal("registerModal")));
  document.getElementById("openCollectBtn")?.addEventListener("click", () => requireStaff("تحصيل النقاط", () => openModal("collectModal")));
  document.getElementById("openRedeemBtn")?.addEventListener("click", () => requireStaff("استبدال النقاط", () => openModal("redeemModal")));
  document.getElementById("openAdminBtn")?.addEventListener("click", () => requireStaff("لوحة الإدارة", () => { openModal("adminModal"); loadCustomers(); }));

  // ---- تسجيل دخول الموظفين ----
  const loginForm = document.getElementById("staffLoginForm");
  loginForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const unlock = lockBtn(submitBtn, "جارٍ الدخول...");
    const email = document.getElementById("staffEmail").value.trim();
    const pass = document.getElementById("staffPass").value;
    const errBox = document.getElementById("loginError");
    hideBox(errBox);
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      closeModal("loginModal");
      loginForm.reset();
      if (pendingAction) { const fn = pendingAction; pendingAction = null; fn(); }
    } catch (err) {
      showBox(errBox, "بيانات الدخول غير صحيحة، حاول مرة أخرى.", true);
    } finally {
      unlock();
    }
  });

  document.querySelectorAll(".staff-logout-btn").forEach(b => {
    b.addEventListener("click", () => { auth.signOut(); closeModal("adminModal"); });
  });

  // ---- تحقق من الرصيد (عام لأي زائر — قراءة فقط، بدون تسجيل) ----
  const checkForm = document.getElementById("checkForm");
  checkForm?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!initFirebase()) return;
    const resultBox = document.getElementById("checkResult");
    const submitBtn = checkForm.querySelector('button[type="submit"]');
    const phone = normalizePhone(document.getElementById("checkPhone").value);
    if (!phone) { showBox(resultBox, "رقم جوال غير صحيح. يجب أن يكون بصيغة 05XXXXXXXX.", true); return; }
    const unlock = lockBtn(submitBtn, "جارٍ التحقق...");
    showBox(resultBox, "جارٍ التحقق...");
    try {
      const snap = await db.collection("customers").doc(phone).get();
      if (snap.exists) {
        const d = snap.data();
        showBox(resultBox, `مرحباً <b>${escapeHtml(d.name)}</b> 👋<br/>رصيدك الحالي: <b style="color:var(--gold)">${d.points} نقطة</b>`);
      } else {
        showBox(resultBox, "هذا الرقم غير مسجّل في برنامج النقاط بعد. يرجى مراجعة أحد موظفينا عند زيارتك القادمة للتسجيل.", true);
      }
    } catch (err) {
      showBox(resultBox, "حدث خطأ أثناء التحقق، حاول مرة أخرى.", true);
      console.error(err);
    } finally {
      unlock();
    }
  });

  // ---- تسجيل عميل جديد (موظف فقط — بعد التأكد من الهوية شخصياً) ----
  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const resultBox = document.getElementById("registerResult");
    const submitBtn = document.getElementById("registerSubmitBtn") || registerForm.querySelector('button[type="submit"]');
    const phone = normalizePhone(document.getElementById("registerPhone").value);
    const name = document.getElementById("registerName").value.trim();
    if (!phone) { showBox(resultBox, "رقم جوال غير صحيح. يجب أن يكون بصيغة 05XXXXXXXX.", true); return; }
    if (!name || name.length < 2) { showBox(resultBox, "الرجاء إدخال اسم صحيح للعميل.", true); return; }
    const unlock = lockBtn(submitBtn, "جارٍ التسجيل...");
    showBox(resultBox, "جارٍ التسجيل...");
    try {
      const ref = db.collection("customers").doc(phone);
      const snap = await ref.get();
      if (snap.exists) {
        showBox(resultBox, `⚠️ هذا الرقم مسجّل مسبقاً باسم <b>${escapeHtml(snap.data().name)}</b> برصيد ${snap.data().points} نقطة. لا يمكن تسجيله مرة أخرى.`, true);
        return;
      }
      await ref.set({
        name, phone, points: 0,
        registeredBy: currentStaff.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showBox(resultBox, `تم تسجيل العميل <b>${escapeHtml(name)}</b> بنجاح ✅<br/>الرصيد الابتدائي: 0 نقطة`);
      registerForm.reset();
    } catch (err) {
      showBox(resultBox, "حدث خطأ أثناء التسجيل.", true);
      console.error(err);
    } finally {
      unlock();
    }
  });

  // ---- تحصيل النقاط (موظف) ----
  const collectForm = document.getElementById("collectForm");
  collectForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const resultBox = document.getElementById("collectResult");
    const submitBtn = document.getElementById("collectSubmitBtn") || collectForm.querySelector('button[type="submit"]');
    const phone = normalizePhone(document.getElementById("collectPhone").value);
    const amountRaw = document.getElementById("collectAmount").value;
    const amount = parseFloat(amountRaw);
    if (!phone) { showBox(resultBox, "رقم جوال غير صحيح. يجب أن يكون بصيغة 05XXXXXXXX.", true); return; }
    if (!amountRaw || isNaN(amount) || amount <= 0) { showBox(resultBox, "أدخل مبلغ فاتورة صحيح أكبر من صفر.", true); return; }
    const points = Math.floor(amount / POINTS_RATE);
    if (points <= 0) { showBox(resultBox, `المبلغ أقل من ${POINTS_RATE} ريال، لا توجد نقاط تُحتسب لهذه الفاتورة.`, true); return; }
    const unlock = lockBtn(submitBtn, "جارٍ الحفظ...");
    showBox(resultBox, "جارٍ الحفظ...");
    try {
      const ref = db.collection("customers").doc(phone);
      const snap = await ref.get();
      if (!snap.exists) {
        showBox(resultBox, "⚠️ هذا الرقم غير مسجّل. سجّل العميل أولاً عبر «تسجيل عميل جديد».", true);
        return;
      }
      await ref.update({
        points: firebase.firestore.FieldValue.increment(points),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("transactions").add({
        phone, type: "earn", amount, points,
        staffEmail: currentStaff.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showBox(resultBox, `تمت إضافة <b style="color:var(--gold)">${points} نقطة</b> لحساب ${escapeHtml(snap.data().name)} ✅`);
      collectForm.reset();
    } catch (err) {
      showBox(resultBox, "حدث خطأ أثناء الحفظ.", true);
      console.error(err);
    } finally {
      unlock();
    }
  });

  // ---- استبدال النقاط (موظف) ----
  const redeemForm = document.getElementById("redeemForm");
  redeemForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const resultBox = document.getElementById("redeemResult");
    const submitBtn = document.getElementById("redeemSubmitBtn") || redeemForm.querySelector('button[type="submit"]');
    const phone = normalizePhone(document.getElementById("redeemPhone").value);
    const points = parseInt(document.getElementById("redeemPoints").value, 10);
    const note = document.getElementById("redeemNote").value.trim();
    if (!phone) { showBox(resultBox, "رقم جوال غير صحيح. يجب أن يكون بصيغة 05XXXXXXXX.", true); return; }
    if (!Number.isInteger(points) || points <= 0) { showBox(resultBox, "أدخل عدد نقاط صحيح أكبر من صفر.", true); return; }
    const unlock = lockBtn(submitBtn, "جارٍ التنفيذ...");
    showBox(resultBox, "جارٍ التحقق من الرصيد...");
    try {
      const ref = db.collection("customers").doc(phone);
      const snap = await ref.get();
      if (!snap.exists) { showBox(resultBox, "هذا الرقم غير مسجّل.", true); return; }
      const current = snap.data().points || 0;
      if (current < points) { showBox(resultBox, `⚠️ الرصيد غير كافٍ. المتاح حالياً: ${current} نقطة فقط.`, true); return; }
      await ref.update({
        points: firebase.firestore.FieldValue.increment(-points),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("transactions").add({
        phone, type: "redeem", points: -points, note: note || "-",
        staffEmail: currentStaff.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showBox(resultBox, `تم استبدال <b style="color:var(--gold)">${points} نقطة</b> لحساب ${escapeHtml(snap.data().name)} ✅<br/>الرصيد المتبقي: ${current - points} نقطة`);
      redeemForm.reset();
    } catch (err) {
      showBox(resultBox, "حدث خطأ أثناء التنفيذ.", true);
      console.error(err);
    } finally {
      unlock();
    }
  });

  // ---- لوحة الإدارة ----
  const adminSearch = document.getElementById("adminSearch");
  adminSearch?.addEventListener("input", e => loadCustomers(e.target.value.trim()));
});

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

async function loadCustomers(term = "") {
  const listEl = document.getElementById("adminList");
  if (!listEl) return;
  listEl.innerHTML = '<div class="admin-loading">جارٍ التحميل...</div>';
  try {
    const snap = await db.collection("customers").orderBy("points", "desc").limit(100).get();
    const rows = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (term && !d.phone.includes(term) && !(d.name || "").includes(term)) return;
      rows.push(`<div class="admin-row">
        <div><b>${escapeHtml(d.name)}</b><br/><span style="color:var(--gray)">${d.phone}</span></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--gold);font-weight:700">${d.points} نقطة</span>
          <button class="btn-outline admin-edit-btn" data-phone="${d.phone}" data-points="${d.points}" style="padding:4px 10px;font-size:0.78rem">تعديل</button>
        </div>
      </div>`);
    });
    listEl.innerHTML = rows.length ? rows.join("") : '<div class="admin-loading">لا يوجد عملاء مطابقون.</div>';
    listEl.querySelectorAll(".admin-edit-btn").forEach(b => {
      b.addEventListener("click", async () => {
        const newVal = prompt("عدّل رصيد النقاط لهذا العميل (رقم صحيح فقط، 0 أو أكبر):", b.dataset.points);
        if (newVal === null) return;
        const n = parseInt(newVal, 10);
        if (!Number.isInteger(n) || n < 0 || String(n) !== newVal.trim()) {
          alert("قيمة غير صحيحة. يجب إدخال رقم صحيح 0 أو أكبر.");
          return;
        }
        const oldVal = parseInt(b.dataset.points, 10);
        if (n === oldVal) return;
        b.disabled = true;
        try {
          await db.collection("customers").doc(b.dataset.phone).update({
            points: n,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await db.collection("transactions").add({
            phone: b.dataset.phone, type: "adjust", points: n - oldVal,
            staffEmail: currentStaff.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          loadCustomers(document.getElementById("adminSearch")?.value.trim() || "");
        } catch (err) {
          alert("تعذّر حفظ التعديل.");
          console.error(err);
          b.disabled = false;
        }
      });
    });
  } catch (err) {
    listEl.innerHTML = '<div class="admin-loading">تعذّر تحميل البيانات.</div>';
    console.error(err);
  }
}
