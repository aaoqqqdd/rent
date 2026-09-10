/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

(() => {
  const header = document.querySelector('[data-header]');
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('open', open);
  });

  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    navToggle?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }));

  const tabs = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const selectTab = (selected) => {
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab === selected)));
    panels.forEach((panel) => {
      const active = panel.dataset.panel === selected.dataset.tab;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next].focus();
      selectTab(tabs[next]);
    });
  });

  const inventoryGrid = document.querySelector('#inventory-grid');
  const inventoryCount = document.querySelector('#inventory-count');
  const inventoryUpdated = document.querySelector('#inventory-updated');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const formatMoney = (value) => new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 2
  }).format(Number(value) || 0);

  const renderInventory = async () => {
    if (!inventoryGrid) return;
    try {
      const response = await fetch('/api/devices', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('device request failed');
      const payload = await response.json();
      const devices = Array.isArray(payload.devices) ? payload.devices : [];
      inventoryCount.textContent = `${devices.length} 台设备`;
      inventoryUpdated.textContent = `更新于 ${new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit'
      }).format(new Date(payload.updatedAt))}`;

      if (!devices.length) {
        inventoryGrid.innerHTML = '<div class="inventory-empty">当前没有可展示的设备，请稍后再来查看。</div>';
        return;
      }

      inventoryGrid.innerHTML = devices.map((device) => {
        const specs = (Array.isArray(device.specs) ? device.specs : []).slice(0, 4)
          .map((spec) => `<span title="${escapeHtml(spec)}">${escapeHtml(spec)}</span>`).join('');
        return `<article class="inventory-card">
          <div class="inventory-card__top">
            <span class="inventory-card__brand">${escapeHtml(device.brand || 'PC RENTAL')}</span>
            <span class="inventory-card__status${device.available ? '' : ' unavailable'}">${device.available ? '可租' : '暂不可租'}</span>
          </div>
          <h3>${escapeHtml(device.name)}</h3>
          <p class="inventory-card__model">${escapeHtml(device.model)}</p>
          <div class="inventory-card__specs">${specs || '<span>配置请咨询</span>'}</div>
          <div class="inventory-card__price">
            <div><small>每日租金</small><strong>${formatMoney(device.pricePerDay)} <span>/ 天</span></strong></div>
            <span>押金<br>${formatMoney(device.depositAmount)}</span>
          </div>
        </article>`;
      }).join('');
    } catch {
      inventoryCount.textContent = '暂时离线';
      inventoryUpdated.textContent = '设备数据读取失败';
      inventoryGrid.innerHTML = '<div class="inventory-empty">暂时无法同步设备信息，请稍后刷新页面重试。</div>';
    } finally {
      inventoryGrid.setAttribute('aria-busy', 'false');
    }
  };
  renderInventory();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((item) => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    reveals.forEach((item) => observer.observe(item));
  }
})();
