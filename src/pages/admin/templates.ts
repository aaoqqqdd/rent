/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, CONTRACT_VARIABLE_GROUPS, getSystemSettings } from '../../site'

type AgreementKind = 'user' | 'rental' | 'service' | 'privacy' | 'copyright'

export function renderAdminTemplateHub(user: any) {
  const body = `
    <div class="entity-header template-library-header"><div class="identity-strip mono"><span>DOCUMENT CONTROL</span><span>6 ACTIVE TEMPLATES</span></div><div class="entity-heading"><div><p class="section-code">LEGAL & CONTRACTS</p><h2>协议与合同模板</h2><p>管理注册、租赁签署、网站法律信息和正式合同文本。</p></div></div></div>
    <div class="panel template-register">
      <div class="template-register__labels mono"><span>文档</span><span>显示位置</span><span>类型</span><span>操作</span></div>
      <article class="template-register__row">
        <div class="template-register__document"><span class="document-mark">UA</span><div><h3>用户协议</h3><p>账户注册与正式账户升级时确认。</p></div></div>
        <p>注册页面</p><span class="badge badge-neutral">法律文本</span><a class="button button-sm button-secondary" href="/admin/templates/user">编辑协议</a>
      </article>
      <article class="template-register__row"><div class="template-register__document"><span class="document-mark">ST</span><div><h3>网站服务条款</h3><p>说明网站功能、合理使用和服务规则。</p></div></div><p>全站右下角</p><span class="badge badge-neutral">网站法务</span><a class="button button-sm button-secondary" href="/admin/templates/service">编辑条款</a></article>
      <article class="template-register__row"><div class="template-register__document"><span class="document-mark">PP</span><div><h3>隐私政策</h3><p>说明个人资料、付款信息和保存方式。</p></div></div><p>全站右下角</p><span class="badge badge-neutral">网站法务</span><a class="button button-sm button-secondary" href="/admin/templates/privacy">编辑政策</a></article>
      <article class="template-register__row"><div class="template-register__document"><span class="document-mark">RF</span><div><h3>退款政策</h3><p>说明订单取消、押金退还和退款方式。</p></div></div><p>全站右下角</p><span class="badge badge-neutral">退款规则</span><a class="button button-sm button-secondary" href="/admin/templates/copyright">编辑政策</a></article>
      <article class="template-register__row">
        <div class="template-register__document"><span class="document-mark">RA</span><div><h3>租赁协议</h3><p>客户签署流程第一步阅读并同意。</p></div></div>
        <p>签署步骤 1</p><span class="badge badge-neutral">支持变量</span><a class="button button-sm button-secondary" href="/admin/templates/rental">编辑协议</a>
      </article>
      <article class="template-register__row">
        <div class="template-register__document"><span class="document-mark">CT</span><div><h3>正式合同</h3><p>签署完成后冻结并生成可下载合同。</p></div></div>
        <p>正式合同</p><span class="badge badge-neutral">支持变量</span><a class="button button-sm button-secondary" href="/admin/templates/contract">编辑模板</a>
      </article>
    </div>`
  return buildLayout('协议与合同模板 - 电脑租赁管理系统', body, user)
}

