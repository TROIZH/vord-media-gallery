(() => {
  'use strict';
  const catalog=window.MEDIA_CATALOG;
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const icon={expand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>',play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 3 15 9-15 9z"/></svg>'};
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  if(!catalog){$('#count-summary').textContent='素材清单未加载';$('#gallery').textContent='请通过“启动素材展厅.command”打开，或先运行素材索引脚本。';return;}
  const labels={current:'Landing 现用',candidate:'待选作品',deferred:'暂缓方向'};
  const descriptions={current:'已用于当前原型，按展示顺序排列',candidate:'新方向与候选作品，尚未替换 Landing',deferred:'目前不采用，保留这些独立方向供以后参考'};
  const filter={kind:'all',category:'all',status:'all',query:''};
  let shown=[],sequence=[],index=0,media=null,auto=false,timer=null,toastTimer=null,muted=true,previousFocus=null;
  const dialog=$('#viewer');
  const displayName=item=>`${item.code} · ${item.title}`;
  const collectionName=item=>catalog.collections?.find(group=>group.id===item.collection)?.title||'';
  const formatDuration=seconds=>`${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,'0')}`;
  function message(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
  function reset(){Object.assign(filter,{kind:'all',category:'all',status:'all',query:''});$('#status').value='all';$('#search').value='';render();}
  function card(item){
    const article=el('article','art-card');article.dataset.assetId=item.id;
    const button=el('button','art-view');button.setAttribute('aria-label',`${item.kind==='video'?'播放':'查看'}：${displayName(item)}`);
    const img=el('img');img.src=item.thumb;img.alt=displayName(item);img.width=item.width;img.height=item.height;img.loading='lazy';img.decoding='async';button.append(img);
    if(item.kind==='video'){button.append(el('span','media-label',`${formatDuration(item.duration)} 视频`));const play=el('span','play-disc');play.innerHTML=icon.play;button.append(play);}
    button.append(el('span','asset-code',item.code));
    const expand=el('span','open-glyph');expand.innerHTML=icon.expand;button.append(expand);button.addEventListener('click',()=>open(item.id));
    const info=el('div','art-info');const copy=el('div');copy.append(el('h3','',displayName(item)),el('p','art-meta',`${item.category} · ${item.width} × ${item.height}`));info.append(copy,el('span',`status-dot ${item.status}`,labels[item.status]));article.append(button,info);return article;
  }
  function appendMediaGroups(parent,items,headingTag){
    const ordered=[];
    for(const kind of ['image','video']){
      const members=items.filter(item=>item.kind===kind);if(!members.length)continue;
      const group=el('div','media-group');group.dataset.kind=kind;
      const heading=el('div','media-group-heading');heading.append(el(headingTag,'',kind==='image'?'图片':'视频'),el('span','section-count',String(members.length)));
      const grid=el('div','grid');members.forEach(item=>grid.append(card(item)));
      group.append(heading,grid);parent.append(group);ordered.push(...members);
    }
    return ordered;
  }
  function render(){
    shown=catalog.items.filter(i=>(filter.kind==='all'||i.kind===filter.kind)&&(filter.category==='all'||i.category===filter.category)&&(filter.status==='all'||i.status===filter.status)&&(!filter.query||`${i.code} ${i.title} ${i.note} ${i.fileName} ${i.category} ${i.owner} ${collectionName(i)}`.toLowerCase().includes(filter.query.toLowerCase())));
    $$('[data-kind]').forEach(b=>{const a=b.dataset.kind===filter.kind;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a);});
    $$('[data-category]').forEach(b=>{const a=b.dataset.category===filter.category;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a);});
    $('#gallery').replaceChildren();
    const ordered=[];
    for(const status of ['current','candidate','deferred']){
      const group=shown.filter(i=>i.status===status);if(!group.length)continue;
      const section=el('section','collection');section.dataset.collection=status;
      const heading=el('div','collection-heading');heading.append(el('h2','',labels[status]),el('span','section-count',String(group.length)),el('p','',descriptions[status]));
      section.append(heading);
      if(status==='candidate'&&catalog.collections?.length){
        const groups=[...catalog.collections,{id:'',title:'待分类作品',description:''}];
        for(const collection of groups){
          const members=group.filter(i=>(i.collection||'')===collection.id);if(!members.length)continue;
          const subgroup=el('div','subcollection');subgroup.dataset.crossover=collection.id;
          const subheading=el('div','subcollection-heading');subheading.append(el('h3','',collection.title),el('span','section-count',String(members.length)));
          subgroup.append(subheading);ordered.push(...appendMediaGroups(subgroup,members,'h4'));section.append(subgroup);
        }
      }else{
        ordered.push(...appendMediaGroups(section,group,'h3'));
      }
      $('#gallery').append(section);
    }
    shown=ordered;
    $('#empty').hidden=shown.length>0;$('#present').disabled=!shown.length;
    $('#result-count').textContent=`显示 ${shown.length} / ${catalog.items.length} 件作品`;
    $('#clear').hidden=filter.kind==='all'&&filter.category==='all'&&filter.status==='all'&&!filter.query;
  }
  function clearClock(){clearTimeout(timer);timer=null;}
  function schedule(){
    clearClock();if(!auto||!dialog.open)return;
    if(media?.tagName==='VIDEO'){if(media.ended){timer=setTimeout(()=>move(1),1000);}else media.play().catch(()=>{setAuto(false);message('浏览器暂停了播放，请点视频播放键。');});}
    else timer=setTimeout(()=>move(1),6000);
  }
  function setAuto(value){auto=value;$('#auto').textContent=auto?'暂停放映':'自动放映';$('#auto').classList.toggle('active',auto);$('#auto').setAttribute('aria-label',auto?'暂停自动放映':'开始自动放映');$('#auto').setAttribute('aria-pressed',String(auto));schedule();}
  function release(){clearClock();if(media?.tagName==='VIDEO'){media.pause();media.removeAttribute('src');media.load();}media=null;}
  function renderDetails(item){
    const details=$('#details');details.replaceChildren(el('h3','','素材信息'));
    if(item.note)details.append(el('p','',item.note));
    if(collectionName(item))details.append(el('p','',collectionName(item)));
    const dl=el('dl');
    for(const [key,value] of [['编号',item.code],['状态',labels[item.status]],['来源任务',item.owner],['格式',`${item.kind==='video'?'视频':'图片'} · ${item.width} × ${item.height}${item.duration?` · ${item.duration.toFixed(2)}秒`:''}`],['文件日期',item.fileDate],['文件大小',`${(item.bytes/1048576).toFixed(1)} MB`],['原文件名',item.fileName]]){dl.append(el('dt','',key),el('dd','',value));}
    if(item.sourcePaths?.length){dl.append(el('dt','','本地来源'));item.sourcePaths.forEach(p=>dl.append(el('dd','path',p)));}
    details.append(dl);const a=el('a','','下载原文件');a.href=item.src;a.download=item.fileName;details.append(a);
    details.append(el('p','','内部创作素材；不代表 VORD 后端能力实测或商用授权结论。'));
  }
  function show(){
    release();const item=sequence[index];if(!item)return;
    const stage=$('#stage');stage.replaceChildren();
    media=document.createElement(item.kind==='video'?'video':'img');media.src=item.src;
    if(item.kind==='video'){
      media.controls=true;media.playsInline=true;media.muted=muted;media.preload='auto';media.poster=item.thumb;media.setAttribute('aria-label',displayName(item));
      media.addEventListener('volumechange',()=>{if(media?.tagName==='VIDEO')muted=media.muted;});
      media.addEventListener('ended',()=>{if(auto)timer=setTimeout(()=>move(1),800);});
    }else{media.alt=displayName(item);media.decoding='async';}
    media.addEventListener('error',()=>{setAuto(false);stage.replaceChildren(el('div','media-error','这个文件暂时无法播放或显示，请在素材信息中检查原文件。'));});
    stage.append(media);$('#viewer-counter').textContent=`${index+1} / ${sequence.length}`;$('#viewer-title').textContent=displayName(item);$('#viewer-status').textContent=`${labels[item.status]} · ${item.kind==='video'?`${formatDuration(item.duration)} 视频`:item.category}`;
    $('#viewer-hint').textContent=item.kind==='video'?'默认静音 · 可用播放器打开声音':'← → 切换作品 · F 全屏';renderDetails(item);
    $('#prev').disabled=sequence.length<2;$('#next').disabled=sequence.length<2;
    if(item.kind==='video')media.play().catch(()=>{});
    schedule();
  }
  function open(id){
    previousFocus=document.activeElement;sequence=[...shown];index=Math.max(0,sequence.findIndex(i=>i.id===id));if(!sequence.length)return;
    $('#details').hidden=true;$('#info').setAttribute('aria-expanded','false');$('#info').classList.remove('active');
    auto=false;$('#auto').textContent='自动放映';$('#auto').classList.remove('active');$('#auto').setAttribute('aria-label','开始自动放映');$('#auto').setAttribute('aria-pressed','false');
    dialog.showModal();document.body.style.overflow='hidden';show();$('#close').focus();
  }
  function move(delta){if(!sequence.length)return;index=(index+delta+sequence.length)%sequence.length;show();}
  async function close(){
    setAuto(false);release();if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
    dialog.close();$('#stage').replaceChildren();document.body.style.overflow='';previousFocus?.focus();
  }
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(dialog.requestFullscreen)await dialog.requestFullscreen();else message('当前浏览器不支持全屏；放映窗口已最大化。');}catch{message('当前浏览器未允许全屏，可直接使用放映窗口。');}
  }
  $$('[data-kind]').forEach(b=>b.addEventListener('click',()=>{filter.kind=b.dataset.kind;render();}));
  $$('[data-category]').forEach(b=>b.addEventListener('click',()=>{filter.category=b.dataset.category;render();}));
  $('#search').addEventListener('input',e=>{filter.query=e.target.value.trim();render();});$('#status').addEventListener('change',e=>{filter.status=e.target.value;render();});
  $('#clear').addEventListener('click',reset);$('#empty-reset').addEventListener('click',reset);
  $('#present').addEventListener('click',()=>{open(shown[0]?.id);fullscreen();});$('#prev').addEventListener('click',()=>move(-1));$('#next').addEventListener('click',()=>move(1));$('#close').addEventListener('click',close);
  $('#auto').addEventListener('click',()=>setAuto(!auto));$('#fullscreen').addEventListener('click',fullscreen);
  $('#info').addEventListener('click',()=>{setAuto(false);const hidden=!$('#details').hidden;$('#details').hidden=hidden;$('#info').setAttribute('aria-expanded',String(!hidden));$('#info').classList.toggle('active',!hidden);});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  document.addEventListener('keydown',e=>{
    if(!dialog.open||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}else if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key.toLowerCase()==='f'){e.preventDefault();fullscreen();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){setAuto(false);if(media?.tagName==='VIDEO')media.pause();}});
  $('#all-count').textContent=catalog.counts.total;$('#image-count').textContent=catalog.counts.images;$('#video-count').textContent=catalog.counts.videos;
  $('#count-summary').textContent=`${catalog.counts.images} 张图片 / ${catalog.counts.videos} 条视频`;
  $('#update-time').textContent=`整理于 ${new Date(catalog.generatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}`;
  $('#scope').textContent=catalog.scope;
  render();
})();
