/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, CONTRACT_VARIABLE_GROUPS, getSystemSettings } from '../../site'

type AgreementKind = 'user' | 'rental'

export function renderAdminTemplateHub(user: any) {
  const body = `
    <div class="panel template-library">
      <div class="section-title">
        <div><h2>协议与合同模板</h2><p class="section-note">先选择要维护的页面，再进入对应的独立编辑器。</p></div>
      </div>
      <div class="template-choice-grid">
        <a class="template-choice-card" href="/admin/templates/user">
          <span class="template-choice-index">01</span>
          <div><h3>用户协议</h3><p>注册及创建正式账户时向用户展示的协议。</p></div>
          <span class="template-choice-action">进入编辑 <span aria-hidden="true">→</span></span>
        </a>
        <a class="template-choice-card" href="/admin/templates/rental">
          <span class="template-choice-index">02</span>
          <div><h3>租赁协议</h3><p>客户签署流程第一步阅读并同意的租赁条款。</p></div>
          <span class="template-choice-action">进入编辑 <span aria-hidden="true">→</span></span>
        </a>
        <a class="template-choice-card" href="/admin/templates/contract">
          <span class="template-choice-index">03</span>
          <div><h3>正式合同模板</h3><p>签署完成后生成正式合同所使用的正文模板。</p></div>
          <span class="template-choice-action">进入编辑 <span aria-hidden="true">→</span></span>
        </a>
      </div>
    </div>`
  return buildLayout('协议与合同模板 - 电脑租赁管理系统', body, user)
}

export function renderAdminAgreementEditor(user: any, kind: AgreementKind) {
  const settings = getSystemSettings()
  const isRental = kind === 'rental'
  const title = isRental ? '编辑租赁协议' : '编辑用户协议'
  const description = isRental ? '用于合同签署流程第一步。变量会在展示时替换为对应合同数据。' : '用于注册和正式账户创建流程。'
  const initialContent = JSON.stringify(isRental ? settings.rentalTerms : settings.userTerms).replace(/</g, '\\u003c')
  const variableIndex = isRental
    ? `<details class="variable-index"><summary>完整合同变量索引（${CONTRACT_VARIABLE_GROUPS.reduce((total, [, names]) => total + names.length, 0)} 项）</summary>${CONTRACT_VARIABLE_GROUPS.map(([group, names]) => `<section class="contract-variable-group"><h5>${group}</h5><div class="variable-chip-list">${names.map(name => `<code>\${${name}}</code>`).join('')}</div></section>`).join('')}</details>`
    : ''
  const body = `
    <div class="panel template-editor-page">
      <div class="section-title template-editor-heading">
        <div><a class="breadcrumb-link" href="/admin/templates">← 返回协议与模板</a><h2>${title}</h2><p class="section-note">${description}</p></div>
      </div>
      <form id="agreementTemplateForm" data-kind="${kind}">
        ${variableIndex}
        <div class="form-group">
          <label for="agreementContentEditor">协议内容</label>
          <div id="agreementContentEditor" class="quill-editor template-rich-editor"></div>
          <textarea id="agreementContent" name="content" hidden></textarea>
        </div>
        <div id="templateSaveStatus" class="template-save-status" role="status" aria-live="polite"></div>
        <div class="form-actions">
          <button type="submit" class="button button-primary">保存${isRental ? '租赁协议' : '用户协议'}</button>
          <a href="/admin/templates" class="button button-secondary">取消</a>
        </div>
      </form>
    </div>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('agreementTemplateForm');
        const status = document.getElementById('templateSaveStatus');
        const submitButton = form.querySelector('button[type="submit"]');
        const editor = window.createRichTextEditor('#agreementContentEditor', {
          theme: 'snow',
          modules: { toolbar: [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote'], ['link'], ['clean']] }
        });
        const initialContent = ${initialContent};
        if (initialContent) editor.root.innerHTML = initialContent;

        form.addEventListener('submit', async function(event) {
          event.preventDefault();
          submitButton.disabled = true;
          status.className = 'template-save-status is-saving';
          status.textContent = '正在保存…';
          try {
            const response = await fetch('/admin/templates/' + form.dataset.kind, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: editor.root.innerHTML })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || '保存失败');
            status.className = 'template-save-status is-success';
            status.textContent = '已保存';
          } catch (error) {
            status.className = 'template-save-status is-error';
            status.textContent = error instanceof Error ? error.message : '保存失败，请重试';
          } finally {
            submitButton.disabled = false;
          }
        });
      });
    </script>`
  return buildLayout(`${title} - 电脑租赁管理系统`, body, user)
}
