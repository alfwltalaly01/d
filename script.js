// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// Hamburger
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
document.addEventListener('click', e => { if (!navbar.contains(e.target)) navLinks.classList.remove('open'); });

// Counter
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const step = target / (1800 / 16);
  let cur = 0;
  const t = setInterval(() => {
    cur += step;
    if (cur >= target) { cur = target; clearInterval(t); }
    el.textContent = Math.floor(cur);
  }, 16);
}
const cObs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); cObs.unobserve(e.target); } }), {threshold:0.5});
document.querySelectorAll('.stat-num[data-target]').forEach(el => cObs.observe(el));

// Products tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-electric').style.display = tab === 'electric' ? 'grid' : 'none';
    document.getElementById('tab-plumbing').style.display = tab === 'plumbing' ? 'grid' : 'none';
  });
});

// Time slots
document.querySelectorAll('.time-slot').forEach(slot => {
  slot.addEventListener('click', () => {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    slot.classList.add('selected');
    document.getElementById('selectedTime').value = slot.dataset.time;
  });
});

// Set min date for booking
const dateInput = document.getElementById('bookingDate');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
}

// Forms
['quoteForm','bookingForm','contactForm'].forEach(id => {
  const form = document.getElementById(id);
  if (!form) return;
  const successId = id.replace('Form','Success');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.textContent = 'جاري الإرسال...';
    btn.disabled = true;
    setTimeout(() => {
      document.getElementById(successId).style.display = 'block';
      form.reset();
      btn.textContent = btn.textContent.includes('حجز') ? 'تأكيد الحجز 📅' : btn.textContent.includes('سعر') ? 'إرسال طلب عرض السعر ⚡' : 'إرسال الطلب ⚡';
      btn.disabled = false;
      setTimeout(() => { document.getElementById(successId).style.display = 'none'; }, 5000);
    }, 1200);
  });
});

// FAQ
document.querySelectorAll('.faq-question').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); window.scrollTo({top: target.getBoundingClientRect().top + window.scrollY - 80, behavior:'smooth'}); }
  });
});

// Active nav
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.style.color = a.getAttribute('href') === '#'+current ? 'var(--gold)' : '';
  });
});

// Bell Notification
const notiBell = document.getElementById('notiBell');
const notiContent = document.getElementById('notiContent');
const bellBadge = document.querySelector('.bell-badge');

if (bellBadge) {
  const count = document.querySelectorAll('.bell-item').length;
  bellBadge.textContent = count;
}

if (notiBell && notiContent) {
  notiBell.addEventListener('click', function(e) {
    e.stopPropagation();
    notiContent.classList.toggle('show');
  });

  document.addEventListener('click', function(e) {
    if (!notiBell.contains(e.target) && !notiContent.contains(e.target)) {
      notiContent.classList.remove('show');
    }
  });
}
