(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('fv-data')?.textContent || '{}');
  const units = data.units || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k){ try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch { /* armazenamento indisponível: segue sem lembrar */ } }
  };

  // Fundo branco opcional (para comparar com o creme na apresentação)
  const paperParam = new URLSearchParams(location.search).get('papel');
  const paper = paperParam || store.get('fv-papel');
  if (paper === 'branco') document.documentElement.dataset.paper = 'branco';
  document.querySelectorAll('[data-toggle-paper]').forEach(btn => {
    const sync = () => { btn.textContent = document.documentElement.dataset.paper === 'branco' ? 'Ver com fundo creme' : 'Ver com fundo branco'; };
    sync();
    btn.addEventListener('click', () => {
      const branco = document.documentElement.dataset.paper !== 'branco';
      if (branco) document.documentElement.dataset.paper = 'branco'; else delete document.documentElement.dataset.paper;
      store.set('fv-papel', branco ? 'branco' : 'creme');
      sync();
    });
  });
  document.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => window.print()));
  document.querySelectorAll('[data-close-ribbon]').forEach(b => b.addEventListener('click', () => b.closest('.preview-ribbon')?.remove()));

  // Cabeçalho e botão flutuante
  const header = document.querySelector('header.site');
  const fab = document.querySelector('.fab');
  const onScroll = () => {
    header?.classList.toggle('scrolled', scrollY > 8);
    if (fab) {
      const show = scrollY > innerHeight * 0.8;
      fab.classList.toggle('show', show);
      if (!show) fab.open = false;
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (fab) {
    document.addEventListener('click', e => { if (fab.open && !fab.contains(e.target)) fab.open = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && fab.open) { fab.open = false; fab.querySelector('summary').focus(); } });
  }

  // Menu no celular
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');
  const setMenu = open => {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); } });
  }

  // Aberto agora, no horário de Brasília, para cada unidade
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const fmt = m => { const h = Math.floor(m / 60), mm = m % 60; return h + 'h' + (mm ? String(mm).padStart(2, '0') : ''); };
  function nowBR(){
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    return { wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), min: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10) };
  }
  function statusFor(key){
    const u = units[key]; if (!u) return null;
    const { wd, min } = nowBR();
    const today = u.hours[wd];
    if (today && min >= today[0] && min < today[1]) return { open: true, head: 'Aberta agora', tail: ' · fecha às ' + fmt(today[1]), short: 'aberta até ' + fmt(today[1]) };
    for (let i = 0; i < 8; i++) {
      const d = (wd + i) % 7, h = u.hours[d];
      if (!h) continue;
      if (i === 0 && min < h[0]) return { open: false, head: 'Fechada agora', tail: ' · abre hoje às ' + fmt(h[0]), short: 'abre hoje às ' + fmt(h[0]) };
      if (i === 1) return { open: false, head: 'Fechada agora', tail: ' · abre amanhã às ' + fmt(h[0]), short: 'abre amanhã às ' + fmt(h[0]) };
      if (i > 1) return { open: false, head: 'Fechada agora', tail: ' · abre ' + dias[d] + ' às ' + fmt(h[0]), short: 'abre ' + dias[d] + ' às ' + fmt(h[0]) };
    }
    return null;
  }
  function paintStatus(){
    document.querySelectorAll('[data-status]').forEach(el => {
      const s = statusFor(el.dataset.status); if (!s) return;
      el.classList.toggle('open', s.open);
      const txt = el.querySelector('.txt');
      if (txt) { const b = document.createElement('strong'); b.textContent = s.head; txt.replaceChildren(b, document.createTextNode(s.tail)); }
    });
    document.querySelectorAll('[data-status-short]').forEach(el => {
      const s = statusFor(el.dataset.statusShort); if (s) el.textContent = s.short;
    });
  }
  paintStatus();
  let statusTimer = setInterval(paintStatus, 60000);
  document.addEventListener('visibilitychange', () => {
    clearInterval(statusTimer);
    if (!document.hidden) { paintStatus(); statusTimer = setInterval(paintStatus, 60000); }
  });

  // Lembra a última unidade usada e mede os cliques de WhatsApp
  const last = store.get('fv-unidade');
  if (last) document.querySelectorAll(`.unit-btn[data-unit="${last}"]`).forEach(b => b.classList.add('is-last'));
  const track = (name, props) => { if (typeof window.plausible === 'function') window.plausible(name, { props }); };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-unit]');
    if (a) { store.set('fv-unidade', a.dataset.unit); track('WhatsApp', { unidade: a.dataset.unit, origem: a.dataset.origin || 'site' }); }
    const t = e.target.closest('a[href^="tel:"]');
    if (t) track('Ligação', { numero: t.getAttribute('href').slice(4) });
  });
  if (data.plausibleDomain) {
    window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments); };
    const s = document.createElement('script');
    s.defer = true; s.src = 'https://plausible.io/js/script.js'; s.dataset.domain = data.plausibleDomain;
    document.head.appendChild(s);
  }

  // Rótulo: a sequência toca uma vez quando aparece na tela e termina completa
  const card = document.querySelector('.label-card');
  if (card && !reduce && 'IntersectionObserver' in window) {
    const steps = [...card.querySelectorAll('.steps li')];
    card.classList.add('play');
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      io.disconnect();
      let i = 0;
      const tick = () => {
        steps.forEach((li, k) => { li.classList.toggle('done', k < i); li.classList.toggle('now', k === i); });
        i++;
        if (i <= steps.length) setTimeout(tick, i === 1 ? 300 : 650);
      };
      tick();
    }, { threshold: 0.4 });
    io.observe(card);
  }

  // Mapa só carrega quando a pessoa pede (mais leve e sem cookies do Google antes do clique)
  document.querySelectorAll('[data-map]').forEach(btn => btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.map; f.title = btn.dataset.title || 'Mapa'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    btn.replaceWith(f);
    f.focus();
  }));

  // Formulário do prescritor: monta a mensagem e abre o WhatsApp da unidade escolhida
  const form = document.getElementById('form-prescritor');
  if (form) {
    const fields = ['nome', 'profissao', 'registro', 'unidade', 'mensagem'];
    const check = name => {
      const el = form.elements[name], wrap = el.closest('.field');
      const ok = el.value.trim().length > (name === 'mensagem' ? 9 : 1);
      wrap.classList.toggle('has-error', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    fields.forEach(n => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value) check(n); }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const bad = fields.filter(n => !check(n));
      const status = form.querySelector('.form-status');
      if (bad.length) { status.textContent = 'Confira os campos marcados.'; form.elements[bad[0]].focus(); return; }
      const v = n => form.elements[n].value.trim();
      const u = units[v('unidade')];
      const msg = `Olá! Sou ${v('profissao')}, ${v('nome')} (${v('registro')}), e vim pelo site. ${v('mensagem')}`;
      status.textContent = 'Abrindo o WhatsApp da unidade de ' + u.name + '.';
      track('WhatsApp', { unidade: v('unidade'), origem: 'prescritor' });
      window.open('https://wa.me/' + u.wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
  }
})();
