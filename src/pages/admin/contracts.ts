/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractTemplate, CONTRACT_VARIABLE_GROUPS, createPageBreakHtml } from '../../site';
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
  const completeVariableIndex = CONTRACT_VARIABLE_GROUPS.map(([group, names]) => `<section class="contract-variable-group"><h5>${group}</h5><div class="variable-chip-list">${names.map(name => `<code>\${${name}}</code>`).join('')}</div></section>`).join('')
  const pageBreakMarkup = JSON.stringify(createPageBreakHtml())

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
              <label for="templateContentEditor">模板内容</label>
              <div class="editor-mode-toggle">
                <button type="button" id="templateModeHtml" class="active">可视编辑</button>
                <button type="button" id="templateModeMd">Markdown</button>
              </div>
              <div class="editor-card">
                <div id="templateContentEditor" class="quill-editor"></div>
              </div>
              <textarea id="templateContentMarkdown" class="markdown-editor" placeholder="请输入 Markdown 内容"></textarea>
              <input type="hidden" id="templateContent" name="templateContent">
              <small class="form-text text-muted">已集成 Quill 富文本编辑器，可直接格式化合同文本。您可以在模板中使用上面列出的变量，系统会在生成合同时自动替换它们；也可以通过编辑器里的“分页”按钮插入分页符。</small>
            </div>
            <div class="template-controls">
              <button type="button" id="contractTemplatePreviewButton" class="button button-secondary">预览变量效果</button>
              <span class="section-note">点击预览当前模板在示例订单中的变量替换效果。</span>
            </div>
            <div id="contractTemplatePreview" class="template-preview"></div>
            <div class="form-actions form-actions-right">
              <button type="submit" class="button button-primary">保存模板</button>
            </div>
          </form>
        </div>

      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const pageBreakHtml = ${pageBreakMarkup};
        const editor = window.createRichTextEditor('#templateContentEditor', {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ font: [] }, { size: ['small', false, 'large', 'huge'] }, 'bold', 'italic', 'underline', 'strike', { color: [] }, { background: [] }],
              [{ header: [1, 2, 3, false] }, { list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }, { align: [] }, 'blockquote', 'code-block', 'link', 'clean']
            ]
          }
        });

        const toolbar = editor.getModule ? editor.getModule('toolbar').container : null;
        if (toolbar) {
          const pageBreakButton = document.createElement('button');
          pageBreakButton.type = 'button';
          pageBreakButton.className = 'ql-page-break';
          pageBreakButton.title = '插入分页符';
          pageBreakButton.textContent = '分页';
          pageBreakButton.addEventListener('click', function(event) {
            event.preventDefault();
            const range = editor.getSelection ? editor.getSelection(true) : null;
            const index = range ? range.index : (editor.root ? editor.root.innerHTML.length : 0);
            if (editor.clipboard && typeof editor.clipboard.dangerouslyPasteHTML === 'function') {
              editor.clipboard.dangerouslyPasteHTML(index, pageBreakHtml);
            } else if (editor.root) {
              editor.root.innerHTML += pageBreakHtml;
            }
          });
          toolbar.appendChild(pageBreakButton);
        }

        const templateModeHtml = document.getElementById('templateModeHtml');
        const templateModeMd = document.getElementById('templateModeMd');
        const templateContentMarkdown = document.getElementById('templateContentMarkdown');
        const hiddenTemplateContent = document.getElementById('templateContent');
        const contractTemplatePreviewButton = document.getElementById('contractTemplatePreviewButton');
        const contractTemplatePreview = document.getElementById('contractTemplatePreview');
        const templateForm = document.getElementById('contractTemplateForm');

        function getContractTemplateContent() {
          if (templateForm?.classList.contains('is-markdown-mode')) {
            return window.markdownToHtml(templateContentMarkdown.value);
          }
          return editor.root ? editor.root.innerHTML : '';
        }

        function switchContractMode(toMd) {
          if (!templateModeHtml || !templateModeMd || !templateContentMarkdown) return;
          if (toMd) {
            templateContentMarkdown.value = window.htmlToMarkdown(editor.root.innerHTML);
            templateForm.classList.add('is-markdown-mode');
            templateModeMd.classList.add('active');
            templateModeHtml.classList.remove('active');
          } else {
            editor.root.innerHTML = window.markdownToHtml(templateContentMarkdown.value);
            templateForm.classList.remove('is-markdown-mode');
            templateModeMd.classList.remove('active');
            templateModeHtml.classList.add('active');
          }
        }

        async function updateContractTemplatePreview() {
          if (!contractTemplatePreview) return;
          contractTemplatePreview.textContent = '正在生成预览...';
          try {
            const response = await fetch('/admin/templates/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kind: 'contract', content: getContractTemplateContent() })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || '预览失败');
            contractTemplatePreview.innerHTML = result.html || '<p>无预览内容</p>';
          } catch (error) {
            contractTemplatePreview.textContent = error instanceof Error ? error.message : '预览失败';
          }
        }

        contractTemplatePreviewButton?.addEventListener('click', updateContractTemplatePreview);
        templateModeHtml?.addEventListener('click', function () { switchContractMode(false); });
        templateModeMd?.addEventListener('click', function () { switchContractMode(true); });

        const initialContent = ${initialTemplateContent};
        if (initialContent) {
          editor.root.innerHTML = initialContent;
          if (templateContentMarkdown) {
            templateContentMarkdown.value = window.htmlToMarkdown(initialContent);
          }
        }
        switchContractMode(false);

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
            updateContractTemplatePreview?.();
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
      });
    </script>
  `;

  return buildLayout('合同管理 - 电脑租赁管理系统', body, user);
}
