(() => {
  'use strict';
  const configurationURL = document.currentScript.dataset.config;
  const form = document.querySelector('#unlock-form');
  const input = document.querySelector('#access-password');
  const submit = document.querySelector('#unlock-button');
  const message = document.querySelector('#unlock-message');
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const objectURLs = new Set();
  let unlocked = false;

  function safePath(value) {
    if (typeof value !== 'string' || !/^data\/[a-f0-9]{32}\.bin$/.test(value)) throw new Error('Invalid resource.');
    return value;
  }
  async function fetchBytes(url) {
    const response = await fetch(url, {cache:'no-store', credentials:'same-origin', referrerPolicy:'no-referrer'});
    if (!response.ok) throw new TypeError('Resource unavailable.');
    return new Uint8Array(await response.arrayBuffer());
  }
  async function decrypt(bytes, key, associatedData) {
    if (bytes.length < 33 || decoder.decode(bytes.subarray(0,4)) !== 'EG01') throw new Error('Invalid encrypted resource.');
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(4,16),additionalData:encoder.encode(associatedData),tagLength:128},key,bytes.subarray(16)));
  }
  function base64Bytes(text) {return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
  function showNotice(text) {
    const toast = document.querySelector('#toast');
    if (toast) {toast.textContent=text;toast.hidden=false;setTimeout(()=>toast.hidden=true,3500);}
  }
  function releaseObjects() {for(const url of objectURLs) URL.revokeObjectURL(url);objectURLs.clear();}
  window.addEventListener('pagehide',releaseObjects);
  window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});

  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (unlocked || !input.value) return;
    if (!globalThis.crypto?.subtle || !window.isSecureContext) {message.textContent='請使用 HTTPS 網址與新版瀏覽器開啟圖庫。';return;}
    submit.disabled=true;submit.textContent='解鎖中…';message.textContent='';
    try {
      const response=await fetch(configurationURL,{cache:'no-store',credentials:'same-origin',referrerPolicy:'no-referrer'});
      if(!response.ok) throw new TypeError('Configuration unavailable.');
      const configuration=await response.json();
      if(configuration.schema!==1 || !Number.isInteger(configuration.iterations) || configuration.iterations<600000 || configuration.iterations>2000000) throw new Error('Invalid configuration.');
      const salt=base64Bytes(configuration.salt);
      if(salt.length<16 || salt.length>32) throw new Error('Invalid salt.');
      const passwordBytes=encoder.encode(input.value);
      input.value='';
      const baseKey=await crypto.subtle.importKey('raw',passwordBytes,'PBKDF2',false,['deriveKey']);
      passwordBytes.fill(0);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:configuration.iterations},baseKey,{name:'AES-GCM',length:256},false,['decrypt']);
      const encrypted=await fetchBytes(safePath(configuration.catalog));
      const payload=JSON.parse(decoder.decode(await decrypt(encrypted,key,'private-gallery-catalog-v1')));
      if(payload.schema!==1 || typeof payload.body!=='string' || typeof payload.css!=='string' || typeof payload.script!=='string' || !payload.assets) throw new Error('Invalid catalog.');
      installGallery(payload,key);
      unlocked=true;
    } catch(error) {
      input.value='';submit.disabled=false;submit.textContent='開啟圖庫';
      message.textContent=error?.name==='OperationError'?'密碼不正確，請再試一次。':'暫時無法開啟圖庫，請確認網路後再試。';
      input.focus();
    }
  });

  function installGallery(payload,key) {
    const cache=new Map();
    async function assetURL(logicalPath) {
      if(!Object.prototype.hasOwnProperty.call(payload.assets,logicalPath)) throw new Error('Unknown asset.');
      if(cache.has(logicalPath)) return cache.get(logicalPath);
      const operation=(async()=>{
        const descriptor=payload.assets[logicalPath];
        const bytes=await decrypt(await fetchBytes(safePath(descriptor.file)),key,logicalPath);
        const blob=new Blob([bytes],{type:descriptor.mime});
        const url=URL.createObjectURL(blob);objectURLs.add(url);return url;
      })();
      cache.set(logicalPath,operation);
      try{return await operation;}catch(error){cache.delete(logicalPath);throw error;}
    }

    document.title=payload.title;
    const style=document.createElement('style');style.textContent=payload.css;document.head.append(style);
    document.querySelector('link[href="unlock.css"]')?.remove();
    document.body.innerHTML=payload.body;
    const lockButton=document.createElement('button');
    lockButton.className='lock-gallery';lockButton.textContent='鎖定圖庫';lockButton.type='button';
    lockButton.addEventListener('click',()=>{releaseObjects();window.location.reload();});
    document.querySelector('.eyebrow').append(lockButton);

    const registered=new WeakSet();
    async function loadImage(img) {
      const source=img.dataset.secretSrc;
      if(!source) return;
      try{img.src=await assetURL(source);img.removeAttribute('data-secret-error');}
      catch{img.dataset.secretError='true';img.alt=img.alt||'圖片暫時無法讀取';}
    }
    const intersection='IntersectionObserver' in window?new IntersectionObserver(entries=>{
      for(const entry of entries) if(entry.isIntersecting){intersection.unobserve(entry.target);loadImage(entry.target);}
    },{rootMargin:'350px 0px',threshold:0}):null;
    const fallbackImages=new Set();
    function checkVisibleFallback(){for(const img of fallbackImages){const r=img.getBoundingClientRect();if(r.width&&r.height&&r.bottom>=-350&&r.top<=innerHeight+350){fallbackImages.delete(img);loadImage(img);}}}
    function observe(root) {
      const images=[];
      if(root.matches?.('img[data-secret-src]')) images.push(root);
      if(root.querySelectorAll) images.push(...root.querySelectorAll('img[data-secret-src]'));
      for(const img of images){if(registered.has(img))continue;registered.add(img);intersection?intersection.observe(img):fallbackImages.add(img);}
      if(!intersection) checkVisibleFallback();
    }
    new MutationObserver(changes=>{for(const change of changes){for(const node of change.addedNodes)if(node.nodeType===1)observe(node);}if(!intersection)checkVisibleFallback();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
    if(!intersection){window.addEventListener('scroll',checkVisibleFallback,{passive:true});window.addEventListener('resize',checkVisibleFallback);}

    async function handleSecretAnchor(event){
      if(event.type==='auxclick'&&event.button!==1) return;
      if(event.type==='click'&&event.button!==0) return;
      const anchor=event.target.closest('a[data-secret-href]');
      if(!anchor) return;
      if(event.type==='click'&&anchor.hasAttribute('data-preview')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey) return;
      event.preventDefault();
      const logicalPath=anchor.dataset.secretHref;
      const download=anchor.hasAttribute('download');
      const newWindow=download?null:window.open('about:blank','_blank');
      if(newWindow)newWindow.opener=null;
      try{
        const url=await assetURL(logicalPath);
        if(download){const link=document.createElement('a');link.href=url;link.download=anchor.getAttribute('download')||logicalPath.split('/').pop();document.body.append(link);link.click();link.remove();}
        else if(newWindow)newWindow.location.replace(url);
        else {anchor.href=url;anchor.removeAttribute('data-secret-href');showNotice('原圖已準備好，請再次點擊開啟。');}
      }catch{if(newWindow)newWindow.close();showNotice('圖片暫時無法讀取，請稍後再試。');}
    }
    document.addEventListener('click',handleSecretAnchor,true);
    document.addEventListener('auxclick',handleSecretAnchor,true);

    const api=Object.freeze({assetURL,observe});
    new Function('secretGallery',payload.script)(api);
    observe(document.body);
  }
})();
