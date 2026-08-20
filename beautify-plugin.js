/* ============================================================================
 * DSH Beautification Tool — Client Plugin (v18)
 * ============================================================================
 * Fixed: separate useEffect for each setting change, reliable persistence.
 * ========================================================================== */

return {
  inject: ['timer'],
  apply(ctx) {
    var slots = ctx.get('slots')
    if (!slots) return
    var timer = ctx.timer

    var STORAGE_KEY = 'dsh-beautify-settings'
    function loadSettings() { try { var r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null } catch (e) { return null } }
    function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch (e) {} }

    var I18N = {
      zh: { title: '背景', source: '图源', opacity: '不透明度', blur: '模糊', autoRefresh: '自动刷新', interval: '刷新间隔', refreshNow: '立即刷新', clear: '清除', current: '当前背景', customPlaceholder: 'https://example.com/image.jpg', enterUrl: '请输入图片URL', uploadBtn: '选择图片', lang: 'English' },
      en: { title: 'Background', source: 'Source', opacity: 'Opacity', blur: 'Blur', autoRefresh: 'Auto-Refresh', interval: 'Interval', refreshNow: 'Refresh Now', clear: 'Clear', current: 'Current', customPlaceholder: 'https://example.com/image.jpg', enterUrl: 'Please enter an image URL', uploadBtn: 'Choose Image', lang: '中文' }
    }

    var SOURCE_NAMES = {
      anime_pc: { zh: '动漫横屏', en: 'Anime Desktop' }, anime_ecy: { zh: '动漫插画', en: 'Anime Illustration' }, anime_dongman: { zh: '动漫艺术', en: 'Anime Art' },
      scenery_picsum: { zh: '风景摄影', en: 'Landscape' }, scenery_fengjing: { zh: '风景壁纸', en: 'Scenic Wallpaper' }, wallpaper_bing: { zh: 'Bing 每日', en: 'Bing Daily' },
      wallpaper_art: { zh: '艺术壁纸', en: 'Abstract Art' }, custom_url: { zh: '自定义链接', en: 'Custom URL' }, local_upload: { zh: '本地上传', en: 'Upload' }
    }

    var SOURCE_URLS = {
      anime_pc: 'https://www.loliapi.com/acg/pc/', anime_ecy: 'https://api.yujn.cn/api/ecy.php', anime_dongman: 'https://api.yujn.cn/api/dongman.php',
      scenery_picsum: 'https://picsum.photos/1920/1080', scenery_fengjing: 'https://api.yujn.cn/api/fengjing.php', wallpaper_bing: 'https://api.yujn.cn/api/bing.php', wallpaper_art: 'https://api.yujn.cn/api/heisi.php'
    }

    var SOURCE_KEYS = Object.keys(SOURCE_NAMES)
    var bgDispose = null

    function applyBg(url, opacity, blur) {
      if (bgDispose) { bgDispose(); bgDispose = null }
      if (!url) return
      var safeUrl = String(url).replace(/"/g, '%22')
      var o = String(opacity)
      var b = Math.round(parseInt(blur)) + 'px'
      var css = 'body::before{content:\'\';position:fixed;inset:0;z-index:999999;background-image:url("' + safeUrl + '");background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;opacity:' + o + ';filter:blur(' + b + ');}'
      bgDispose = styles.insert(css)
    }

    function clearBg() { if (bgDispose) { bgDispose(); bgDispose = null } }

    function formatDuration(s) { if (s < 60) return s + 's'; var m = Math.floor(s / 60); if (m < 60) return m + 'm'; return Math.floor(m / 60) + 'h' }

    var saved = loadSettings()

    function BeautifyPanel(props) {
      var _R = React
      var langSt = _R.useState(saved ? saved.lang : 'zh')
      var lang = langSt[0], setLang = langSt[1]
      var sourceTypeSt = _R.useState(saved ? saved.sourceType : 'anime_pc')
      var sourceType = sourceTypeSt[0], setSourceType = sourceTypeSt[1]
      var customUrlSt = _R.useState(saved ? (saved.customUrl || '') : '')
      var customUrl = customUrlSt[0], setCustomUrl = customUrlSt[1]
      var opacitySt = _R.useState(saved ? (saved.opacity || 0.35) : 0.35)
      var opacity = opacitySt[0], setOpacity = opacitySt[1]
      var blurSt = _R.useState(saved ? (saved.blur || 0) : 0)
      var blur = blurSt[0], setBlur = blurSt[1]
      var autoRefreshSt = _R.useState(saved ? (saved.autoRefresh || false) : false)
      var autoRefresh = autoRefreshSt[0], setAutoRefresh = autoRefreshSt[1]
      var refreshIntervalSt = _R.useState(saved ? (saved.refreshInterval || 60) : 60)
      var refreshInterval = refreshIntervalSt[0], setRefreshInterval = refreshIntervalSt[1]
      var currentImageSt = _R.useState(saved ? (saved.currentImage || null) : null)
      var currentImage = currentImageSt[0], setCurrentImage = currentImageSt[1]
      var localFileNameSt = _R.useState(saved ? (saved.localFileName || null) : null)
      var localFileName = localFileNameSt[0], setLocalFileName = localFileNameSt[1]
      var localDataUrlSt = _R.useState(saved ? (saved.localDataUrl || null) : null)
      var localDataUrl = localDataUrlSt[0], setLocalDataUrl = localDataUrlSt[1]

      var fileInputRef = _R.useRef(null)

      // Persist on EVERY change
      _R.useEffect(function() {
        saveSettings({
          lang: lang,
          sourceType: sourceType,
          customUrl: customUrl,
          opacity: opacity,
          blur: blur,
          autoRefresh: autoRefresh,
          refreshInterval: refreshInterval,
          currentImage: currentImage,
          localFileName: localFileName,
          localDataUrl: localDataUrl
        })
      }, [lang, sourceType, customUrl, opacity, blur, autoRefresh, refreshInterval, currentImage, localFileName, localDataUrl])

      // Apply background when image/opacity/blur changes
      _R.useEffect(function() {
        if (currentImage && currentImage.url) {
          applyBg(currentImage.url, opacity, blur)
        }
      }, [currentImage ? currentImage.url : null, opacity, blur])

      // Auto-refresh timer
      _R.useEffect(function() {
        if (autoRefresh) return timer.interval(function() { refresh() }, refreshInterval * 1000)
      }, [autoRefresh, refreshInterval])

      function refresh() {
        if (sourceType === 'custom_url') {
          if (!customUrl.trim()) return
          setCurrentImage({ url: customUrl.trim(), source: SOURCE_NAMES.custom_url[lang] })
          return
        }
        if (sourceType === 'local_upload') {
          if (localDataUrl) setCurrentImage({ url: localDataUrl, source: localFileName || SOURCE_NAMES.local_upload[lang] })
          else if (fileInputRef.current) fileInputRef.current.click()
          return
        }
        var baseUrl = SOURCE_URLS[sourceType]
        if (baseUrl) {
          var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?'
          setCurrentImage({ url: baseUrl + sep + '_t=' + Date.now(), source: SOURCE_NAMES[sourceType][lang] })
        }
      }

      function handleFileChange(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        setLocalFileName(f.name)
        var r = new FileReader()
        r.onload = function(ev) { var d = ev.target.result; setLocalDataUrl(d); setCurrentImage({ url: d, source: f.name }) }
        r.readAsDataURL(f)
      }

      var cp = 'var(--dsw-alias-brand-primary, #6366f1)'
      var cb = 'var(--dsw-alias-border-l1, #d1d5db)'
      var cl = 'var(--dsw-alias-label-primary, #111827)'
      var cs = 'var(--dsw-alias-label-secondary, #6b7280)'
      var st = { fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: cs, margin: '0 0 10px 0' }
      var t = I18N[lang]

      var sourceList = _R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, SOURCE_KEYS.map(function(key) { var sel = sourceType === key; return _R.createElement('label', { key: key, onClick: function() { setSourceType(key) }, style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: sel ? 'color-mix(in srgb, ' + cp + ' 8%, transparent)' : 'transparent', transition: 'background 150ms ease' } }, _R.createElement('span', { style: { width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid ' + (sel ? cp : cb), background: sel ? cp : 'transparent', flexShrink: 0, transition: 'all 150ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, sel ? _R.createElement('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: '#fff' } }) : null), _R.createElement('span', { style: { fontSize: '13px', fontWeight: sel ? 500 : 400, color: sel ? cl : cs, transition: 'color 150ms ease' } }, SOURCE_NAMES[key][lang])) }))
      var customInput = sourceType === 'custom_url' ? _R.createElement('div', { style: { marginTop: '10px', paddingLeft: '26px' } }, _R.createElement('input', { type: 'text', value: customUrl, onChange: function(e) { setCustomUrl(e.target.value) }, placeholder: t.customPlaceholder, style: { width: '100%', padding: '8px 12px', border: '1px solid ' + cb, borderRadius: '6px', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: cl, fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' } })) : null
      var uploadArea = sourceType === 'local_upload' ? _R.createElement('div', { style: { marginTop: '10px', paddingLeft: '26px' } }, _R.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', onChange: handleFileChange, style: { display: 'none' } }), _R.createElement('button', { onClick: function() { if (fileInputRef.current) fileInputRef.current.click() }, style: { width: '100%', padding: '10px 12px', border: '1px dashed ' + cb, borderRadius: '6px', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)', color: cs, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } }, localFileName || t.uploadBtn)) : null
      var opacityRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.opacity), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, Math.round(opacity * 100) + '%')), _R.createElement('input', { type: 'range', min: '0.05', max: '1', step: '0.05', value: opacity, onChange: function(e) { setOpacity(parseFloat(e.target.value)) }, style: { width: '100%', accentColor: cp } }))
      var blurRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.blur), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, blur + 'px')), _R.createElement('input', { type: 'range', min: '0', max: '30', step: '1', value: blur, onChange: function(e) { setBlur(parseInt(e.target.value)) }, style: { width: '100%', accentColor: cp } }))
      var refreshRow = _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('label', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 0' } }, _R.createElement('span', { style: st }, t.autoRefresh), _R.createElement('span', { onClick: function(e) { e.stopPropagation(); setAutoRefresh(!autoRefresh) }, style: { width: '32px', height: '18px', borderRadius: '9px', background: autoRefresh ? cp : cb, position: 'relative', cursor: 'pointer', transition: 'background 200ms ease', flexShrink: 0 } }, _R.createElement('span', { style: { position: 'absolute', top: '2px', left: autoRefresh ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)' } }))), autoRefresh ? _R.createElement('div', { style: { marginTop: '12px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.interval), _R.createElement('span', { style: { fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: cs, fontWeight: 500 } }, formatDuration(refreshInterval))), _R.createElement('input', { type: 'range', min: '10', max: '3600', step: '10', value: refreshInterval, onChange: function(e) { setRefreshInterval(parseInt(e.target.value)) }, style: { width: '100%', accentColor: cp } })) : null)
      var actions = _R.createElement('div', { style: { marginTop: '28px', display: 'flex', gap: '8px' } }, _R.createElement('button', { onClick: refresh, style: { flex: 1, padding: '9px 16px', border: 'none', borderRadius: '8px', background: cp, color: '#000', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' } }, t.refreshNow), _R.createElement('button', { onClick: function() { setCurrentImage(null); clearBg() }, style: { padding: '9px 16px', border: '1px solid ' + cb, borderRadius: '8px', background: 'transparent', color: cl, cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' } }, t.clear))
      var imageInfo = currentImage ? _R.createElement('div', { style: { marginTop: '24px' } }, _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, _R.createElement('span', { style: st }, t.current), _R.createElement('span', { style: { fontSize: '11px', color: cs, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentImage.source)), _R.createElement('div', { style: { borderRadius: '6px', overflow: 'hidden', border: '1px solid ' + cb, aspectRatio: '16 / 9', background: 'var(--dsw-alias-bg-layer-2, #f3f4f6)' } }, _R.createElement('img', { src: currentImage.url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }, onError: function(e) { e.target.style.display = 'none' } }))) : null

      return _R.createElement('div', { style: { padding: '20px 24px' } },
        _R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' } }, _R.createElement('h2', { style: { margin: 0, fontSize: '17px', fontWeight: 600, color: cl, letterSpacing: '-0.01em' } }, t.title), _R.createElement('button', { onClick: function() { setLang(lang === 'zh' ? 'en' : 'zh') }, style: { padding: '4px 10px', border: '1px solid ' + cb, borderRadius: '6px', background: 'transparent', color: cs, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' } }, t.lang)),
        _R.createElement('div', { style: { marginBottom: '24px' } }, _R.createElement('h3', { style: st }, t.source), sourceList, customInput, uploadArea),
        opacityRow, blurRow, refreshRow, actions, imageInfo
      )
    }

    // Auto-restore background on DSH startup
    if (saved && saved.currentImage && saved.currentImage.url) {
      applyBg(saved.currentImage.url, saved.opacity || 0.35, saved.blur || 0)
    }

    slots.inject('settings.section', function() {
      slots.register(
        { name: 'settings.section', id: 'dsh-beautify', label: 'Background', order: 50 },
        function(props) { return React.createElement(BeautifyPanel, props) }
      )
    })

    ctx.effect(function() { return function() { clearBg() } })
  }
}
