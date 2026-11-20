/* Optional Google Form handoff. Does not send or prefill any learner data. */
(()=>{'use strict';
const $=id=>document.getElementById(id),form=$('assignmentForm'),select=$('assignmentScope'),results=window.WorkshopResults;
if(!form||!select||!results||$('assignmentGoogleFormLink'))return;
const option=document.createElement('option');option.value='google-form';option.textContent='使用 Google 表單繳交';select.append(option);
const box=document.createElement('section');box.id='assignmentGoogleForm';box.className='google-form-choice';box.hidden=true;
box.innerHTML='<h4>使用 Google 表單繳交作業</h4><p>在表單填寫姓名、Email、完整提示詞，並上傳 1–10 張圖像。上傳圖片需登入 Google 帳號，每張上限 10MB。</p><p>網站中的資料與已選圖像不會自動帶入表單。可先複製下方完整提示詞，再到表單貼上並選取圖像。</p><div class="google-form-actions"><button type="button" id="assignmentCopyForForm">複製完整提示詞</button><a id="assignmentGoogleFormLink" href="https://forms.gle/6SQCBhey6rATDsku6" target="_blank" rel="noopener noreferrer">開啟 Google 表單繳交 ↗</a></div><p id="assignmentGoogleFormStatus" role="status" aria-live="polite">請在 Google 表單完成填寫並按「提交」，才算完成繳交。</p>';
select.closest('label').after(box);
function update(){const google=select.value==='google-form';box.hidden=!google;
for(const selector of ['.assignment-identity','.assignment-notice','.assignment-consent','#assignmentSubmit','#assignmentStatus','#assignmentReceipt','#assignmentDrop','#assignmentImageCount','#assignmentImagePreview','.upload-small','#assignmentUploadMessage'])form.querySelectorAll(selector).forEach(el=>el.hidden=google);
const foot=form.nextElementSibling;if(foot?.tagName==='SMALL')foot.hidden=google;
if(google){$('assignmentFinalPrompt').required=false;$('assignmentName').required=false;$('assignmentEmail').required=false;}else{$('assignmentName').required=true;$('assignmentEmail').required=true;}
}
const refresh=results.refresh;results.refresh=function(){refresh();update();};select.addEventListener('change',update);
// Native submission belongs to the original two modes; the Form option is a link handoff.
form.addEventListener('submit',e=>{if(select.value==='google-form'){e.preventDefault();e.stopImmediatePropagation();$('assignmentGoogleFormStatus').textContent='請點「開啟 Google 表單繳交」，在表單中完成提交。';}},true);
$('assignmentCopyForForm').addEventListener('click',async()=>{const text=$('assignmentFinalPrompt').value.trim();if(!text){$('assignmentGoogleFormStatus').textContent='請先在下方貼上完整提示詞，或使用「帶入目前圖像／文案提示詞」。';$('assignmentFinalPrompt').focus();return;}try{await navigator.clipboard.writeText(text);$('assignmentGoogleFormStatus').textContent='已複製完整提示詞。請開啟表單貼上，並重新選取要繳交的圖像。';}catch{$('assignmentGoogleFormStatus').textContent='瀏覽器未允許複製，請選取下方提示詞手動複製。';}});
const saved=window.CourseState?.get().assignmentSubmissionMode;if(saved==='google-form')select.value=saved;
const style=document.createElement('style');style.textContent='#assignmentForm [hidden]{display:none!important}.google-form-choice{padding:18px;border:1px solid #c9bdf3;border-radius:12px;background:white;margin:14px 0}.google-form-choice h4{margin:0 0 12px}.google-form-choice p{line-height:1.7}.google-form-actions{display:flex;gap:12px;flex-wrap:wrap}.google-form-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;box-sizing:border-box;padding:12px 18px;border-radius:12px;background:#6651d9;color:white;text-decoration:none;font-weight:600}.google-form-actions button{min-height:44px}#assignmentGoogleFormStatus{font-size:14px;color:#51477a}';document.head.append(style);
update();document.documentElement.dataset.assignmentGoogleForm='20261120';
})();

