/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

export function renderOrderStatusFeedback(): string {
  return `
    <dialog class="feedback-dialog" data-order-status-dialog aria-labelledby="order-status-dialog-title">
      <div class="feedback-dialog-icon" aria-hidden="true">!</div>
      <h3 id="order-status-dialog-title">订单状态更新失败</h3>
      <p data-order-status-error>暂时无法更新订单状态，请稍后重试。</p>
      <form method="dialog"><button class="button button-primary" type="submit">知道了</button></form>
    </dialog>
    <script>
      (() => {
        const dialog = document.querySelector('[data-order-status-dialog]');
        const errorText = dialog.querySelector('[data-order-status-error]');
        const showError = (message) => {
          errorText.textContent = message || '暂时无法更新订单状态，请稍后重试。';
          if (typeof dialog.showModal === 'function') dialog.showModal();
          else window.alert(errorText.textContent);
        };
        document.querySelectorAll('.js-order-status-form').forEach((form) => {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (form.dataset.forceConfirm === 'true' && !window.confirm('确定要跳过归还验机并强制将此订单标记为已完成吗？此操作会释放设备，且不能撤销。')) return;
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            try {
              const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok || !payload.ok) throw new Error(payload.error || '订单状态更新失败，请刷新后重试。');
              window.location.reload();
            } catch (error) {
              showError(error instanceof Error ? error.message : '订单状态更新失败，请稍后重试。');
              button.disabled = false;
              button.removeAttribute('aria-busy');
            }
          });
        });
      })();
    </script>`
}
