/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, sanitizePlainText } from '../../site'

export function renderStaffMobileScan(c: Context, user: any, error = '') {
  const safeError = error ? `<div class="page-notification page-notification--error">${sanitizePlainText(error, 300)}</div>` : ''
  const body = `<div class="mobile-scan-page">
    <div class="page-header"><div><p class="section-code">CAMERA / QR WORKFLOW</p><h2>扫码作业</h2><p>用手机后置相机扫描客户邮件中的取货二维码。</p></div><a class="button button-secondary" href="/staff/mobile">今日任务</a></div>
    ${safeError}
    <section class="mobile-scan-panel panel">
      <div id="qr-reader" class="mobile-qr-reader"><div class="mobile-qr-reader__placeholder">点击“打开相机”后开始扫码</div></div>
      <p id="scan-status" class="mobile-scan-status">相机只在你点击按钮后启动。</p>
      <div class="mobile-scan-actions"><button class="button button-primary" type="button" id="start-camera">打开相机</button><button class="button button-secondary" type="button" id="stop-camera" hidden>停止相机</button></div>
      <form method="get" action="/staff/mobile/scan" class="mobile-scan-manual"><label class="form-label" for="scan-code">无法扫码？输入订单号</label><div class="mobile-scan-manual__row"><input class="form-control" id="scan-code" name="code" placeholder="订单号或扫码内容" autocomplete="off" inputmode="search" enterkeyhint="search" required><button class="button button-secondary" type="submit">查找</button></div></form>
    </section>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <script>(()=>{
    const reader=document.getElementById('qr-reader'),start=document.getElementById('start-camera'),stop=document.getElementById('stop-camera'),status=document.getElementById('scan-status');
    if(!reader||!start||!stop||!status)return;
    let scanner=null,stream=null,frame=0,stopped=false;
    const setStatus=value=>{status.textContent=value};
    const stopCamera=()=>{stopped=true;if(frame)cancelAnimationFrame(frame);frame=0;if(scanner){scanner.stop().catch(()=>{});scanner.clear().catch(()=>{});scanner=null}if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}start.hidden=false;stop.hidden=true};
    const go=value=>{const code=String(value||'').trim();if(!code)return;stopCamera();location.href='/staff/mobile/scan?code='+encodeURIComponent(code)};
    const nativeScan=async()=>{if(stopped||!stream)return;try{const detector=new BarcodeDetector({formats:['qr_code']});const video=reader.querySelector('video');if(video?.readyState>=2){const found=await detector.detect(video);if(found?.[0]?.rawValue){go(found[0].rawValue);return}}}catch(_){setStatus('当前浏览器无法识别二维码，请使用下方输入框或刷新后重试。');return}frame=requestAnimationFrame(nativeScan)};
    const startCamera=async()=>{stopped=false;start.hidden=true;stop.hidden=false;setStatus('正在请求相机权限…');try{
      if(window.Html5Qrcode){scanner=new window.Html5Qrcode('qr-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},go,()=>{});setStatus('请将取货二维码放入框内。');return}
      if(!navigator.mediaDevices?.getUserMedia||!window.BarcodeDetector)throw new Error('unsupported');
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});reader.replaceChildren();const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.srcObject=stream;reader.appendChild(video);setStatus('请将取货二维码放入框内。');nativeScan();
    }catch(_){stopCamera();setStatus('无法打开相机。请确认已允许相机权限，并使用 HTTPS 访问；也可以手动输入订单号。')}};
    start.addEventListener('click',startCamera);stop.addEventListener('click',stopCamera);window.addEventListener('pagehide',stopCamera);
  })();</script>`
  return buildLayout('手机扫码作业 - 电脑租赁管理系统', body, user, { compactStaffNav: true })
}
