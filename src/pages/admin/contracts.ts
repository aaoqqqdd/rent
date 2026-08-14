/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractTemplate, CONTRACT_VARIABLE_GROUPS } from '../../site';
import { Context } from 'hono';

export function renderAdminContractManagement(user: any) {
  const body = `
    <div class="panel template-editor-page">
      <div class="section-title"><div><h2>合同管理</h2><p class="section-note">查看合同签署状态和已归档合同。</p></div><a href="/admin/templates" class="button button-secondary">协议与模板</a></div>
      <div class="template-editor-workspace">
        <div class="section"><h4>合同签署状态</h4><p>查看所有进行中合同的签署进度和状态。</p><a href="/admin/contracts/signing-status" class="button button-secondary">查看签署状态</a></div>
        <div class="section"><h4>合同归档管理</h4><p>管理已完成或已取消的合同归档。</p><a href="/admin/contracts/archive" class="button button-secondary">管理归档</a></div>
      </div>
    </div>`
  return buildLayout('合同管理 - 电脑租赁管理系统', body, user)
}

export async function renderAdminContracts(c: Context, user: any) {
  const currentTemplate = await getContractTemplate(c);
  const safeTemplateName = String(currentTemplate?.name ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const initialTemplateContent = JSON.stringify(String(currentTemplate?.content ?? '')).replace(/</g, '\\u003c');
  const textareaContent = String(currentTemplate?.content ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const completeVariableIndex = CONTRACT_VARIABLE_GROUPS.map(([group, names]) => `<section class="contract-variable-group"><h5>${group}</h5><div class="variable-chip-list">${names.map(name => `<code>\${${name}}</code>`).join('')}</div></section>`).join('')

  const body = `
    <div class="panel">
      <div class="section-title"><div><a class="breadcrumb-link" href="/admin/templates">← 返回协议与模板</a><h2>编辑正式合同模板</h2><span class="section-note">维护签署完成后生成正式合同所使用的正文。</span></div></div>

      <div class="admin-contract-sections">
        <div class="section">
          <h4>合同模板正文</h4>
          <p>变量会在客户完成签署时替换，并冻结为正式合同快照。</p>
          <form id="contractTemplateForm" class="editor-layout-form">
            <div class="form-group">
              <label for="templateName">模板名称</label>
              <input type="text" id="templateName" name="templateName" class="form-control" value="${safeTemplateName}">
            </div>
            <div class="form-group">
              <details class="variable-index" open><summary>完整合同变量索引（${CONTRACT_VARIABLE_GROUPS.reduce((total, [, names]) => total + names.length, 0)} 项）</summary>${completeVariableIndex}</details>
              <label for="templateContentMarkdown">模板内容（支持 HTML 编辑）</label>
              <textarea id="templateContentMarkdown" class="html-editor" placeholder="请输入 HTML 内容">${textareaContent}</textarea>
              <input type="hidden" id="templateContent" name="templateContent">
              <small class="form-text text-muted">请输入 HTML，系统会在生成合同时替换变量。</small>
            </div>
            <div class="form-actions form-actions-right">
              <button type="submit" class="button button-primary">保存模板</button>
            </div>
          </form>
        </div>

      </div>
    </div>

    <script>
      function initContractEditor() {
        const templateContentMarkdown = document.getElementById('templateContentMarkdown');
        const hiddenTemplateContent = document.getElementById('templateContent');
        const templateForm = document.getElementById('contractTemplateForm');

        function getContractTemplateContent() { return templateContentMarkdown.value; }

        const initialContent = ${initialTemplateContent};
        if (initialContent) {
          templateContentMarkdown.value = initialContent;
        }

        templateForm?.addEventListener('submit', function(event) {
          event.preventDefault();
          if (hiddenTemplateContent) {
            hiddenTemplateContent.value = getContractTemplateContent();
          }
          const formData = new FormData(this);
          const newTemplate = {
            id: '${currentTemplate?.id ?? 'default'}',
            name: formData.get('templateName'),
            content: formData.get('templateContent'),
          };

          updateContractTemplate(newTemplate).then(() => {
            alert('合同模板已保存成功！');
          }).catch(error => {
            alert('保存失败: ' + (error instanceof Error ? error.message : '请查看控制台')); 
          });
        });

        document.querySelectorAll('.variable-chip-list code').forEach(item => {
          item.style.cursor = 'pointer';
          item.title = '点击复制';
          item.addEventListener('click', function() {
            const variableName = this.innerText;
            navigator.clipboard.writeText(variableName).then(() => {
              this.style.backgroundColor = 'var(--primary-light)';
              setTimeout(() => {
                this.style.backgroundColor = '';
              }, 300);
            }).catch(err => {
              console.error('复制失败:', err);
              alert('复制失败，请手动复制。');
            });
          });
        });
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initContractEditor, { once: true });
      else initContractEditor();
    </script>
  `;

  return buildLayout('合同管理 - 电脑租赁管理系统', body, user);
}