export function renderAdminAgreementEditor(user: any, kind: AgreementKind) {
  const settings = getSystemSettings()
  const isRental = kind === 'rental'
  const documentMeta = {
    user: ['编辑用户协议', '用于注册和正式账户创建流程。', settings.userTerms],
    rental: ['编辑租赁协议', '用于合同签署流程第一步。变量会在展示时替换为对应合同数据。', settings.rentalTerms],
    service: ['编辑网站服务条款', '显示在全站右下角的服务条款页面。', settings.serviceTerms],
    privacy: ['编辑隐私政策', '显示在全站右下角的隐私政策页面。', settings.privacyPolicy],
    copyright: ['编辑退款政策', '显示在全站右下角的退款政策页面。', settings.copyrightNotice],
  }[kind]
  const [title, description, content] = documentMeta
  const metadata = getSystemSettings().legalMetadata?.[kind] || { version: '1.0', lastUpdatedDate: '' }
  const initialContent = JSON.stringify(content).replace(/</g, '\\u003c')
  const textareaContent = String(content ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const agreementVariables: Record<AgreementKind, string[]> = {
    user: ['user_agreement_version', 'user_agreement_last_updated_date', 'company_name', 'company_address', 'company_email', 'company_phone'],
    service: ['service_terms_version', 'service_terms_last_updated_date', 'company_name', 'company_address', 'company_email', 'company_phone'],
    privacy: ['privacy_policy_version', 'privacy_policy_last_updated_date', 'company_name', 'company_address', 'company_email', 'company_phone'],
    copyright: ['refund_policy_version', 'refund_policy_last_updated_date', 'company_name', 'company_address', 'company_email', 'company_phone'],
    rental: ['rental_agreement_version', 'rental_agreement_last_updated_date', 'contract_version', 'contract_last_updated_date', 'customer_name', 'customer_email', 'device_name', 'start_date', 'end_date', 'total_rent', 'deposit_amount', 'company_name'],
  }
  const variableNames = agreementVariables[kind]
  const variableIndex = `<details class="variable-index"><summary>本协议支持的变量（${variableNames.length} 项）</summary><section class="contract-variable-group"><div class="variable-chip-list">${variableNames.map(name => `<code>\${${name}}</code>`).join('')}</div></section></details>`
  const body = `
    <div class="panel template-editor-page">
      <div class="section-title template-editor-heading">
        <div>
          <a class="breadcrumb-link" href="/admin/templates">← 返回协议与模板</a>
          <h2>${title}</h2>
          <p class="section-note">${description}</p>
        </div>
      </div>
      <form id="agreementTemplateForm" data-kind="${kind}" class="editor-layout-form">
        <input type="hidden" id="agreementKind" name="kind" value="${kind}">
        ${variableIndex}
        <div class="form-group">
          <div class="grid grid-2"><div><label class="form-label" for="agreementVersion">协议版本</label><input class="form-control" id="agreementVersion" name="version" value="${metadata.version || '1.0'}" required></div><div><label class="form-label" for="agreementLastUpdatedDate">最后更新日期</label><input class="form-control" id="agreementLastUpdatedDate" name="lastUpdatedDate" type="date" value="${metadata.lastUpdatedDate || ''}"><small class="form-text">留空时保存当天日期。</small></div></div>
          <label for="agreementContentMarkdown">协议内容（支持 HTML 编辑）</label>
          <textarea id="agreementContentMarkdown" name="content" class="html-editor" placeholder="请输入 HTML 内容">${textareaContent}</textarea>
        </div>
        <div id="templateSaveStatus" class="template-save-status" role="status" aria-live="polite"></div>
        <div class="form-actions form-actions-right">
          <a href="/admin/templates" class="button button-secondary">取消</a>
          <button type="submit" class="button button-primary">保存${title.replace('编辑', '')}</button>
        </div>
      </form>
    </div>
    <script>
      function initAgreementEditor() {
        const form = document.getElementById('agreementTemplateForm');
        const status = document.getElementById('templateSaveStatus');
        const submitButton = form.querySelector('button[type="submit"]');
        const agreementContentMarkdown = document.getElementById('agreementContentMarkdown');

        const initialContent = ${initialContent};
        if (initialContent) {
          agreementContentMarkdown.value = initialContent;
        }

        function getAgreementContent() { return agreementContentMarkdown.value; }

        const agreementKindInput = document.getElementById('agreementKind');

        form.addEventListener('submit', async function(event) {
          event.preventDefault();
          submitButton.disabled = true;
          status.className = 'template-save-status is-saving';
          status.textContent = '正在保存…';
          try {
            const response = await fetch('/admin/templates/' + form.dataset.kind, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: getAgreementContent(), version: document.getElementById('agreementVersion').value, lastUpdatedDate: document.getElementById('agreementLastUpdatedDate').value })
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
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAgreementEditor, { once: true });
      else initAgreementEditor();
    </script>`
  return buildLayout(`${title} - 电脑租赁管理系统`, body, user)
}
